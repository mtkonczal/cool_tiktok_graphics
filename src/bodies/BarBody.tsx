import React from "react";
import { DataRow, chooseYStep, monthDate, py } from "../engine/scales";
import { Unit, fmt, fmtAxis } from "../engine/format";
import { PETROL, Palette, PLOT, ROW, STROKE, TEXTSAFE, TYPE } from "../theme";

// The grouped-bar body: N month-groups, each holding 2-3 bars (e.g. 1st/2nd/
// 3rd BLS estimate), revealed group-by-group left to right -- the categorical
// analogue of LineBody's continuous draw-in. Bars share the line family's
// PLOT box and axis-above-plot convention (theme.ts ROW/PLOT) so a bar video
// sits in the same visual rhythm as every other chart here, but the x-axis is
// categorical (one tick per month) rather than a continuous date scale, so it
// does not reuse engine/scales.ts's px()/pathD() -- those are index-space and
// line-specific.
export type BarGroup = {
  label: string; // x-axis tick, e.g. "Jan"
  values: (number | null)[]; // one per series, same order as `seriesLabels`/`seriesColors`
};

const MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthGroupsFromSeries(dataByRef: DataRow[][], i0: number, i1: number): BarGroup[] {
  const groups: BarGroup[] = [];
  for (let i = i0; i <= i1; i++) {
    const { month } = monthDate(dataByRef[0][i].date);
    groups.push({
      label: MONTH_ABBR[month],
      values: dataByRef.map((data) => data[i]?.value ?? null),
    });
  }
  return groups;
}

export const BarBody: React.FC<{
  groups: BarGroup[];
  seriesLabels: string[];
  seriesColors: string[];
  unit: Unit;
  decimals: number;
  /** Fractional reveal progress in [0, groups.length] -- integer part is how
   * many groups are fully shown, the fractional part is the currently
   * animating group's grow-in progress (already eased by the caller). */
  revealProgress: number;
  palette?: Palette;
}> = ({ groups, seriesLabels, seriesColors, unit, decimals, revealProgress, palette = PETROL }) => {
  const n = groups.length;

  let lo = 0,
    hi = 0;
  for (const g of groups) {
    for (const v of g.values) {
      if (v === null) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = hi - lo || 1;
  const pad = span * 0.22;
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const yStep = chooseYStep(yDomain);
  const yTicks: number[] = [];
  for (let yv = Math.ceil(yDomain[0] / yStep) * yStep; yv <= yDomain[1]; yv += yStep) yTicks.push(yv);
  const zeroY = py(0, yDomain);

  const slotW = (PLOT.right - PLOT.left) / n;
  const groupInnerFrac = 0.88; // fraction of a slot the bar cluster occupies, rest is inter-group gap
  const barGap = 5;
  const barW = (slotW * groupInnerFrac - barGap * (seriesLabels.length - 1)) / seriesLabels.length;

  // Legend, one row: a swatch + label per series, left-aligned under the
  // title. Sized to fit TEXTSAFE at up to 3 entries with this repo's
  // subtitle type scale. Pulled up close to the title block (was 470, right
  // on top of the x-axis row at 508/538) now that specs commonly drop the
  // subtitle -- leaves clear air above the month-tick row instead of the
  // legend nearly touching it.
  const LEGEND_Y = 390;
  const SWATCH = 30;
  let legendX = TEXTSAFE.x;
  const legendEls = seriesLabels.map((label, i) => {
    const textW = label.length * TYPE.subtitle.size * 0.56;
    const el = (
      <React.Fragment key={label}>
        <rect x={legendX} y={LEGEND_Y - SWATCH * 0.75} width={SWATCH} height={SWATCH} rx={4} fill={seriesColors[i]} />
        <text
          x={legendX + SWATCH + 14}
          y={LEGEND_Y}
          fontFamily={TYPE.subtitle.family}
          fontSize={TYPE.subtitle.size}
          fontWeight={TYPE.subtitle.weight}
          fill={palette.text}
        >
          {label}
        </text>
      </React.Fragment>
    );
    legendX += SWATCH + 14 + textW + 56;
    return el;
  });

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
              {fmtAxis(unit, yv)}
            </text>
          </React.Fragment>
        );
      })}

      {/* zero baseline, heavier than the other gridlines -- bars grow from here */}
      <line x1={PLOT.left} y1={zeroY} x2={PLOT.right} y2={zeroY} stroke={palette.dim} strokeWidth={STROKE.tick} />

      {/* x-axis month ticks, above the plot per this repo's time-axis convention */}
      <line x1={PLOT.left} y1={ROW.xaxisRule} x2={PLOT.right} y2={ROW.xaxisRule} stroke={palette.grid} strokeWidth={STROKE.grid} />
      {groups.map((g, i) => {
        const cx = PLOT.left + (i + 0.5) * slotW;
        return (
          <React.Fragment key={`x-${i}`}>
            <line x1={cx} y1={ROW.xaxisRule} x2={cx} y2={ROW.xaxisRule + ROW.xaxisTick} stroke={palette.grid} strokeWidth={STROKE.tick} />
            <text
              x={cx}
              y={ROW.xaxisLabel}
              fontSize={TYPE.axis.size}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.dim}
              textAnchor="middle"
            >
              {g.label}
            </text>
          </React.Fragment>
        );
      })}

      {legendEls}

      {/* bars */}
      {groups.map((g, gi) => {
        const revealed = gi < Math.floor(revealProgress);
        const animating = gi === Math.floor(revealProgress);
        if (!revealed && !animating) return null;
        const localProgress = revealed ? 1 : revealProgress - gi;

        const clusterLeft = PLOT.left + gi * slotW + (slotW - (barW * seriesLabels.length + barGap * (seriesLabels.length - 1))) / 2;

        return (
          <g key={`bar-${gi}`}>
            {g.values.map((v, si) => {
              if (v === null) return null;
              const x = clusterLeft + si * (barW + barGap);
              const fullY = py(v, yDomain);
              const y = zeroY + (fullY - zeroY) * localProgress;
              const top = Math.min(y, zeroY);
              const height = Math.abs(y - zeroY);
              const labelY = v >= 0 ? y - 14 : y + TYPE.value.size * 0.7;
              return (
                <React.Fragment key={`bar-${gi}-${si}`}>
                  <rect x={x} y={top} width={barW} height={height} fill={seriesColors[si]} rx={3} />
                  {localProgress > 0.85 && (
                    <text
                      x={x + barW / 2}
                      y={labelY}
                      fontSize={TYPE.axis.size * 0.68}
                      fontFamily={TYPE.value.family}
                      fontWeight={TYPE.value.weight}
                      fill={palette.text}
                      textAnchor="middle"
                      opacity={(localProgress - 0.85) / 0.15}
                    >
                      {fmt(unit, v, decimals)}
                    </text>
                  )}
                </React.Fragment>
              );
            })}
          </g>
        );
      })}
    </>
  );
};
