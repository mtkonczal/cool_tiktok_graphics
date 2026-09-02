import { Theme } from "./types";

// "Butter on espresso" -- a warm, dark, serif-headline design: butter-yellow
// line on a warm near-black ground, one hot-orange accent reserved for the
// latest point only. One palette, not a petrol/paper pair (both keys point
// at the same colors below) -- this design doesn't have a light variant.
//
// seriesAlt (a third categorical color, only needed if this theme is ever
// used for a grouped-bar chart) is a documented derivation, same method as
// konczal_webpage's: a teal at hue 185deg -- distinct from butter's ~48deg
// and accent's ~16deg -- HLS-searched for ~6:1 contrast against this warm
// background, matching series/accent/dim's own contrast levels here
// (12.58 / 6.41 / 5.72 respectively).
export const BUTTER_ON_ESPRESSO: Theme = {
  id: "butter_on_espresso",
  palettes: {
    petrol: {
      bg: "#191510", // warm near-black -- not neutral, must read warm
      grid: "#2d271e",
      text: "#f8f2e5", // warm off-white, headline/title            16.28:1
      dim: "#9c8f77", // secondary text -- axis/tick/date labels     5.72:1
      series: "#f5d472", // butter yellow, the line                12.58:1
      accent: "#ff6b35", // hot orange -- the latest point ONLY      6.41:1
      seriesAlt: "#34a7b2", // hue 185, L .45 S .55                  6.35:1
    },
    // No light variant in this design -- "paper" points at the same colors
    // rather than leaving a spec's existing `"palette": "paper"` field
    // (set for a different theme) silently break if it's ever combined
    // with this one.
    paper: {
      bg: "#191510",
      grid: "#2d271e",
      text: "#f8f2e5",
      dim: "#9c8f77",
      series: "#f5d472",
      accent: "#ff6b35",
      seriesAlt: "#34a7b2",
    },
  },
  type: {
    title: { family: "Playfair Display, Georgia, serif", size: 86, weight: 800, lineHeight: 0.98, tracking: "-0.015em" },
    subtitle: { family: "Archivo, system-ui, sans-serif", size: 40, weight: 600, lineHeight: 1.25 },
    axis: { family: "Archivo, system-ui, sans-serif", size: 44, weight: 700 },
    date: { family: "Archivo, system-ui, sans-serif", size: 42, weight: 700 },
    // The source brief distinguishes a 60px peak value from a 66px endpoint
    // value; this engine has one value-label size for every waypoint (no
    // per-waypoint size hook). Neither of those sizes actually fits here:
    // at 66px (checked by rendering jobs-day-unrate, 5 waypoints in a ~22-
    // month window) a "besideDot" label got wide enough to run under a
    // NEIGHBORING waypoint's own dot -- a collision the row-stagger system
    // doesn't model (dots don't compete for rows). 52px rendered clean on
    // that same dense spec (checked) -- still meaningfully bolder than
    // konczal_webpage's 46px Inter, just not the brief's exact number.
    value: { family: "Archivo, system-ui, sans-serif", size: 52, weight: 800 },
    card: { family: "Archivo, system-ui, sans-serif", size: 96, weight: 800, lineHeight: 1.15 },
    listItem: { family: "Archivo, system-ui, sans-serif", size: 58, weight: 800, lineHeight: 1.15 },
  },
  marks: {
    // The endpoint is the news: a solid punched-in orange disc, not another
    // ring in the same family as the peak's.
    latestSolid: true,
  },
};
