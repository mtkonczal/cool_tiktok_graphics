import { Theme } from "./types";

// The original design this whole chart family launched with -- every color
// traces to a mikekonczal.com token or a documented derivation from one
// (see the comments this was extracted from, src/theme.ts's PETROL/PAPER),
// Newsreader for the headline, Inter for everything else. This is the
// default theme: a spec with no `theme` field gets this, unchanged from
// before themes existed.
export const KONCZAL_WEBPAGE: Theme = {
  id: "konczal_webpage",
  palettes: {
    petrol: {
      bg: "#0e2c33", // --mk-blue-900
      grid: "#1C4A50", // blue-900 -> blue-500 @ 45%.  1.50:1, recessive on purpose
      text: "#eef3f3", // --mk-blue-50            13.14:1
      dim: "#6fa3a6", // --mk-blue-300            5.23:1
      series: "#81AADB", // --mk-chart-blue +45% L    6.10:1
      accent: "#e0a06a", // the site copper           6.59:1  -- used once per frame
      seriesAlt: "#4ebc88", // hue 152, L .52 S .45    6.20:1
    },
    paper: {
      bg: "#eef3f3", // --mk-blue-50
      grid: "#B5CFD0", // blue-50 -> blue-300 @ 45%
      text: "#16242a", // --mk-ink
      dim: "#6a7577", // --mk-mute
      series: "#3067a8", // --mk-chart-blue, untouched -- it works at full strength on light
      accent: "#9D5518", // copper -45% L; raw copper is only 2.17:1 on this ground
      seriesAlt: "#206f4a", // hue 152, L .28 S .55    5.48:1
    },
  },
  type: {
    title: { family: "Newsreader, Georgia, serif", size: 60, weight: 600, tracking: "-0.015em" },
    subtitle: { family: "Inter, system-ui, sans-serif", size: 34, weight: 500 },
    axis: { family: "Inter, system-ui, sans-serif", size: 42, weight: 500 },
    date: { family: "Inter, system-ui, sans-serif", size: 36, weight: 500 },
    value: { family: "Inter, system-ui, sans-serif", size: 46, weight: 800 },
    card: { family: "Inter, system-ui, sans-serif", size: 96, weight: 800, lineHeight: 1.15 },
    listItem: { family: "Inter, system-ui, sans-serif", size: 58, weight: 800, lineHeight: 1.15 },
  },
  marks: {
    latestSolid: false,
  },
};
