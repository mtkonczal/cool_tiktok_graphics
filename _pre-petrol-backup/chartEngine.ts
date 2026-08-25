// Shared engine for the "line reveal" chart family: scales, easing, gap
// handling, and waypoint-callout logic. Ported directly from the
// HTML/Playwright prototype (chart_template.html) -- same math, typed and
// split so future chart types (bar/scatter/table/histogram) can share the
// palette, layout, and easing helpers below without sharing this file's
// line-specific reveal logic.

export type DataRow = { date: string; prime_epop: number | null };

export const BG = "#0A0E17";
export const GRID = "#232B3A";
export const ACCENT = "#FF7A1A";
export const TEXT_LIGHT = "#E8ECF2";
export const TEXT_MUTED = "#8B93A7";

export const PLOT = { left: 100, right: 1000, top: 620, bottom: 1750 };

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
    const v = data[i].prime_epop;
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
    const v = data[i].prime_epop;
    if (!isMissing(v) && v < lo) lo = v;
  }
  return [lo - pad, max + pad];
}

export type Point = [number, number]; // [index, value]

// Cumulative point runs (split at gaps) from row i0 through fractional row
// `tipExact`, with a linearly-interpolated point at the tip for a smooth
// leading edge.
export function buildRuns(data: DataRow[], i0: number, tipExact: number) {
  const i1 = Math.floor(tipExact);
  const runs: Point[][] = [];
  let cur: Point[] = [];
  for (let i = i0; i <= i1; i++) {
    const v = data[i].prime_epop;
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
    const y0 = data[i1].prime_epop, y1 = data[i1 + 1].prime_epop;
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Waypoint = {
  idx: number;
  val: number;
  dateLabel: string;
  valueLabel: string;
  calloutYDate: number;
  calloutYValue: number;
};

export function makeWaypoints(
  data: DataRow[],
  idxs: number[],
  calloutBase: { max: number; pad: number }
): Waypoint[] {
  return idxs.map((idx) => {
    const md = monthDate(data[idx].date);
    const val = data[idx].prime_epop as number;
    return {
      idx,
      val,
      dateLabel: `${MONTH_NAMES[md.month - 1]} ${md.year}`,
      valueLabel: `${val.toFixed(1)}%`,
      calloutYDate: calloutBase.max + calloutBase.pad * 0.62,
      calloutYValue: calloutBase.max + calloutBase.pad * 0.28,
    };
  });
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
