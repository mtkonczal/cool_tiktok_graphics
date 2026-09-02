import React from "react";
import { DataRow, chooseYStep, monthDate, py } from "../engine/scales";
import { Unit, fmt, fmtAxis } from "../engine/format";
import { PETROL, Palette, PLOT, ROW, STROKE, TEXTSAFE, TYPE as DEFAULT_TYPE } from "../theme";
import { ThemeType } from "../themes/types";

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
  /** The active theme's type scale (src/themes/) -- defaults to
   * konczal_webpage's, same optional-prop-plus-shadow pattern LineBody/
   * ChartChrome use, so BarVideo becomes theme-aware without touching every
   * TYPE.xxx call site below. */
  type?: ThemeType;
  /** Fill for a bar whose value is negative, for a single-series chart only
   * (e.g. a monthly change that can go either way) -- a grouped multi-series
   * chart's bars are already colored per-series (1st/2nd/3rd estimate) and
   * ignore this. Also ignored when `stacked` is true, for the same reason. */
  negativeColor?: string;
  /** When true (2+ series only -- a single series has nothing to stack),
   * draws one column per group instead of a side-by-side cluster: positive
   * values stack upward from zero in series order, negative values stack
   * downward from zero in series order. This is a diverging stack, not
   * ggplot's naive sequential cumsum -- a negative component gets its own
   * room below the baseline instead of dragging every series above it down
   * with it, so "gains above the line, losses below" stays true even in a
   * mixed-sign month. Each segment's value label sits at its own vertical
   * midpoint (this engine's equivalent of ggplot's
   * `position_stack(vjust = 0.5)`), in `palette.text` with a `palette.bg`
   * halo stroke behind it -- a narrow stacked column (this mode's bars are
   * only 55% of a group's slot, see `barW` below) routinely can't fit a
   * 3-4 digit value plus sign, so the label overflows the segment's edges.
   * A flat `palette.bg`-on-segment fill (this engine's usual on-mark
   * contrast choice) went invisible wherever it overflowed onto the equally
   * dark plot background -- caught by rendering gender-jobs-stacked.json,
   * where Feb's -129 lost its minus sign this way. The halo sidesteps
   * overflow math entirely: on the segment, the dark stroke outlines the
   * light fill; off the segment, the stroke matches the page background and
   * disappears, leaving the light fill contrasting against that same
   * background on its own. */
  stacked?: boolean;
}> = ({ groups, seriesLabels, seriesColors, unit, decimals, revealProgress, palette = PETROL, type = DEFAULT_TYPE, negativeColor, stacked = false }) => {
  const TYPE = type;
  const n = groups.length;
  const signColored = !stacked && seriesLabels.length === 1 && negativeColor !== undefined;

  // Non-stacked: y-domain spans every individual bar's value. Stacked: it
  // spans each group's own positive-stack total and negative-stack total
  // (not the individual values), since that's the actual pixel extent a
  // stacked column reaches.
  let lo = 0,
    hi = 0;
  for (const g of groups) {
    if (stacked) {
      let posSum = 0;
      let negSum = 0;
      for (const v of g.values) {
        if (v === null) continue;
        if (v >= 0) posSum += v;
        else negSum += v;
      }
      if (negSum < lo) lo = negSum;
      if (posSum > hi) hi = posSum;
    } else {
      for (const v of g.values) {
        if (v === null) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
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
  // Stacked: one bar per group, narrower than the full groupInnerFrac slot
  // (a single column at the cluster's width would read as unusually fat
  // compared to every grouped-bar spec elsewhere in this repo).
  const barW = stacked
    ? slotW * groupInnerFrac * 0.55
    : (slotW * groupInnerFrac - barGap * (seriesLabels.length - 1)) / seriesLabels.length;

  // Legend, one row: a swatch + label per series, left-aligned under the
  // title. Sized to fit TEXTSAFE at up to 3 entries with this repo's
  // subtitle type scale. Pulled up close to the title block (was 470, right
  // on top of the x-axis row at 508/538) now that specs commonly drop the
  // subtitle -- leaves clear air above the month-tick row instead of the
  // legend nearly touching it.
  const LEGEND_Y = 390;
  const SWATCH = 30;
  let legendX = TEXTSAFE.x;
  // Skip the legend entirely for a single-series chart -- one swatch
  // restating the one series a title/subtitle already names is clutter,
  // not information. Grouped and stacked charts (2-3 series) keep it.
  const legendEls = seriesLabels.length < 2 ? [] : seriesLabels.map((label, i) => {
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
        // Grows a boundary value's pixel position in from the zero baseline
        // by this group's own reveal progress -- shared by the grouped path
        // (one boundary: the bar's own value) and the stacked path (two
        // boundaries per segment: its cumulative start and end), since both
        // are just "lerp this pixel toward zeroY."
        const pixelLerp = (val: number) => zeroY + (py(val, yDomain) - zeroY) * localProgress;

        if (stacked) {
          const colLeft = PLOT.left + gi * slotW + (slotW - barW) / 2;
          let runningPos = 0;
          let runningNeg = 0;
          return (
            <g key={`bar-${gi}`}>
              {g.values.map((v, si) => {
                if (v === null) return null;
                const from = v >= 0 ? runningPos : runningNeg;
                const to = from + v;
                if (v >= 0) runningPos = to;
                else runningNeg = to;
                const yFrom = pixelLerp(from);
                const yTo = pixelLerp(to);
                const top = Math.min(yFrom, yTo);
                const height = Math.abs(yTo - yFrom);
                const labelY = top + height / 2 + TYPE.value.size * 0.32;
                return (
                  <React.Fragment key={`bar-${gi}-${si}`}>
                    <rect x={colLeft} y={top} width={barW} height={height} fill={seriesColors[si]} rx={3} />
                    {localProgress > 0.85 && height > TYPE.value.size && (
                      <text
                        x={colLeft + barW / 2}
                        y={labelY}
                        fontSize={TYPE.axis.size * 0.68}
                        fontFamily={TYPE.value.family}
                        fontWeight={TYPE.value.weight}
                        fill={palette.text}
                        stroke={palette.bg}
                        strokeWidth={4}
                        strokeLinejoin="round"
                        paintOrder="stroke"
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
        }

        const clusterLeft = PLOT.left + gi * slotW + (slotW - (barW * seriesLabels.length + barGap * (seriesLabels.length - 1))) / 2;

        return (
          <g key={`bar-${gi}`}>
            {g.values.map((v, si) => {
              if (v === null) return null;
              const x = clusterLeft + si * (barW + barGap);
              const y = pixelLerp(v);
              const top = Math.min(y, zeroY);
              const height = Math.abs(y - zeroY);
              const labelY = v >= 0 ? y - 14 : y + TYPE.value.size * 0.7;
              const fill = signColored && v < 0 ? negativeColor! : seriesColors[si];
              return (
                <React.Fragment key={`bar-${gi}-${si}`}>
                  <rect x={x} y={top} width={barW} height={height} fill={fill} rx={3} />
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
