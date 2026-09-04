import React from "react";
import { useCurrentFrame } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import "../fonts";
import { ChartChrome } from "../ChartChrome";
import { CategoryBarBody } from "../bodies/CategoryBarBody";
import { ease, monthDate } from "../engine/scales";
import { resolveIndex } from "../engine/waypoints";
import { seriesData } from "../data/registry";
import { FRAME, Palette } from "../theme";
import { resolveTheme } from "../themes";

export const FPS = 30;

const MONTH_FULL = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// A category-by-category snapshot for one month -- "how did different parts
// of the economy do this release," not a time series. See CategoryBarBody
// for why this is its own composition (CLAUDE.md Section 11/12): a
// categorical y-axis with a top-to-bottom reveal is a different shape from
// both LineVideo's continuous draw and BarVideo's left-to-right month sweep.
export type CategoryBarSeriesSpec = { ref: string; label: string };

export type CategoryBarSpec = {
  id: string;
  type: "category-bar";
  chrome?: { title?: string; subtitle?: string };
  palette?: "petrol" | "paper";
  theme?: string;
  /** 2-6 categories, top to bottom in this order. Each resolves to its own
   * series' latest value at render time -- not literal numbers in the spec
   * -- so re-rendering after a fresh fetch always shows the current release,
   * never a stale hand-typed figure. */
  categories: CategoryBarSeriesSpec[];
  /** Total time to reveal every row, top to bottom. */
  revealSeconds: number;
  /** Time to hold on the fully-revealed chart before the video ends. */
  holdSeconds: number;
};

export function categoryBarSpecDurationSeconds(spec: CategoryBarSpec): number {
  return spec.revealSeconds + spec.holdSeconds;
}

export const calculateCategoryBarMetadata: CalculateMetadataFunction<CategoryBarSpec> = async ({ props }) => ({
  durationInFrames: Math.round(FPS * categoryBarSpecDurationSeconds(props)),
  fps: FPS,
  width: FRAME.width,
  height: FRAME.height,
});

export const CategoryBarVideo: React.FC<CategoryBarSpec> = (spec) => {
  const frame = useCurrentFrame();
  const theme = resolveTheme(spec.theme);
  const palette: Palette = spec.palette === "paper" ? theme.palettes.paper : theme.palettes.petrol;

  const resolved = spec.categories.map((c) => {
    const data = seriesData(c.ref);
    const idx = resolveIndex(data, "latest");
    return { label: c.label, value: Math.round(data[idx].value as number), date: data[idx].date };
  });
  const n = resolved.length;

  const t = frame / FPS;
  const revealFrac = Math.min(Math.max(t / spec.revealSeconds, 0), 1);
  const raw = revealFrac * n;
  const wholeRows = Math.floor(raw);
  const localT = raw - wholeRows;
  const revealProgress = Math.min(wholeRows + ease(localT), n);

  const asOf = monthDate(resolved[0].date);
  const title = spec.chrome?.title ?? `Job Growth, ${MONTH_FULL[asOf.month]} ${asOf.year}`;
  const subtitle = spec.chrome?.subtitle ?? "Thousands of jobs.";

  return (
    <ChartChrome title={title} subtitle={subtitle} palette={palette} type={theme.type}>
      <CategoryBarBody
        categories={resolved}
        revealProgress={revealProgress}
        palette={palette}
        type={theme.type}
      />
    </ChartChrome>
  );
};
