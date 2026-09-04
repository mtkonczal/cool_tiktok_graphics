import React from "react";
import { PETROL, Palette, PLOT, STROKE, TYPE as DEFAULT_TYPE } from "../theme";
import { ThemeType } from "../themes/types";

// The category-diverging-bar body: one horizontal bar per named category
// (not per time period), diverging left/right from a shared zero line,
// revealed top to bottom. A genuinely different shape from BarBody's
// vertical time-axis bars -- CLAUDE.md Section 11/12's "bespoke escape
// hatch" reasoning: this doesn't reuse BarBody's slot math (categorical rows
// instead of month columns) or engine/scales.ts's px() (that's a
// continuous-date x-scale; this chart's x-scale is a signed value domain
// with asymmetric left/right padding, sized once from every category's own
// value, not from a date range).
export type CategoryBar = {
  label: string;
  value: number;
};

export const CategoryBarBody: React.FC<{
  categories: CategoryBar[];
  /** Fractional reveal progress in [0, categories.length] -- integer part
   * is how many rows (top to bottom) are fully grown, fractional part is
   * the currently-animating row's own grow-in progress (already eased by
   * the caller, same convention as BarBody's revealProgress). */
  revealProgress: number;
  palette?: Palette;
  type?: ThemeType;
}> = ({ categories, revealProgress, palette = PETROL, type = DEFAULT_TYPE }) => {
  const TYPE = type;
  const n = categories.length;

  // Asymmetric signed x-domain, one shared px-per-unit scale for both
  // directions (not two independently-scaled halves, which would misrepresent
  // relative magnitudes) -- mirrors BLS-CPS-Jobs-Numbers/14_tiktok_verticals.R's
  // own x_left/x_right padding idea (room for the category label + value text
  // on whichever side has bars), ported from ggplot's continuous scale to
  // this engine's own px().
  const posVals = categories.map((c) => c.value).filter((v) => v > 0);
  const negVals = categories.map((c) => c.value).filter((v) => v < 0);
  const maxPos = posVals.length ? Math.max(...posVals) : 0;
  const maxNeg = negVals.length ? Math.max(...negVals.map((v) => -v)) : 0;
  const domainLeft = maxNeg > 0 ? -maxNeg * 1.65 : -1;
  const domainRight = maxPos > 0 ? maxPos * 1.55 : 1;
  const px = (v: number) => PLOT.left + ((v - domainLeft) / (domainRight - domainLeft)) * (PLOT.right - PLOT.left);
  const zeroX = px(0);

  const rowH = (PLOT.bottom - PLOT.top) / n;
  const barH = Math.min(96, rowH * 0.42);
  const labelGap = 34; // space between the category label's baseline and the bar top

  return (
    <>
      <line x1={zeroX} y1={PLOT.top - 10} x2={zeroX} y2={PLOT.bottom + 10} stroke={palette.dim} strokeWidth={STROKE.tick} />

      {categories.map((c, ci) => {
        const revealed = ci < Math.floor(revealProgress);
        const animating = ci === Math.floor(revealProgress);
        if (!revealed && !animating) return null;
        const localProgress = revealed ? 1 : revealProgress - ci;

        const rowTop = PLOT.top + ci * rowH;
        const barTop = rowTop + labelGap + 14;
        const barCenter = barTop + barH / 2;

        const targetX = px(c.value);
        const currentX = zeroX + (targetX - zeroX) * localProgress;
        const left = Math.min(zeroX, currentX);
        const width = Math.abs(currentX - zeroX);
        const fill = c.value >= 0 ? palette.series : palette.accent;

        const valueLabel = `${c.value >= 0 ? "+" : ""}${c.value}k`;
        const labelPastTip = c.value >= 0 ? currentX + 18 : currentX - 18;
        const labelAnchor = c.value >= 0 ? "start" : "end";

        return (
          <g key={c.label}>
            <text
              x={PLOT.left}
              y={rowTop + labelGap}
              fontSize={TYPE.axis.size}
              fontFamily={TYPE.axis.family}
              fontWeight={TYPE.axis.weight}
              fill={palette.text}
            >
              {c.label}
            </text>
            <rect x={left} y={barTop} width={width} height={barH} fill={fill} rx={3} />
            {localProgress > 0.85 && (
              <text
                x={labelPastTip}
                y={barCenter + TYPE.value.size * 0.32}
                fontSize={TYPE.value.size * 0.72}
                fontFamily={TYPE.value.family}
                fontWeight={TYPE.value.weight}
                fill={palette.text}
                textAnchor={labelAnchor}
                opacity={(localProgress - 0.85) / 0.15}
              >
                {valueLabel}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
};
