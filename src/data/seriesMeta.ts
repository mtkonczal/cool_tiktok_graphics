// Typed access to the repo-root data/series.json registry -- the single
// source of truth for a series' title/subtitle/unit/decimals (data/fetch.R
// reads the same file to know what to pull from FRED). Specs reference a
// series by name and can say chrome.title: "auto" to pull it from here
// instead of repeating the copy in every spec file.
import registry from "../../data/series.json";
import { Unit } from "../engine/format";

export type SeriesMeta = {
  source: "fred" | "derived";
  units: Unit;
  decimals: number;
  title: string;
  subtitle: string;
  note?: string;
};

const REGISTRY = registry as Record<string, SeriesMeta>;

export function seriesMeta(ref: string): SeriesMeta {
  const meta = REGISTRY[ref];
  if (!meta) throw new Error(`seriesMeta: unknown series ref "${ref}" -- is it in data/series.json?`);
  return meta;
}
