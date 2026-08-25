import React from "react";
import {
  ACCENT,
  DataRow,
  GRID,
  PLOT,
  TEXT_LIGHT,
  TEXT_MUTED,
  Waypoint,
  buildRuns,
  haFor,
  monthDate,
  pathD,
  px,
  py,
  svgAnchor,
  yearStep,
} from "./chartEngine";

// The reusable "line reveals, comet dot rides the tip, waypoints pop in and
// shrink with zoom" body -- shared by the reveal-only and zoom-out
// compositions. Everything here is plain SVG/JSX so it renders identically
// whether zoomFactor is 1 (no zoom) or >1 (zoomed out).
export const LineChartBody: React.FC<{
  data: DataRow[];
  xDomain: [number, number];
  yDomain: [number, number];
  i0: number;
  tipExact: number;
  waypoints: Waypoint[];
  zoomFactor?: number;
}> = ({ data, xDomain, yDomain, i0, tipExact, waypoints, zoomFactor = 1 }) => {
  const yTicks: number[] = [];
  for (let yv = Math.ceil(yDomain[0] / 2) * 2; yv <= yDomain[1]; yv += 2) yTicks.push(yv);

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

  return (
    <>
      {yTicks.map((yv) => {
        const yPix = py(yv, yDomain);
        return (
          <React.Fragment key={`y-${yv}`}>
            <line x1={PLOT.left} y1={yPix} x2={PLOT.right} y2={yPix} stroke={GRID} strokeWidth={1} />
            <text x={PLOT.left - 12} y={yPix + 5} fontSize={20} fill={TEXT_MUTED} textAnchor="end">
              {yv}%
            </text>
          </React.Fragment>
        );
      })}

      {janIdxs.map((i) => (
        <text
          key={`x-${i}`}
          x={px(i, xDomain)}
          y={PLOT.bottom + 36}
          fontSize={20}
          fill={TEXT_MUTED}
          textAnchor="middle"
        >
          {monthDate(data[i].date).year}
        </text>
      ))}

      {d && (
        <>
          <path
            d={d}
            fill="none"
            stroke={ACCENT}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
            filter="url(#glow)"
          />
          <path d={d} fill="none" stroke={ACCENT} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {tipVal && (
        <>
          <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={11 / zoomFactor} fill={ACCENT} />
          <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={4 / zoomFactor} fill="#fff" />
        </>
      )}

      {waypoints
        .filter((wp) =>
          wp.idx >= i0 ? tipExact >= wp.idx : xDomain[0] <= wp.idx && wp.idx <= xDomain[1]
        )
        .map((wp) => {
          const cx = px(wp.idx, xDomain);
          const cy = py(wp.val, yDomain);
          const anchor = svgAnchor(haFor(wp.idx, xDomain));
          return (
            <React.Fragment key={`wp-${wp.idx}`}>
              <circle cx={cx} cy={cy} r={8 / zoomFactor} fill={ACCENT} />
              <circle cx={cx} cy={cy} r={3 / zoomFactor} fill="#fff" />
              <text
                x={cx}
                y={py(wp.calloutYDate, yDomain)}
                fontSize={24 / zoomFactor}
                fill={TEXT_MUTED}
                textAnchor={anchor}
              >
                {wp.dateLabel}
              </text>
              <text
                x={cx}
                y={py(wp.calloutYValue, yDomain)}
                fontSize={38 / zoomFactor}
                fontWeight={700}
                fill={TEXT_LIGHT}
                textAnchor={anchor}
              >
                {wp.valueLabel}
              </text>
            </React.Fragment>
          );
        })}
    </>
  );
};
