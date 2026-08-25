import React from "react";
import {
  DataRow,
  Point,
  buildRuns,
  chooseYStep,
  ease,
  haFor,
  monthDate,
  pathD,
  px,
  py,
  svgAnchor,
  yearStep,
} from "../engine/scales";
import { Unit, fmtAxis } from "../engine/format";
import { Waypoint } from "../engine/waypoints";
import { ResolvedAnnotation } from "../engine/annotations";
import { MARK, MAX_LABEL_SHRINK, PETROL, Palette, PLOT, ROW, STROKE, TEXTSAFE, TYPE } from "../theme";

// The reusable line-chart body: 1 series gets the full reveal treatment
// (waypoint callouts that pop in and shrink with zoom, an optional reference
// line); 2+ series get a knockout-stroke line each plus a static label near
// each line's own midpoint, since with several moving lines a chasing
// waypoint callout has nowhere stable to sit. This is LineChartBody and
// TwoLineChartBody merged into one component, branching on series.length --
// see PLAN.md Phase 2. Everything is plain SVG/JSX so it renders identically
// whether zoomFactor is 1 (no zoom) or >1 (zoomed out).
//
// Visual notes carried over from the original bodies:
//   1. The x-axis sits above the plot, bound to it by a rule and tick marks,
//      so year labels never compete with the caption block underneath.
//   2. No glow filter. A knockout stroke -- the path drawn first wider in the
//      background color, then narrower in the series color -- keeps the line
//      clean where it crosses gridlines or another series.
//   3. In single-series mode, the latest point is the same knockout-circle
//      mark as every other waypoint, just filled in the accent color -- "now"
//      reads by color, not by switching shape.
export type LineSeries = {
  data: DataRow[];
  label?: string;
  color?: string;
};

const LABEL_GAP = 92; // clears a series' local wiggle amplitude in multi-series mode
const LABEL_FADE_FRAC = 0.35; // full opacity by 35% of the reveal -- well ahead of the tip

function nearestValue(data: DataRow[], idx: number): number | null {
  for (let d = 0; d < data.length; d++) {
    const lo = idx - d, hi = idx + d;
    if (lo >= 0 && data[lo].value !== null) return data[lo].value;
    if (hi < data.length && data[hi].value !== null) return data[hi].value;
  }
  return null;
}

