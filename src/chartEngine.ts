// Shared engine for the "line reveal" chart family: scales, easing, gap
// handling, and waypoint-callout logic. Ported directly from the
// HTML/Playwright prototype (chart_template.html) -- same math, typed and
// split so future chart types (bar/scatter/table/histogram) can share the
// palette, layout, and easing helpers below without sharing this file's
// line-specific reveal logic.

export type DataRow = { date: string; value: number | null };

// Palette and frame geometry now live in theme.ts, which traces every value
// back to a mikekonczal.com token. PLOT is re-exported so px()/py() and the
// chart bodies keep reading it from here.
export { PETROL, PAPER, PLOT, SAFE, TEXTSAFE, ROW, TYPE, TABULAR, STROKE, MARK, MAX_LABEL_SHRINK } from "./theme";
import { PLOT } from "./theme";

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

export type Point = [number, number]; // [index, value]

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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Waypoint = {
  idx: number;
  val: number;
  dateLabel: string;
  valueLabel: string;
  calloutYDate: number;
  calloutYValue: number;
  /** 0-1, defaults to 1 when omitted -- lets a waypoint fade out (e.g. a
   * recent-history callout ceding the frame to a longer-range one) without
   * being removed from the array mid-animation. */
  opacity?: number;
};

export function makeWaypoints(
  data: DataRow[],
  idxs: number[],
  calloutBase: { max: number; pad: number },
  decimals = 1,
  anchor: "max" | "point" = "max"
): Waypoint[] {
  return idxs.map((idx) => {
    const md = monthDate(data[idx].date);
    const val = data[idx].value as number;
    // "max" clusters every callout at the same height near the series max --
    // reads fine when the waypoints themselves all sit close to that max (the
    // EPOP charts' recent-history trio). "point" anchors each callout above
    // its own waypoint instead, for series where waypoints span a wide range
    // (e.g. a cycle low next to a cycle high) and clustering at the max would
    // strand a low waypoint's label far above its own dot.
    //
    // For "point", the value-label gap is a fraction of the *headroom* above
    // the waypoint (domain top minus its value), not a fixed multiple of pad:
    // a waypoint near the domain top (little headroom) gets a small gap, so
    // its label doesn't overshoot past the plot into the x-axis row; a
    // waypoint near the bottom (lots of headroom, and usually more line
    // wiggle around it) gets a bigger gap, clearing the line instead of
    // sitting right on top of it. The date label keeps the same fixed offset
    // above the value label used everywhere else, so the two rows never
    // collide regardless of how much headroom the point has.
    const domainTop = calloutBase.max + calloutBase.pad;
    const calloutYValue =
      anchor === "point" ? val + (domainTop - val) * 0.4 : calloutBase.max + calloutBase.pad * 0.28;
    const calloutYDate = anchor === "point" ? calloutYValue + calloutBase.pad * 0.6 : calloutBase.max + calloutBase.pad * 0.88;
    return {
      idx,
      val,
      dateLabel: `${MONTH_NAMES[md.month - 1]} ${md.year}`,
      valueLabel: `${val.toFixed(decimals)}%`,
      // Callout offsets stay in DATA space (not pixels) so the zoom-out
      // composition can interpolate calloutBase and have the labels travel
      // with the zoom. Widened from 0.62/0.28 to 0.85/0.22 to fit the larger
      // type: because pad is proportional to range, the gap works out to a
      // constant 0.60 * padFrac / (1 + 2 * padFrac) of plot height -- about
      // 60px -- whatever the data, so this holds for both compositions.
      calloutYDate,
      calloutYValue,
    };
  });
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
