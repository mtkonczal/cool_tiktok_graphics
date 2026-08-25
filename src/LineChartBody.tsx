import React from "react";
import {
  DataRow,
  Waypoint,
  buildRuns,
  chooseYStep,
  haFor,
  monthDate,
  pathD,
  px,
  py,
  svgAnchor,
  yearStep,
} from "./chartEngine";
import { MARK, MAX_LABEL_SHRINK, PETROL, Palette, PLOT, ROW, STROKE, TYPE } from "./theme";

// The reusable "line reveals, comet dot rides the tip, waypoints pop in and
// shrink with zoom" body -- shared by the reveal-only and zoom-out
// compositions. Everything is plain SVG/JSX so it renders identically whether
// zoomFactor is 1 (no zoom) or >1 (zoomed out).
//
// Three changes from the first version, all visual -- the data, the waypoint
// dates, the y-limits and the gap handling are untouched:
//   1. The x-axis moved above the plot, bound to it by a rule and tick marks.
//      Same plot height either way; the point is that year labels can no longer
//      collide with the caption block.
//   2. The glow filter is gone. A knockout stroke -- the path drawn first at
//      21px in the background color, then at 11px in the series color -- keeps
//      the line clean where it crosses gridlines with none of the neon.
//   3. The latest point is the same knockout-circle mark as every other
//      waypoint, just filled in the accent color -- "now" reads by color, not
//      by switching shape. This is the single use of the accent color in the
//      frame besides its value label.
export type AvgLine = {
  value: number;
  label: string;
  leftIdx: number;
  rightIdx: number;
  labelIdx: number;
};

export const LineChartBody: React.FC<{
  data: DataRow[];
  xDomain: [number, number];
  yDomain: [number, number];
  i0: number;
  tipExact: number;
  waypoints: Waypoint[];
  zoomFactor?: number;
  palette?: Palette;
  avgLine?: AvgLine;
}> = ({ data, xDomain, yDomain, i0, tipExact, waypoints, zoomFactor = 1, palette = PETROL, avgLine }) => {
  // Dot marks shrink with the full zoom (a real "camera pulling back" reads fine
  // for a plain circle), but label text can't -- past MAX_LABEL_SHRINK the
  // callouts stop being legible well before the marks themselves would.
  const textZoom = Math.min(zoomFactor, MAX_LABEL_SHRINK);
  const yStep = chooseYStep(yDomain);
  const yTicks: number[] = [];
  for (let yv = Math.ceil(yDomain[0] / yStep) * yStep; yv <= yDomain[1]; yv += yStep) yTicks.push(yv);

  const iLo = Math.max(0, Math.ceil(xDomain[0]));
  const iHi = Math.min(data.length - 1, Math.floor(xDomain[1]));
  const step = yearStep(xDomain);
  const janIdxs: number[] = [];
  for (let i = iLo; i <= iHi; i++) {
    const md = monthDate(data[i].date);
    if (md.month === 1 && md.year % step === 0) janIdxs.push(i);
  }

  const { runs, tipVal } = buildRuns(data, i0, tipExact);
  const d = pathD(runs, xDomain, yDomain);

  const lastIdx = data.length - 1;
  const atLatest = tipExact >= lastIdx - 1e-9;

  return (
    <>
      {/* horizontal gridlines + y labels */}
      {yTicks.map((yv) => {
        const yPix = py(yv, yDomain);
        return (
          <React.Fragment key={`y-${yv}`}>
            <line
              x1={PLOT.left}
              y1={yPix}
              x2={PLOT.right}
              y2={yPix}
              stroke={palette.grid}
              strokeWidth={STROKE.grid}
            />
            <text
              x={PLOT.left - 22}
              y={yPix + 14}
              fontSize={TYPE.axis.size}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor="end"
            >
              {yv}
            </text>
          </React.Fragment>
        );
      })}

      {/* x-axis, ABOVE the plot: rule + ticks bind the year labels to the plot
          so they read as an axis rather than as a subtitle under the title. */}
      <line
        x1={PLOT.left}
        y1={ROW.xaxisRule}
        x2={PLOT.right}
        y2={ROW.xaxisRule}
        stroke={palette.grid}
        strokeWidth={STROKE.grid}
      />
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
            {`’${String(monthDate(data[i].date).year).slice(2)}`}
          </text>
        </React.Fragment>
      ))}

      {/* reference line: 2024-2026 average, grows backward in from the tip as
          the composition zooms out (leftIdx tracks xDomain[0]) -- the label
          only appears once the line has grown back far enough to reach it. */}
      {avgLine && avgLine.leftIdx < avgLine.rightIdx && (
        <>
          <line
            x1={px(avgLine.leftIdx, xDomain)}
            y1={py(avgLine.value, yDomain)}
            x2={px(avgLine.rightIdx, xDomain)}
            y2={py(avgLine.value, yDomain)}
            stroke={palette.dim}
            strokeWidth={STROKE.tick}
            strokeDasharray={STROKE.dash}
          />
          {avgLine.leftIdx <= avgLine.labelIdx && (
            <text
              x={px(avgLine.labelIdx, xDomain)}
              y={py(avgLine.value, yDomain) - 22}
              fontSize={TYPE.axis.size / textZoom}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor={svgAnchor(haFor(avgLine.labelIdx, xDomain))}
            >
              {avgLine.label}
            </text>
          )}
        </>
      )}

      {/* the series: knockout stroke, then the real one */}
      {d && (
        <>
          <path
            d={d}
            fill="none"
            stroke={palette.bg}
            strokeWidth={STROKE.knockout}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={d}
            fill="none"
            stroke={palette.series}
            strokeWidth={STROKE.series}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* leading edge, only while the line is still drawing */}
      {tipVal && !atLatest && (
        <>
          <circle
            cx={px(tipVal[0], xDomain)}
            cy={py(tipVal[1], yDomain)}
            r={(MARK.waypoint + 2) / zoomFactor}
            fill={palette.series}
          />
          <circle
            cx={px(tipVal[0], xDomain)}
            cy={py(tipVal[1], yDomain)}
            r={MARK.waypointCore / zoomFactor}
            fill={palette.bg}
          />
        </>
      )}

      {(() => {
        const visible = waypoints.filter(
          (wp) =>
            (wp.opacity ?? 1) > 0 &&
            (wp.idx >= i0 ? tipExact >= wp.idx : xDomain[0] <= wp.idx && wp.idx <= xDomain[1])
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
              <circle
                cx={cx}
                cy={cy}
                r={MARK.waypoint / zoomFactor}
                fill={isLatest ? palette.accent : palette.series}
              />
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
    </>
  );
};
