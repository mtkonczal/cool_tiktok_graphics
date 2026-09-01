// Visual system for the vertical (TikTok) chart family.
//
// Every color here is either a token lifted verbatim from mikekonczal.com's
// styles.css or a documented derivation from one, so the videos stay in the
// same system as the site and the newsletter. Contrast ratios are WCAG 2.1
// relative-luminance values against that palette's own ground.
//
// Why the series color is NOT --mk-chart-blue: blue contributes only 7.2% of
// perceived luminance under Rec. 709, so #3067a8 on #0e2c33 is 2.55:1 -- under
// WCAG's 3:1 floor for graphical objects, and the edge then lives almost
// entirely in the chroma channels that H.264 4:2:0 subsamples to half
// resolution. Lightening it 45% in HLS holds the hue to within 0.2 degrees and
// gets 6.10:1, so it still reads as the same blue.

export type Palette = {
  bg: string;
  grid: string;
  text: string;
  dim: string;
  series: string;
  accent: string;
  seriesAlt: string;
};

// seriesAlt: a third categorical color, for the one chart type (grouped bars)
// that needs three data colors instead of two. mikekonczal.com's stylesheet
// has no third token to lift (checked -- just the blue scale plus the one
// hardcoded copper), so this is a documented derivation using the same
// method as `series`/`accent` above: fixed hue (152deg, an emerald green
// clearly distinct from chart-blue's ~213deg and copper's ~27deg), HLS
// lightened for the dark petrol background / darkened for the light paper
// background, searched for a contrast ratio matching this palette's other
// two colors on their own background (petrol ~6:1, paper ~5:1).
export const PETROL: Palette = {
  bg: "#0e2c33",     // --mk-blue-900
  grid: "#1C4A50",   // blue-900 -> blue-500 @ 45%.  1.50:1, recessive on purpose
  text: "#eef3f3",   // --mk-blue-50            13.14:1
  dim: "#6fa3a6",    // --mk-blue-300            5.23:1
  series: "#81AADB", // --mk-chart-blue +45% L    6.10:1
  accent: "#e0a06a", // the site copper           6.59:1  -- used once per frame
  seriesAlt: "#4ebc88", // hue 152, L .52 S .45    6.20:1
};

export const PAPER: Palette = {
  bg: "#eef3f3",     // --mk-blue-50
  grid: "#B5CFD0",   // blue-50 -> blue-300 @ 45%
  text: "#16242a",   // --mk-ink
  dim: "#6a7577",    // --mk-mute
  series: "#3067a8", // --mk-chart-blue, untouched -- it works at full strength on light
  accent: "#9D5518", // copper -45% L; raw copper is only 2.17:1 on this ground
  seriesAlt: "#206f4a", // hue 152, L .28 S .55    5.48:1
};

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
// 40px is the floor for anything read at scroll speed. Two independent
// derivations agree: the ONS publishes a 14px minimum for chart text on the
// web, and a 1080-wide video played full-width on a modern phone is downscaled
// about 2.75x, which puts that floor at 38.5px; broadcast subtitle standards
// independently give 40-60px for body text in a full-frame phone video.
export const TYPE = {
  title: { family: "Newsreader, Georgia, serif", size: 60, weight: 600, tracking: "-0.015em" },
  subtitle: { family: "Inter, system-ui, sans-serif", size: 34, weight: 500 },
  axis: { family: "Inter, system-ui, sans-serif", size: 42, weight: 500 },
  date: { family: "Inter, system-ui, sans-serif", size: 36, weight: 500 },
  value: { family: "Inter, system-ui, sans-serif", size: 46, weight: 800 },
  // Big single-label reveal cards (RipCardReveal) -- large enough to read
  // instantly on a phone, wraps via foreignObject so a longer future label
  // doesn't overflow TEXTSAFE.
  card: { family: "Inter, system-ui, sans-serif", size: 96, weight: 800, lineHeight: 1.15 },
  // Numbered build-up list (RipListReveal) -- smaller than `card` since up to
  // three rows share the page at once.
  listItem: { family: "Inter, system-ui, sans-serif", size: 58, weight: 800, lineHeight: 1.15 },
} as const;

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
