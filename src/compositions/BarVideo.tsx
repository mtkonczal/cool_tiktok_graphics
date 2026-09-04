import React from "react";
import { useCurrentFrame } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import "../fonts";
import { ChartChrome } from "../ChartChrome";
import { BarBody, BarRegime, monthGroupsFromSeries } from "../bodies/BarBody";
import { alignToGrid, ease } from "../engine/scales";
import { resolveIndex } from "../engine/waypoints";
import { seriesData } from "../data/registry";
import { seriesMeta } from "../data/seriesMeta";
import { FRAME, Palette } from "../theme";
import { resolveTheme } from "../themes";

export const FPS = 30;

// A grouped-bar reveal -- the categorical counterpart to LineVideo, for data
// that is fundamentally "N values per period" rather than one continuous
// series (e.g. a month's 1st/2nd/3rd BLS payroll print). See CLAUDE.md
// Section 11: this exists because LineBody genuinely cannot draw this shape,
// not because a line spec was bent to fake it. Deliberately a much smaller
// grammar than LineSpec's shots/waypoints/annotations -- one reveal, group by
// group, left to right, then a hold. Add features here only when a real
// bar-chart video needs them, not preemptively to mirror LineSpec's surface.
export type BarSeriesSpec = { ref: string; label: string };

export type BarSpec = {
  id: string;
  type: "bar";
  chrome?: { title?: string; subtitle?: string };
  palette?: "petrol" | "paper";
  /** Theme id (src/themes/), same field/registry/resolver LineSpec uses --
   * defaults to konczal_webpage (src/themes/index.ts's resolveTheme) when
   * omitted, so every bar spec written before this existed still renders
   * exactly as it did before. */
  theme?: string;
  /** 1-3 series, plotted as one bar per series per period, grouped by date.
   * A single series colors each bar by sign instead (see BarBody's
   * `negativeColor`) rather than showing a redundant one-swatch legend --
   * 2-3 series draw grouped bars with a per-series legend, unchanged. All
   * series must share the same underlying date grid (aligned the same way
   * LineVideo aligns a secondary series onto the primary's). */
  series: BarSeriesSpec[];
  /** When true, 2+ series stack into one bar per period instead of sitting
   * side by side (grouped, the default) -- e.g. men/women as the two signed
   * components of one month's total nonfarm change. Positive values stack
   * upward from zero in series order, negative values stack downward from
   * zero in series order (not a naive sequential cumsum, which would let a
   * negative component run the stack below an already-negative baseline) --
   * so the bar's total shape still reads as "gains above the line, losses
   * below," even in a month where one series is negative. Ignored (grouped
   * rendering, unchanged) for a single-series spec, where there's nothing to
   * stack -- see BarBody's `stacked` prop. */
  stacked?: boolean;
  /** [start, end] -- literal dates or "latest", one bar-group per month in
   * this range. No relative tokens: a bar spec's window IS what's on screen,
   * there is no separate zoomed/panned view like a line spec's shots have. */
  window: [string, string];
  /** Single-series only, mutually exclusive with sign-coloring (BarBody's
   * `negativeColor` path is skipped when this is set): colors each bar by
   * which era/regime its date falls in, rather than by its own sign, and
   * draws a colored average-value bracket above the plot for each one. Each
   * regime's average is computed fresh at render time over its own date
   * window (literal dates or "latest" for the open-ended end), so it stays
   * right as new months arrive -- same self-correcting idea as a LineSpec
   * hline's "mean:TOKEN..TOKEN" (CLAUDE.md Section 6), just for a bar chart.
   * Regimes should cover the spec's full window with no gaps; a date not
   * covered by any regime keeps the ordinary series color. */
  regimes?: {
    window: [string, string];
    /** Which palette color this era's bars + bracket use. */
    color: "series" | "accent" | "seriesAlt";
    /** Suffix after the computed average, e.g. "92k" + " a month". */
    suffix: string;
  }[];
  /** Dates (within a regime) to render in a muted neutral color instead of
   * their regime's color -- e.g. a single bad print that would otherwise
   * look like part of a "good" run. Still counted in that regime's own
   * average; this only changes the bar's fill. */
  muteDates?: string[];
  /** Total time to reveal every group, left to right. */
  revealSeconds: number;
  /** Time to hold on the fully-revealed chart before the video ends. */
  holdSeconds: number;
};

export function barSpecDurationSeconds(spec: BarSpec): number {
  return spec.revealSeconds + spec.holdSeconds;
}

