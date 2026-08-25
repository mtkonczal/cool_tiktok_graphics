// Shared geometry engine for the line-chart family: scales, easing, gap
// handling, and axis tick selection. Ported directly from the HTML/Playwright
// prototype (chart_template.html) -- same math, typed and split so future
// chart types (bar/scatter/table/histogram) can share the palette, layout,
// and easing helpers below without sharing this file's line-specific logic.
//
// Split out of chartEngine.ts in Phase 2: waypoint callouts (Waypoint,
// makeWaypoints, resolveIndex) moved to engine/waypoints.ts, since those are
// specifically about picking and labeling points, not about scales.

export { PLOT } from "../theme";
import { PLOT } from "../theme";

export type DataRow = { date: string; value: number | null };
export type Point = [number, number]; // [index, value]

export function px(idx: number, xDomain: [number, number]): number {
  return PLOT.left + ((idx - xDomain[0]) / (xDomain[1] - xDomain[0])) * (PLOT.right - PLOT.left);
}
export function py(val: number, yDomain: [number, number]): number {
  return PLOT.bottom - ((val - yDomain[0]) / (yDomain[1] - yDomain[0])) * (PLOT.bottom - PLOT.top);
}
export function ease(t: number): number {
  return 3 * t * t - 2 * t * t * t;
}

function isMissing(v: number | null): v is null {
  return v === null || Number.isNaN(v as number);
}

export function dataMaxAndPad(data: DataRow[], i0: number, i1: number, padFrac = 0.15) {
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const v = data[i].value;
    if (isMissing(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { max: hi, pad: (hi - lo) * padFrac };
}

export function ylimFor(data: DataRow[], i0: number, i1: number, padFrac = 0.15): [number, number] {
  const { max, pad } = dataMaxAndPad(data, i0, i1, padFrac);
  let lo = Infinity;
  for (let i = i0; i <= i1; i++) {
    const v = data[i].value;
    if (!isMissing(v) && v < lo) lo = v;
  }
  return [lo - pad, max + pad];
}

// Multi-series variants: the y-domain for a 2+ line chart has to span every
// line, not just the first (a domain sized to only the primary series would
// clip a second series that runs higher or lower).
export function dataMaxAndPadMulti(dataArrays: DataRow[][], i0: number, i1: number, padFrac = 0.15) {
  let lo = Infinity, hi = -Infinity;
  for (const data of dataArrays) {
    for (let i = i0; i <= i1; i++) {
      const v = data[i].value;
      if (isMissing(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return { max: hi, pad: (hi - lo) * padFrac };
}

export function ylimForMulti(dataArrays: DataRow[][], i0: number, i1: number, padFrac = 0.15): [number, number] {
  const { max, pad } = dataMaxAndPadMulti(dataArrays, i0, i1, padFrac);
  let lo = Infinity;
  for (const data of dataArrays) {
    for (let i = i0; i <= i1; i++) {
      const v = data[i].value;
      if (!isMissing(v) && v < lo) lo = v;
    }
  }
  return [lo - pad, max + pad];
}

// Cumulative point runs (split at gaps) from row i0 through fractional row
// `tipExact`, with a linearly-interpolated point at the tip for a smooth
// leading edge.
export function buildRuns(data: DataRow[], i0: number, tipExact: number) {
  const i1 = Math.floor(tipExact);
  const runs: Point[][] = [];
  let cur: Point[] = [];
  for (let i = i0; i <= i1; i++) {
    const v = data[i].value;
    if (isMissing(v)) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push([i, v]);
    }
  }
  if (cur.length) runs.push(cur);

  let tipVal: Point | null = null;
  if (i1 < data.length - 1) {
    const t = tipExact - i1;
    const y0 = data[i1].value, y1 = data[i1 + 1].value;
    if (!isMissing(y0) && !isMissing(y1) && runs.length) {
      const idxF = i1 + t, valF = y0 + t * (y1 - y0);
      runs[runs.length - 1].push([idxF, valF]);
      tipVal = [idxF, valF];
    }
  }
  if (!tipVal && runs.length) {
    const lastRun = runs[runs.length - 1];
    tipVal = lastRun[lastRun.length - 1];
  }
  return { runs, tipVal };
}

export function pathD(runs: Point[][], xDomain: [number, number], yDomain: [number, number]): string {
  return runs
    .map((run) =>
      run
        .map((pt, i) => (i === 0 ? "M" : "L") + px(pt[0], xDomain).toFixed(2) + "," + py(pt[1], yDomain).toFixed(2))
        .join(" ")
    )
    .join(" ");
}

export function monthDate(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m };
}

export function findIdx(data: DataRow[], dateStr: string): number {
  return data.findIndex((r) => r.date === dateStr);
}

// Re-grids `other` onto `reference`'s dates, so two series with different
// native start dates (e.g. openings starts 2000-12, unemployed starts 1948)
// share one array index -> date mapping, the same relationship a single
// multi-series getFRED() pull would have given for free by padding the
// shorter series with NA. Multi-series mode indexes every series by the
// primary series' array position, so this alignment has to happen before
// anything reaches px()/buildRuns() -- a raw array index only means the same
// date across series if the grids already line up.
export function alignToGrid(reference: DataRow[], other: DataRow[]): DataRow[] {
  const byDate = new Map(other.map((r) => [r.date, r.value]));
  return reference.map((r) => ({ date: r.date, value: byDate.get(r.date) ?? null }));
}

// Pick a y-tick step giving at most `maxTicks` gridlines. The old fixed step of
// 2 produced 8 lines across the 2019-present domain, which is furniture nobody
// reads at scroll speed; 3 is plenty when the endpoints are directly labelled.
export function chooseYStep(yDomain: [number, number], maxTicks = 3): number {
  const span = yDomain[1] - yDomain[0];
  if (span <= 0) return 1;
  // "Nice number" step search (1/2/5 x a power of ten) instead of a fixed
  // small-integer list -- the old list topped out at 50, which never
  // satisfied maxTicks for a series in the thousands (e.g. JOLTS/UNEMPLOY
  // levels) and fell through to a step of 100, producing dozens of
  // overlapping gridlines.
  const magnitude = Math.pow(10, Math.floor(Math.log10(span / maxTicks)));
  for (const mult of [1, 2, 5, 10]) {
    const step = mult * magnitude;
    if (Math.floor(yDomain[1] / step) - Math.ceil(yDomain[0] / step) + 1 <= maxTicks) return step;
  }
  return 10 * magnitude;
}

export type HAlign = "left" | "center" | "right";

export function haFor(idx: number, xDomain: [number, number]): HAlign {
  const fracPos = (idx - xDomain[0]) / (xDomain[1] - xDomain[0]);
  return fracPos < 0.2 ? "left" : fracPos > 0.8 ? "right" : "center";
}

export function svgAnchor(ha: HAlign): "start" | "middle" | "end" {
  return ha === "left" ? "start" : ha === "right" ? "end" : "middle";
}

// x-axis year-label thinning: show every Nth year once the view gets wide
// (mirrors the R/matplotlib/Manim zoom-out versions' tick-density rule)
export function yearStep(xDomain: [number, number]): number {
  const yearsVisible = (xDomain[1] - xDomain[0]) / 12;
  return yearsVisible > 18 ? 5 : yearsVisible > 9 ? 2 : 1;
}
