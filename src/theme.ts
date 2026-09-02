// Visual system for the vertical (TikTok) chart family.
//
// Palette and type scale moved to src/themes/ (Phase: swappable themes) --
// `PETROL`/`PAPER`/`TYPE` below just re-export the "konczal_webpage" theme's
// values, so every consumer that isn't theme-aware yet (BarBody, ChartChrome
// for non-LineVideo callers, RipCard/ListReveal) keeps working unchanged.
// LineVideo/LineBody resolve a spec's own `theme` field instead of importing
// these directly -- see src/themes/index.ts's resolveTheme and
// src/themes/konczal_webpage.ts for where these values actually live now.
//
// Everything else below (FRAME/SAFE/TEXTSAFE/ROW/PLOT/STROKE/MARK) is NOT
// theme-swappable -- it's shared geometry tuned through many rendered-and-
// checked iterations (collision avoidance, safe zones, the axis-above-plot
// rhythm), not a per-design color/type choice. See src/themes/types.ts's
// Theme type comment for why the split lands there.
import { KONCZAL_WEBPAGE } from "./themes/konczal_webpage";

export type { Palette } from "./themes/types";
export const PETROL = KONCZAL_WEBPAGE.palettes.petrol;
export const PAPER = KONCZAL_WEBPAGE.palettes.paper;

// ── Frame geometry ────────────────────────────────────────────────────────
// TikTok publishes no pixel safe zone and notes that safe area shrinks as
// caption length grows. These are a conservative consensus across third-party
// measurements: the tab bar owns the top 160, the caption block / music ticker
// / scrubber / nav bar own the bottom 480, and the action rail owns the right
// 140. Nothing load-bearing goes outside TEXTSAFE.

export const FRAME = { width: 1080, height: 1920 } as const;
export const SAFE = { x: 60, y: 160, w: 880, h: 1360 } as const;
export const TEXTSAFE = { x: 88, y: 200, w: 812, h: 1240 } as const;

// Vertical rhythm. The x-axis sits ABOVE the plot: it buys no height (840px
// either way) but the year labels stop sharing a neighborhood with a caption
// block that expands upward when tapped. Time axes only -- a scatter or a
// distribution keeps its x-axis at the bottom, where a top axis reads as a bug.
export const ROW = {
  title: 300,
  sub1: 364,
  sub2: 408,
  xaxisLabel: 508,
  xaxisRule: 538,
  xaxisTick: 20,
  // A two-line x-axis tick (month above, year below -- engine/scales.ts's
  // xAxisTicks) stacks upward from xaxisLabel by this much per extra line,
  // so every tick's bottom line still lands at xaxisLabel regardless of how
  // many lines it has.
  xaxisLabelLineHeight: 38,
} as const;

export const PLOT = { left: 150, right: 898, top: 640, bottom: 1420 } as const;

// ── Type ──────────────────────────────────────────────────────────────────
// 40px is the floor for anything read at scroll speed (two independent
// derivations agree: the ONS's 14px web minimum scaled up by a 1080-wide
// video's ~2.75x downscale on a phone puts that floor at 38.5px; broadcast
// subtitle standards independently give 40-60px for body text in a full-
// frame phone video) -- konczal_webpage's own sizes below clear it, but a
// different theme's type scale is its own call, not enforced here.
export const TYPE = KONCZAL_WEBPAGE.type;

// Without tabular figures an animating number shudders as glyph widths change.
export const TABULAR = { fontVariantNumeric: "tabular-nums lining-nums" } as const;

// ── Marks ─────────────────────────────────────────────────────────────────
// No glow filter. The knockout stroke (the path drawn twice, first at 2x width
// in the background color) does the real job -- keeping the line legible where
// it crosses gridlines -- without the trading-terminal register.
export const STROKE = {
  series: 11,
  knockout: 21,
  grid: 2.5,
  tick: 3,
  dash: "14 12",
} as const;

export const MARK = {
  waypoint: 13,
  waypointCore: 5,
} as const;

// Waypoint marks shrink with zoomFactor all the way down (a dot reads fine
// small), but label text divides by min(zoomFactor, this) instead -- at the
// ~4.2x zoom of the full 1995-present view, dividing straight by zoomFactor
// put date/value callouts around 9-11px, unreadable on a phone-scaled video.
export const MAX_LABEL_SHRINK = 1.8;
