import React from "react";
import {
  DataRow,
  Point,
  buildRuns,
  chooseYStep,
  ease,
  haFor,
  pathD,
  px,
  py,
  svgAnchor,
  xAxisTicks,
} from "../engine/scales";
import { Unit, fmtAxis } from "../engine/format";
import { Waypoint } from "../engine/waypoints";
import { ResolvedAnnotation } from "../engine/annotations";
import { MARK, MAX_LABEL_SHRINK, PETROL, Palette, PLOT, ROW, STROKE, TEXTSAFE, TYPE as DEFAULT_TYPE } from "../theme";
import { ThemeType } from "../themes/types";

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
  /** The active theme's type scale (src/themes/) -- defaults to
   * konczal_webpage's for any caller that isn't theme-aware. Shadows the
   * module-level `TYPE` import below, so every existing `TYPE.xxx`
   * reference in this file automatically follows the resolved theme
   * without each one needing to change. */
  type?: ThemeType;
  /** src/themes/types.ts's Theme["marks"]["latestSolid"] -- false (default)
   * keeps the existing ring-with-a-hole construction every waypoint dot
   * uses today, just accent-colored for "latest"; true renders "latest" as
   * a solid accent disc with a thin bg-colored border instead. */
  latestSolid?: boolean;
  waypoints?: Waypoint[];
  annotations?: ResolvedAnnotation[];
  /** Pixel amount to pull the axis-tick row (rule, ticks, month/year labels)
   * up toward the title -- for a spec with no subtitle, the row this file
   * shares with every other spec (`ROW.xaxisRule`/`xaxisLabel`) leaves a
   * noticeably empty gap under a bare title. Only this header-area row
   * moves; `PLOT.top`, the actual chart geometry, and every py()-derived
   * pixel position are untouched, so this can't perturb the tuned-by-eye
   * waypoint/gridline math the way shifting the plot itself would. Default
   * 0 leaves every existing spec byte-for-byte unchanged. */
  topOffset?: number;
}> = ({
  series,
  xDomain,
  yDomain,
  i0,
  tipExact,
  unit,
  zoomFactor = 1,
  palette = PETROL,
  type = DEFAULT_TYPE,
  latestSolid = false,
  waypoints = [],
  annotations = [],
  topOffset = 0,
}) => {
  const TYPE = type;
  const xaxisRule = ROW.xaxisRule - topOffset;
  const xaxisLabel = ROW.xaxisLabel - topOffset;
  const primary = series[0].data;
  // Dot marks and label text shrink with zoom the same way waypoints do --
  // shared across both series-count branches since hline/vline/point labels
  // render regardless of which one is active. `zoomFactor` was >= 1 for
  // every spec until labor-share.json: every prior spec's first shot is its
  // narrowest window, so later zooms only ever widen the view (zoomFactor
  // grows). labor-share.json's first shot is instead the full 1947-present
  // history -- its widest possible view -- with later shots zooming IN, so
  // markZoom legitimately drops below 1. Every mark/label size below was
  // written as `X / markZoom`, uncapped on the low end (only
  // MAX_LABEL_SHRINK capped the high end), so a sub-1 zoomFactor blew these
  // up without bound -- e.g. a waypoint dot several hundred px across.
  // markZoom floors zoomFactor at 1 for exactly this case: a view zoomed in
  // tighter than the first shot's own window keeps that first shot's mark/
  // text size instead of growing further, rather than being reasoned about
  // from scratch. A no-op for every existing spec (zoomFactor was already
  // >= 1 there), so their rendered output is unchanged -- verified by
  // rendering prime-epop-zoomout.json before/after: byte-identical.
  const markZoom = Math.max(zoomFactor, 1);
  const textZoom = Math.min(markZoom, MAX_LABEL_SHRINK);
  const yStep = chooseYStep(yDomain);
  const yTicks: number[] = [];
  for (let yv = Math.ceil(yDomain[0] / yStep) * yStep; yv <= yDomain[1]; yv += yStep) yTicks.push(yv);

  const iLo = Math.max(0, Math.ceil(xDomain[0]));
  const iHi = Math.min(primary.length - 1, Math.floor(xDomain[1]));
  const xTicks = xAxisTicks(primary, iLo, iHi);

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
      <line x1={PLOT.left} y1={xaxisRule} x2={PLOT.right} y2={xaxisRule} stroke={palette.grid} strokeWidth={STROKE.grid} />
      {xTicks.map(({ idx, lines }) => (
        <React.Fragment key={`x-${idx}`}>
          <line
            x1={px(idx, xDomain)}
            y1={xaxisRule}
            x2={px(idx, xDomain)}
            y2={xaxisRule + ROW.xaxisTick}
            stroke={palette.grid}
            strokeWidth={STROKE.tick}
          />
          {/* Multi-line ticks (month + year) stack upward from the same
              baseline a single-line tick (bare year) would sit at, so every
              tick's bottom line lines up regardless of how many lines it has. */}
          {lines.map((line, li) => (
            <text
              key={li}
              x={px(idx, xDomain)}
              y={xaxisLabel - (lines.length - 1 - li) * ROW.xaxisLabelLineHeight}
              fontSize={TYPE.axis.size}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor="middle"
            >
              {line}
            </text>
          ))}
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
        <circle cx={cx} cy={cy} r={MARK.waypoint / markZoom} fill={palette.accent} />
        <circle cx={cx} cy={cy} r={MARK.waypointCore / markZoom} fill={palette.bg} />
        <line x1={cx} y1={cy - MARK.waypoint / markZoom} x2={cx} y2={cy - POINT_LEADER} stroke={palette.dim} strokeWidth={STROKE.tick} />
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
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={(MARK.waypoint + 2) / markZoom} fill={palette.series} />
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypointCore / markZoom} fill={palette.bg} />
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
          const dateFontPx = TYPE.date.size / textZoom;
          const valueFontPx = TYPE.value.size / textZoom;
          // The padding constants below were tuned by rendering against
          // konczal_webpage's 46px value text, but expressed as a fraction
          // of the theme's OWN (un-zoomed) value size rather than a fixed
          // pixel count -- a theme with a meaningfully larger or smaller
          // type scale (e.g. butter_on_espresso's 66px) gets correctly-
          // scaled spacing automatically instead of the same absolute
          // pixels tuned for a different font size, which under-spaced
          // badly at 66px (found by rendering that theme's unrate_bls).
          // Deliberately TYPE.value.size, not valueFontPx (which also
          // divides by textZoom) -- this should vary by theme, not by how
          // zoomed-out the current shot happens to be, so a zoomed-out
          // konczal_webpage frame keeps the exact padding it always had.
          const PAD_SCALE = TYPE.value.size / 46;
          const ROW_STAGGER = 70 * PAD_SCALE;
          const EDGE_PAD = 16 * PAD_SCALE;
          // Was a flat 48 -- too tight to catch two "point"-anchor labels whose
          // calloutYValue/calloutYDate happen to land a real line-height
          // apart in data space but read as touching on screen, since top/
          // bottom above are text BASELINES, not full glyph boxes (no room
          // for the value line's own height). ~48 at the original 46px value
          // size is the minimum gap that actually clears one line of text --
          // found by rendering unrate_bls with 3 closely-spaced recent-month
          // waypoints, where a tighter pad let "Jun 2026"/"4.19%" collide into
          // the point above it.
          const VERT_PAD = 48 * PAD_SCALE;
          const INLINE_GAP = 14 * PAD_SCALE; // gap between value and date text in "inline" dateStyle
          const BESIDE_LIFT = 14 * PAD_SCALE; // small lift off the dot's own height for "besideDot", so text clears the line stroke
          // Horizontal clearance from the dot for "besideDot" labels -- without
          // it, an "end"-anchored label's edge lands exactly at cx, the same x
          // the dot itself is centered on, so the two visibly touch/overlap
          // (found by rendering unrate_bls's "latest" point, inline mode, right
          // at the dot). Not needed for the "above" (headroom) position -- that
          // one is already far enough above the dot vertically.
          const DOT_PAD = MARK.waypoint / markZoom + 8 * PAD_SCALE;
          const laidOut = visible.map((wp) => {
            const cx = px(wp.idx, xDomain);
            const anchor = svgAnchor(haFor(wp.idx, xDomain));
            const dateStyle = wp.dateStyle ?? "stacked";
            const valueW = wp.valueLabel.length * valueFontPx * 0.56;
            const dateW = wp.dateLabel.length * dateFontPx * 0.56;
            let w: number, top: number, bottom: number, rowY: number, labelCx: number;
            if (dateStyle === "stacked") {
              // Date line sits above the value line (calloutYDate > calloutYValue
              // in data space, which is a smaller/higher pixel y) for both anchor
              // modes -- "max" puts every waypoint's pair at the same two rows,
              // "point" puts each pair at its own point's height.
              w = dateW; // date label is the wider of the pair
              top = py(wp.calloutYDate, yDomain);
              bottom = py(wp.calloutYValue, yDomain);
              rowY = bottom;
              labelCx = cx;
            } else {
              // One line only -- either beside the dot (its own height, minus a
              // small lift so text clears the line stroke) or above it at the
              // usual headroom-based spot (same place "stacked" mode's value
              // line would've sat, just with no date line above it).
              rowY = wp.besideDot ? py(wp.val, yDomain) - BESIDE_LIFT : py(wp.calloutYValue, yDomain);
              w = dateStyle === "inline" ? valueW + INLINE_GAP + dateW : valueW;
              top = rowY - valueFontPx * 0.55;
              bottom = rowY + valueFontPx * 0.55;
              labelCx = wp.besideDot ? (anchor === "end" ? cx - DOT_PAD : anchor === "start" ? cx + DOT_PAD : cx) : cx;
            }
            const left = anchor === "start" ? labelCx : anchor === "end" ? labelCx - w : labelCx - w / 2;
            const right = anchor === "start" ? labelCx + w : anchor === "end" ? labelCx : labelCx + w / 2;
            return { wp, cx, labelCx, anchor, left, right, top, bottom, dateStyle, valueW, dateW, rowY };
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
                cur.left = cur.labelCx - w;
                cur.right = cur.labelCx;
              } else if (nxt.anchor === "middle") {
                const w = nxt.right - nxt.left;
                nxt.anchor = "start";
                nxt.left = nxt.labelCx;
                nxt.right = nxt.labelCx + w;
              }
            }
          }

          // Assigned right-to-left, pinning the rightmost (almost always the
          // latest/"now" point) at row 0 -- it never moves. Greedy first-fit
          // against every ALREADY-placed label (not just the immediate
          // neighbor), checked at that label's own already-resolved
          // row-shifted position -- a simple alternating 0/1 scheme only
          // ever separates one pair at a time, so 3+ labels that all crowd
          // the same stretch (e.g. a "last three months" trio sitting near
          // a recent peak) run out of rows and collide again past the
          // second one. Capped at 4 rows -- if a spec ever piles up more
          // than that in one stretch, the fix is fewer/sparser waypoints,
          // not a taller stack.
          const MAX_ROWS = 4;
          const placed: { entry: (typeof laidOut)[number]; row: number }[] = [];
          const rows = new Array(laidOut.length).fill(0);
          for (let i = laidOut.length - 1; i >= 0; i--) {
            const entry = laidOut[i];
            let row = 0;
            for (; row < MAX_ROWS - 1; row++) {
              const offset = row * ROW_STAGGER;
              const top = entry.top - offset;
              const bottom = entry.bottom - offset;
              const conflict = placed.some(({ entry: other, row: otherRow }) => {
                const oOffset = otherRow * ROW_STAGGER;
                const oTop = other.top - oOffset;
                const oBottom = other.bottom - oOffset;
                return (
                  entry.right > other.left - EDGE_PAD &&
                  other.right > entry.left - EDGE_PAD &&
                  top < oBottom + VERT_PAD &&
                  oTop < bottom + VERT_PAD
                );
              });
              if (!conflict) break;
            }
            rows[i] = row;
            placed.push({ entry, row });
          }

          return laidOut.map((entry, i) => {
            const { wp, cx, labelCx, anchor, dateStyle, valueW, dateW, rowY } = entry;
            const cy = py(wp.val, yDomain);
            const isLatest = wp.idx === lastIdx;
            const rowOffset = rows[i] * ROW_STAGGER;
            const valueColor = isLatest ? palette.accent : palette.text;
            const leaderTargetY = (dateStyle === "stacked" ? py(wp.calloutYValue, yDomain) : rowY) - rowOffset + TYPE.value.size * 0.3;

            let labelNodes: React.ReactNode;
            if (dateStyle === "stacked") {
              labelNodes = (
                <>
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
                    fill={valueColor}
                    textAnchor={anchor}
                  >
                    {wp.valueLabel}
                  </text>
                </>
              );
            } else if (dateStyle === "inline") {
              // Value then date, in that reading order, whichever direction
              // the anchor extends -- "end" ends the whole pair at the dot
              // (so the date, being second, sits right next to it and the
              // value trails further away); "start"/"middle" build the pair
              // left to right from the dot instead.
              let valueX = labelCx,
                valueAnchor = anchor,
                dateX = labelCx,
                dateAnchor = anchor;
              if (anchor === "end") {
                dateX = labelCx;
                dateAnchor = "end";
                valueX = labelCx - dateW - INLINE_GAP;
                valueAnchor = "end";
              } else if (anchor === "start") {
                valueX = labelCx;
                valueAnchor = "start";
                dateX = labelCx + valueW + INLINE_GAP;
                dateAnchor = "start";
              } else {
                const total = valueW + INLINE_GAP + dateW;
                valueX = labelCx - total / 2;
                valueAnchor = "start";
                dateX = valueX + valueW + INLINE_GAP;
                dateAnchor = "start";
              }
              const rowYAdj = rowY - rowOffset;
              labelNodes = (
                <>
                  <text
                    x={valueX}
                    y={rowYAdj}
                    fontSize={TYPE.value.size / textZoom}
                    fontFamily={TYPE.value.family}
                    fontWeight={TYPE.value.weight}
                    fill={valueColor}
                    textAnchor={valueAnchor}
                  >
                    {wp.valueLabel}
                  </text>
                  <text
                    x={dateX}
                    y={rowYAdj}
                    fontSize={TYPE.date.size / textZoom}
                    fontFamily={TYPE.date.family}
                    fontWeight={TYPE.date.weight}
                    fill={palette.dim}
                    textAnchor={dateAnchor}
                  >
                    {wp.dateLabel}
                  </text>
                </>
              );
            } else {
              labelNodes = (
                <text
                  x={labelCx}
                  y={rowY - rowOffset}
                  fontSize={TYPE.value.size / textZoom}
                  fontFamily={TYPE.value.family}
                  fontWeight={TYPE.value.weight}
                  fill={valueColor}
                  textAnchor={anchor}
                >
                  {wp.valueLabel}
                </text>
              );
            }

            return (
              <g key={`wp-${wp.idx}`} opacity={wp.opacity ?? 1}>
                {/* A label bumped a row or more away from its natural spot
                    (crowded off it by a neighbor) otherwise floats with no
                    visual tie back to its own dot -- a thin leader closes
                    that gap, same idea as a "point" annotation's leader. */}
                {rowOffset > 0 && (
                  <line x1={cx} y1={cy} x2={cx} y2={leaderTargetY} stroke={palette.dim} strokeWidth={STROKE.tick} />
                )}
                {latestSolid && isLatest ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(MARK.waypoint + 3) / markZoom}
                    fill={palette.accent}
                    stroke={palette.bg}
                    strokeWidth={7 / markZoom}
                  />
                ) : (
                  <>
                    <circle cx={cx} cy={cy} r={MARK.waypoint / markZoom} fill={isLatest ? palette.accent : palette.series} />
                    <circle cx={cx} cy={cy} r={MARK.waypointCore / markZoom} fill={palette.bg} />
                  </>
                )}
                {labelNodes}
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
