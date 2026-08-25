// Static lookup from a data/series.json registry name to its fetched rows.
// Static imports, not a dynamic require(`./${name}.json`) -- Remotion's
// bundler needs a literal module graph, and this is the one file that has to
// change when data/fetch.R adds a new series.
import primeEpop from "./prime_epop.json";
import unrate from "./unrate.json";
import unemployed from "./unemployed.json";
import openings from "./openings.json";
import vuRatio from "./vu_ratio.json";
import { DataRow } from "../engine/scales";

export const SERIES_DATA: Record<string, DataRow[]> = {
  prime_epop: primeEpop as DataRow[],
  unrate: unrate as DataRow[],
  unemployed: unemployed as DataRow[],
  openings: openings as DataRow[],
  vu_ratio: vuRatio as DataRow[],
};

export function seriesData(ref: string): DataRow[] {
  const data = SERIES_DATA[ref];
  if (!data) throw new Error(`seriesData: unknown series ref "${ref}" -- is it in data/series.json?`);
  return data;
}