export const LineBody: React.FC<{
  series: LineSeries[];
  xDomain: [number, number];
  yDomain: [number, number];
  i0: number;
  tipExact: number;
  unit: Unit;
  zoomFactor?: number;
  palette?: Palette;
  waypoints?: Waypoint[];
  annotations?: ResolvedAnnotation[];
}> = ({
  series,
  xDomain,
  yDomain,
  i0,
  tipExact,
  unit,
  zoomFactor = 1,
  palette = PETROL,
  waypoints = [],
  annotations = [],
}) => {
  const primary = series[0].data;
  // Dot marks and label text shrink with zoom the same way waypoints do --
  // shared across both series-count branches since hline/vline/point labels
  // render regardless of which one is active.
  const textZoom = Math.min(zoomFactor, MAX_LABEL_SHRINK);
  const yStep = chooseYStep(yDomain);
  const yTicks: number[] = [];
  for (let yv = Math.ceil(yDomain[0] / yStep) * yStep; yv <= yDomain[1]; yv += yStep) yTicks.push(yv);

  const iLo = Math.max(0, Math.ceil(xDomain[0]));
  const iHi = Math.min(primary.length - 1, Math.floor(xDomain[1]));
  const step = yearStep(xDomain);
  const janIdxs: number[] = [];
  for (let i = iLo; i <= iHi; i++) {
    const md = monthDate(primary[i].date);
    if (md.month === 1 && md.year % step === 0) janIdxs.push(i);
  }

  const lastIdx = primary.length - 1;
  const atLatest = tipExact >= lastIdx - 1e-9;

  const chrome = (
    <>
      {/* horizontal gridlines + y labels */}
      {yTicks.map((yv) => {
        const yPix = py(yv, yDomain);
        return (
          <React.Fragment key={`y-${yv}`}>
            <line x1={PLOT.left} y1={yPix} x2={PLOT.right} y2={yPix} stroke={palette.grid} strokeWidth={STROKE.grid} />
            <text
              x={PLOT.left - 22}
              y={yPix + 14}
              fontSize={TYPE.axis.size}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor="end"
            >
              {fmtAxis(unit, yv)}
            </text>
          </React.Fragment>
        );
      })}

      {/* x-axis, ABOVE the plot: rule + ticks bind the year labels to the plot
          so they read as an axis rather than as a subtitle under the title. */}
      <line x1={PLOT.left} y1={ROW.xaxisRule} x2={PLOT.right} y2={ROW.xaxisRule} stroke={palette.grid} strokeWidth={STROKE.grid} />
      {janIdxs.map((i) => (
        <React.Fragment key={`x-${i}`}>
          <line
            x1={px(i, xDomain)}
            y1={ROW.xaxisRule}
            x2={px(i, xDomain)}
            y2={ROW.xaxisRule + ROW.xaxisTick}
            stroke={palette.grid}
            strokeWidth={STROKE.tick}
          />
          <text
            x={px(i, xDomain)}
            y={ROW.xaxisLabel}
            fontSize={TYPE.axis.size}
            fontFamily={TYPE.axis.family}
            fontWeight={TYPE.axis.weight}
            fill={palette.dim}
            textAnchor="middle"
          >
            {`’${String(monthDate(primary[i].date).year).slice(2)}`}
          </text>
        </React.Fragment>
      ))}
    </>
  );

  // Bands render behind everything (shading, not a mark); hline/vline behind
  // the series lines (reference context, not the point of the frame); point/
  // free render last, on top of the data. All three groups are shared across
  // both series-count branches -- an annotation doesn't care whether it's
  // decorating one line or two.
  const bands = annotations.filter((a): a is Extract<ResolvedAnnotation, { kind: "band" }> => a.kind === "band");
  const MIN_BAND_WIDTH = 4; // a 1-2 month recession is sub-pixel wide once zoomed out to 30 years -- floor it so it doesn't just vanish
  const bandEls = bands.map((b, i) => {
    let x1 = Math.max(PLOT.left, Math.min(PLOT.right, px(b.i0, xDomain)));
    let x2 = Math.max(PLOT.left, Math.min(PLOT.right, px(b.i1, xDomain)));
    if (x2 - x1 < MIN_BAND_WIDTH) {
      const mid = (x1 + x2) / 2;
      x1 = mid - MIN_BAND_WIDTH / 2;
      x2 = mid + MIN_BAND_WIDTH / 2;
    }
    if (x2 <= x1) return null;
    return (
      <g key={`band-${i}`} opacity={b.opacity}>
        <rect x={x1} y={PLOT.top} width={x2 - x1} height={PLOT.bottom - PLOT.top} fill={palette.dim} fillOpacity={0.15} />
        {b.label && (
          <text
            x={(x1 + x2) / 2}
            y={PLOT.top + 36}
            fontSize={TYPE.axis.size * 0.8}
            fontFamily={TYPE.axis.family}
            fontWeight={TYPE.axis.weight}
            fill={palette.dim}
            textAnchor="middle"
          >
            {b.label}
          </text>
        )}
      </g>
    );
  });

  const hlines = annotations.filter((a): a is Extract<ResolvedAnnotation, { kind: "hline" }> => a.kind === "hline");
  const hlineEls = hlines.map(
    (h, i) =>
      h.leftIdx < h.rightIdx && (
        <g key={`hline-${i}`} opacity={h.opacity}>
          <line
            x1={px(h.leftIdx, xDomain)}
            y1={py(h.value, yDomain)}
            x2={px(h.rightIdx, xDomain)}
            y2={py(h.value, yDomain)}
            stroke={palette.dim}
            strokeWidth={STROKE.tick}
            strokeDasharray={STROKE.dash}
          />
          {h.leftIdx <= h.labelIdx && (
            <text
              x={px(h.labelIdx, xDomain)}
              y={py(h.value, yDomain) - 22}
              fontSize={TYPE.axis.size / textZoom}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor={svgAnchor(haFor(h.labelIdx, xDomain))}
            >
              {h.label}
            </text>
          )}
        </g>
      )
  );

  const vlines = annotations.filter((a): a is Extract<ResolvedAnnotation, { kind: "vline" }> => a.kind === "vline");
  const vlineEls = vlines.map((v, i) => (
    <g key={`vline-${i}`} opacity={v.opacity}>
      <line
        x1={px(v.idx, xDomain)}
        y1={PLOT.top}
        x2={px(v.idx, xDomain)}
        y2={PLOT.bottom}
        stroke={palette.dim}
        strokeWidth={STROKE.tick}
        strokeDasharray={STROKE.dash}
      />
      <text
        x={px(v.idx, xDomain)}
        y={PLOT.top - 12}
        fontSize={TYPE.axis.size / textZoom}
        fontFamily={TYPE.axis.family}
        fontWeight={TYPE.axis.weight}
        fill={palette.dim}
        textAnchor="middle"
      >
        {v.label}
      </text>
    </g>
  ));

  const points = annotations.filter((a): a is Extract<ResolvedAnnotation, { kind: "point" }> => a.kind === "point");
  const POINT_LEADER = 48;
  const pointEls = points.map((p, i) => {
    const cx = px(p.idx, xDomain);
    const cy = py(p.value, yDomain);
    const anchor = svgAnchor(haFor(p.idx, xDomain));
    return (
      <g key={`point-${i}`} opacity={p.opacity}>
        <circle cx={cx} cy={cy} r={MARK.waypoint / zoomFactor} fill={palette.accent} />
        <circle cx={cx} cy={cy} r={MARK.waypointCore / zoomFactor} fill={palette.bg} />
        <line x1={cx} y1={cy - MARK.waypoint / zoomFactor} x2={cx} y2={cy - POINT_LEADER} stroke={palette.dim} strokeWidth={STROKE.tick} />
        <text
          x={cx}
          y={cy - POINT_LEADER - 10}
          fontSize={TYPE.date.size / textZoom}
          fontFamily={TYPE.date.family}
          fontWeight={TYPE.date.weight}
          fill={palette.text}
          textAnchor={anchor}
        >
          {p.label}
        </text>
      </g>
    );
  });

  const frees = annotations.filter((a): a is Extract<ResolvedAnnotation, { kind: "free" }> => a.kind === "free");
  const freeEls = frees.map((f, i) => (
    <text
      key={`free-${i}`}
      x={TEXTSAFE.x + f.x * TEXTSAFE.w}
      y={TEXTSAFE.y + f.y * TEXTSAFE.h}
      textAnchor={f.align}
      fontSize={TYPE.value.size}
      fontFamily={TYPE.value.family}
      fontWeight={TYPE.value.weight}
      fill={palette.text}
      opacity={f.opacity}
    >
      {f.label}
    </text>
  ));

  if (series.length === 1) {
    const data = primary;
    const { runs, tipVal } = buildRuns(data, i0, tipExact);
    const d = pathD(runs, xDomain, yDomain);

    return (
      <>
        {bandEls}
        {chrome}
        {hlineEls}
        {vlineEls}

        {/* the series: knockout stroke, then the real one */}
        {d && (
          <>
            <path d={d} fill="none" stroke={palette.bg} strokeWidth={STROKE.knockout} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={palette.series} strokeWidth={STROKE.series} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* leading edge, only while the line is still drawing */}
        {tipVal && !atLatest && (
          <>
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={(MARK.waypoint + 2) / zoomFactor} fill={palette.series} />
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypointCore / zoomFactor} fill={palette.bg} />
          </>
        )}

        {(() => {
          const visible = waypoints.filter(
            (wp) => (wp.opacity ?? 1) > 0 && (wp.idx >= i0 ? tipExact >= wp.idx : xDomain[0] <= wp.idx && wp.idx <= xDomain[1])
          );

          // Waypoints that were comfortably spaced pre-zoom (e.g. the "recent"
          // trio) can end up pixel-close once the view zooms out -- since we no
          // longer shrink label text down to fit (that's the readability fix
          // above), an overlapping pair gets staggered onto a second row
          // instead. Overlap is checked via each label's own anchor-aware
          // bounding box (not just point-to-point spacing), because a
          // right/left-anchored label extends toward its neighbor -- a plain
          // center-distance check missed that and still let mid-zoom frames
          // (full-size text, not yet fully compressed) collide. Recomputed
          // every frame, so it unwinds on its own as the view zooms back in.
          const ROW_STAGGER = 70;
          const EDGE_PAD = 16;
          const VERT_PAD = 12;
          const dateFontPx = TYPE.date.size / textZoom;
          const laidOut = visible.map((wp) => {
            const cx = px(wp.idx, xDomain);
            const anchor = svgAnchor(haFor(wp.idx, xDomain));
            const w = wp.dateLabel.length * dateFontPx * 0.56; // date label is the wider of the pair
            const left = anchor === "start" ? cx : anchor === "end" ? cx - w : cx - w / 2;
            const right = anchor === "start" ? cx + w : anchor === "end" ? cx : cx + w / 2;
            // Date line sits above the value line (calloutYDate > calloutYValue
            // in data space, which is a smaller/higher pixel y) for both anchor
            // modes -- "max" puts every waypoint's pair at the same two rows,
            // "point" puts each pair at its own point's height.
            const top = py(wp.calloutYDate, yDomain);
            const bottom = py(wp.calloutYValue, yDomain);
            return { wp, cx, anchor, left, right, top, bottom };
          });
          // Two labels only compete for a row if they'd actually overlap on
          // screen -- horizontally close AND vertically close. With every
          // waypoint pinned to the same callout height ("max" anchor) the
          // vertical check is always true, so this matches the old x-only
          // behavior there. With per-point callout heights ("point" anchor) two
          // waypoints can be horizontally close but already sit rows apart in Y
          // because their underlying values differ -- treating that as a
          // collision doesn't just draw two labels close together, it makes
          // whichever one flips into view last (as tipExact sweeps past it)
          // suddenly bump an already-visible label into ROW_STAGGER, which the
          // viewer sees as a mid-reveal jump.
          const collides = (a: (typeof laidOut)[number], b: (typeof laidOut)[number]) =>
            a.right > b.left - EDGE_PAD && a.top < b.bottom + VERT_PAD && b.top < a.bottom + VERT_PAD;

          // A center-anchored label that just barely clips its right neighbor
          // gets pulled to an end anchor -- ending at its own dot instead of
          // straddling it -- before falling back to a second row. That keeps
          // e.g. Dec 2019 on the same baseline as the latest point instead of
          // popping up a row purely because they landed a few pixels apart.
          for (let i = 0; i < laidOut.length - 1; i++) {
            const cur = laidOut[i];
            const nxt = laidOut[i + 1];
            if (collides(cur, nxt)) {
              if (cur.anchor === "middle") {
                const w = cur.right - cur.left;
                cur.anchor = "end";
                cur.left = cur.cx - w;
                cur.right = cur.cx;
              } else if (nxt.anchor === "middle") {
                const w = nxt.right - nxt.left;
                nxt.anchor = "start";
                nxt.left = nxt.cx;
                nxt.right = nxt.cx + w;
              }
            }
          }

          // Assigned right-to-left, pinning the rightmost (almost always the
          // latest/"now" point) at row 0 -- it never moves. A collision instead
          // bumps the OLDER of the pair up to row 1, so "now" stays at the same
          // level the whole time and older callouts cede the row instead.
          const rows = new Array(laidOut.length).fill(0);
          let nextEntry: (typeof laidOut)[number] | null = null;
          let nextRow = 0;
          for (let i = laidOut.length - 1; i >= 0; i--) {
            const entry = laidOut[i];
            const row = nextEntry !== null && collides(entry, nextEntry) ? 1 - nextRow : 0;
            rows[i] = row;
            nextRow = row;
            nextEntry = entry;
          }

          return laidOut.map(({ wp, cx, anchor }, i) => {
            const cy = py(wp.val, yDomain);
            const isLatest = wp.idx === lastIdx;
            const rowOffset = rows[i] * ROW_STAGGER;
            return (
              <g key={`wp-${wp.idx}`} opacity={wp.opacity ?? 1}>
                <circle cx={cx} cy={cy} r={MARK.waypoint / zoomFactor} fill={isLatest ? palette.accent : palette.series} />
                <circle cx={cx} cy={cy} r={MARK.waypointCore / zoomFactor} fill={palette.bg} />
                <text
                  x={cx}
                  y={py(wp.calloutYDate, yDomain) - rowOffset}
                  fontSize={TYPE.date.size / textZoom}
                  fontFamily={TYPE.date.family}
                  fontWeight={TYPE.date.weight}
                  fill={palette.dim}
                  textAnchor={anchor}
                >
                  {wp.dateLabel}
                </text>
                <text
                  x={cx}
                  y={py(wp.calloutYValue, yDomain) - rowOffset}
                  fontSize={TYPE.value.size / textZoom}
                  fontFamily={TYPE.value.family}
                  fontWeight={TYPE.value.weight}
                  fill={isLatest ? palette.accent : palette.text}
                  textAnchor={anchor}
                >
                  {wp.valueLabel}
                </text>
              </g>
            );
          });
        })()}

        {pointEls}
        {freeEls}
      </>
    );
  }

  // 2+ series: each gets a knockout-stroke line plus a static label parked
  // near the midpoint of its own line -- sides alternate (even index below,
  // odd index above) so an adjacent pair stays readable once the two lines
  // converge and interleave. Labels fade in fast, well ahead of the tip,
  // rather than tracking the draw-in pace.
  const frac = ease(Math.min(Math.max(tipExact / lastIdx, 0), 1));
  const labelIdx = Math.round((iLo + iHi) / 2);
  const labelOpacity = Math.min(frac / LABEL_FADE_FRAC, 1);

  const renderLine = (s: LineSeries): { el: React.ReactNode; tipVal: Point | null } => {
    const { runs, tipVal } = buildRuns(s.data, i0, tipExact);
    const d = pathD(runs, xDomain, yDomain);
    const color = s.color ?? palette.series;
    const el = (
      <React.Fragment key={s.label ?? color}>
        {d && (
          <>
            <path d={d} fill="none" stroke={palette.bg} strokeWidth={STROKE.knockout} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={color} strokeWidth={STROKE.series} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {tipVal && !atLatest && (
          <>
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypoint + 2} fill={color} />
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypointCore} fill={palette.bg} />
          </>
        )}
      </React.Fragment>
    );
    return { el, tipVal };
  };

  const renderLabel = (s: LineSeries, side: "above" | "below") => {
    if (!s.label) return null;
    const val = nearestValue(s.data, labelIdx);
    if (val === null) return null;
    const cx = px(labelIdx, xDomain);
    const cy = py(val, yDomain);
    const anchor = svgAnchor(haFor(labelIdx, xDomain));
    const y = side === "above" ? cy - LABEL_GAP : cy + LABEL_GAP;
    return (
      <text
        key={s.label}
        x={cx}
        y={y}
        textAnchor={anchor}
        fontFamily={TYPE.subtitle.family}
        fontSize={TYPE.subtitle.size}
        fontWeight={700}
        fill={s.color ?? palette.series}
        opacity={labelOpacity}
        paintOrder="stroke"
        stroke={palette.bg}
        strokeWidth={6}
        strokeLinejoin="round"
      >
        {s.label}
      </text>
    );
  };

  return (
    <>
      {bandEls}
      {chrome}
      {hlineEls}
      {vlineEls}
      {series.map((s) => renderLine(s).el)}
      {series.map((s, i) => renderLabel(s, i % 2 === 0 ? "below" : "above"))}
      {pointEls}
      {freeEls}
    </>
  );
};
