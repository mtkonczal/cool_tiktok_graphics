// A "theme" is a swappable visual design for the chart family: palette +
// type. Deliberately NOT layout/geometry (ROW/PLOT row positions, stroke
// widths, waypoint collision-avoidance constants) -- those were tuned
// through many rendered-and-checked iterations for this engine's specific
// proportions (src/theme.ts's ROW/PLOT/STROKE/MARK, and the tuning
// constants in bodies/LineBody.tsx), and stay shared across every theme
// rather than being re-tuned per design. What a theme actually swaps —
// color and typeface — is also where a design brief's own identity mostly
// lives, and swapping only that keeps this addition low-risk: every
// existing collision/positioning fix earlier in this project's history
// still applies unchanged to a new theme's frames.
//
// See src/themes/index.ts for the registry and resolver, and
// src/themes/konczal_webpage.ts for the theme this list started from
// (extracted from theme.ts's original fixed PETROL/PAPER + TYPE, unchanged
// in value) -- copy that file's shape for a new theme.

export type Palette = {
  bg: string;
  grid: string;
  text: string;
  dim: string;
  series: string;
  accent: string;
  seriesAlt: string;
};

export type ThemeTypeSpec = {
  family: string;
  size: number;
  weight: number;
  lineHeight?: number;
  tracking?: string;
};

export type ThemeType = {
  title: ThemeTypeSpec;
  subtitle: ThemeTypeSpec;
  axis: ThemeTypeSpec;
  date: ThemeTypeSpec;
  value: ThemeTypeSpec;
  card: ThemeTypeSpec;
  listItem: ThemeTypeSpec;
};

export type Theme = {
  id: string;
  /** Same "petrol"/"paper" choice a spec's own `palette` field already
   * makes (src/compositions/LineVideo.tsx) -- a theme that only has one
   * real palette (no separate light variant) just points both keys at it. */
  palettes: { petrol: Palette; paper: Palette };
  type: ThemeType;
  marks: {
    /** false (default): the "latest" waypoint dot renders the same way
     * every other one does -- a solid ring with a bg-colored hole in the
     * middle (accent-colored instead of series-colored, which is what
     * already carries the "this one's different" signal). true: it's a
     * solid accent-filled disc with a thin bg-colored border instead --
     * for a design that wants the endpoint to read as a punched-in dot,
     * not another ring in the same family as every other waypoint. */
    latestSolid: boolean;
  };
};
