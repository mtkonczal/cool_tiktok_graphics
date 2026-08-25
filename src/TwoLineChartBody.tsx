import React from "react";
import { DataRow, Point, buildRuns, chooseYStep, ease, haFor, monthDate, pathD, px, py, svgAnchor, yearStep } from "./chartEngine";
import { MARK, PETROL, Palette, PLOT, ROW, STROKE, TYPE } from "./theme";

// The "two lines, no waypoints" body: each series gets a knockout-stroke line
// (same technique as LineChartBody, which keeps the pair legible where they
// cross -- and these two cross repeatedly), plus a static label parked near
// the midpoint of its own line -- one pinned above, the other below, so the
// pair stays readable even once the two series converge and interleave.
// Labels used to ride the moving reveal tip and glow via a CSS drop-shadow;
// both read as trading-terminal noise on a line that's constantly in motion,
// so labels now sit still and get legibility from a knockout stroke behind
// the text (same technique the lines use against gridlines) instead of a
// blur, matching this project's no-glow rule (theme.ts). They fade in fast,
// well before the line reaches them, rather than tracking its draw-in pace.
export type Series = {
  data: DataRow[];
  label: string;
  color: string;
};

const LABEL_GAP = 92; // clears this series' local wiggle amplitude, unlike the tighter gap LineChartBody uses for smoother series
const LABEL_FADE_FRAC = 0.35; // full opacity by 35% of the reveal -- well ahead of the tip

function nearestValue(data: DataRow[], idx: number): number | null {
  for (let d = 0; d < data.length; d++) {
    const lo = idx - d, hi = idx + d;
    if (lo >= 0 && data[lo].value !== null) return data[lo].value;
    if (hi < data.length && data[hi].value !== null) return data[hi].value;
  }
  return null;
}

export const TwoLineChartBody: React.FC<{
  seriesA: Series;
  seriesB: Series;
  xDomain: [number, number];
  yDomain: [number, number];
  i0: number;
  tipExact: number;
  palette?: Palette;
}> = ({ seriesA, seriesB, xDomain, yDomain, i0, tipExact, palette = PETROL }) => {
  const data = seriesA.data; // both series share one date grid
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

  const lastIdx = data.length - 1;
  const atLatest = tipExact >= lastIdx - 1e-9;
  const frac = ease(Math.min(Math.max(tipExact / lastIdx, 0), 1));

  const renderLine = (s: Series): { el: React.ReactNode; tipVal: Point | null } => {
    const { runs, tipVal } = buildRuns(s.data, i0, tipExact);
    const d = pathD(runs, xDomain, yDomain);
    const el = (
      <React.Fragment key={s.label}>
        {d && (
          <>
            <path d={d} fill="none" stroke={palette.bg} strokeWidth={STROKE.knockout} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={s.color} strokeWidth={STROKE.series} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        {tipVal && !atLatest && (
          <>
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypoint + 2} fill={s.color} />
            <circle cx={px(tipVal[0], xDomain)} cy={py(tipVal[1], yDomain)} r={MARK.waypointCore} fill={palette.bg} />
          </>
        )}
      </React.Fragment>
    );
    return { el, tipVal };
  };

  const labelIdx = Math.round((iLo + iHi) / 2);
  const labelOpacity = Math.min(frac / LABEL_FADE_FRAC, 1);

  const renderLabel = (s: Series, side: "above" | "below") => {
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
        fill={s.color}
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
              {`${yv / 1000}M`}
            </text>
          </React.Fragment>
        );
      })}

      {/* x-axis, above the plot -- same convention as LineChartBody */}
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
            {`’${String(monthDate(data[i].date).year).slice(2)}`}
          </text>
        </React.Fragment>
      ))}

      {(() => {
        const lineA = renderLine(seriesA);
        const lineB = renderLine(seriesB);
        return (
          <>
            {lineA.el}
            {lineB.el}
            {/* one label pinned above its own line, the other below -- so the
                pair stays legible once the two lines converge and interleave */}
            {renderLabel(seriesB, "above")}
            {renderLabel(seriesA, "below")}
          </>
        );
      })()}
    </>
  );
};