export const calculateBarMetadata: CalculateMetadataFunction<BarSpec> = async ({ props }) => ({
  durationInFrames: Math.round(FPS * barSpecDurationSeconds(props)),
  fps: FPS,
  width: FRAME.width,
  height: FRAME.height,
});

export const BarVideo: React.FC<BarSpec> = (spec) => {
  const frame = useCurrentFrame();
  // resolveTheme(undefined) is konczal_webpage, whose palettes ARE the
  // PETROL/PAPER constants below -- so this one line covers both the
  // theme-aware and theme-less cases without a branch.
  const theme = resolveTheme(spec.theme);
  const palette: Palette = spec.palette === "paper" ? theme.palettes.paper : theme.palettes.petrol;

  const refs = spec.series.map((s) => s.ref);
  const rawByRef = refs.map((ref) => seriesData(ref));
  const dataByRef = rawByRef.map((data, i) => (i === 0 ? data : alignToGrid(rawByRef[0], data)));
  const primaryData = dataByRef[0];
  const primaryMeta = seriesMeta(refs[0]);

  const i0 = resolveIndex(primaryData, spec.window[0]);
  const i1 = resolveIndex(primaryData, spec.window[1]);
  const groups = monthGroupsFromSeries(dataByRef, i0, i1);
  const n = groups.length;

  const t = frame / FPS;
  const revealFrac = Math.min(Math.max(t / spec.revealSeconds, 0), 1);
  // Ease each group's own grow-in, not the overall sweep -- eases the integer
  // part's boundary crossing (revealFrac * n) smoothly like buildRuns' tip
  // does for a line, not just the fractional part within one group.
  const raw = revealFrac * n;
  const wholeGroups = Math.floor(raw);
  const localT = raw - wholeGroups;
  const revealProgress = Math.min(wholeGroups + ease(localT), n);

  const seriesColors = [palette.series, palette.seriesAlt, palette.accent];

  // Regimes: resolve each one's own date window down to group-array indices
  // (groups[0] is spec.window[0], i.e. raw index i0), compute its average
  // over the raw data (including any muted date -- muting only changes a
  // bar's color, not the math), and build the per-bar color override array
  // BarBody actually draws from.
  const resolvedRegimes: BarRegime[] | undefined = spec.regimes?.map((r) => {
    const rawI0 = resolveIndex(primaryData, r.window[0], { i0, i1 });
    const rawI1 = resolveIndex(primaryData, r.window[1], { i0, i1 });
    let sum = 0;
    let count = 0;
    for (let idx = rawI0; idx <= rawI1; idx++) {
      const v = primaryData[idx]?.value;
      if (v !== null && v !== undefined) {
        sum += v;
        count++;
      }
    }
    const avg = count > 0 ? Math.round(sum / count) : 0;
    return {
      i0: rawI0 - i0,
      i1: rawI1 - i0,
      label: `${avg}k ${r.suffix}`,
      color: palette[r.color],
    };
  });

  const muteDateSet = new Set(spec.muteDates ?? []);
  const barColors: (string | undefined)[] | undefined = resolvedRegimes
    ? groups.map((_, gi) => {
        const rawIdx = gi + i0;
        if (muteDateSet.has(primaryData[rawIdx].date)) return palette.dim;
        const regime = resolvedRegimes.find((r) => gi >= r.i0 && gi <= r.i1);
        return regime?.color;
      })
    : undefined;

  const title = spec.chrome?.title ?? primaryMeta.title;
  const subtitle = spec.chrome?.subtitle ?? primaryMeta.subtitle;
  // No subtitle leaves a bare title with nothing under it until the tick
  // row -- pull the tick row up to close most of that gap. A legend (2+
  // series) already fills some of that space on its own, so it needs less
  // closing than a single-series chart with nothing between title and axis.
  const topOffset = subtitle ? 0 : spec.series.length >= 2 ? 50 : 90;

  return (
    <ChartChrome title={title} subtitle={subtitle} palette={palette} type={theme.type}>
      <BarBody
        groups={groups}
        seriesLabels={spec.series.map((s) => s.label)}
        seriesColors={seriesColors}
        unit={primaryMeta.units}
        decimals={primaryMeta.decimals}
        revealProgress={revealProgress}
        palette={palette}
        type={theme.type}
        negativeColor={palette.accent}
        barColors={barColors}
        regimes={resolvedRegimes}
        stacked={spec.stacked}
        topOffset={topOffset}
      />
    </ChartChrome>
  );
};
