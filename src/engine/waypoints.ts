import { DataRow, findIdx, monthDate } from "./scales";
import { Unit, fmt } from "./format";

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

// A waypoint token is either a resolver keyword or a literal "YYYY-MM-DD"
// date. Resolvers are computed against a window (min/max: the visible date
// range; latest: the last non-null row at or before the window's end) so a
// spec written today still points at the right row next month -- this is
// the fix for the stale hardcodes PLAN.md flagged (UnrateReveal's cycle
// low/high were literal dates that silently went wrong once a new cycle
// extreme printed). Literal dates ignore the window entirely; they're an
// editorial pick ("this is the frame I want called out"), not a moving target.
export type WaypointToken = "min" | "max" | "latest" | string;

export function resolveIndex(data: DataRow[], token: WaypointToken, window?: { i0: number; i1: number }): number {
  if (token === "latest") {
    const hi = window?.i1 ?? data.length - 1;
    for (let i = hi; i >= 0; i--) {
      if (data[i].value !== null) return i;
    }
    return hi;
  }
  if (token === "min" || token === "max") {
    if (!window) throw new Error(`resolveIndex: "${token}" requires a window`);
    let best = -1;
    let bestVal = token === "min" ? Infinity : -Infinity;
    for (let i = window.i0; i <= window.i1; i++) {
      const v = data[i].value;
      if (v === null) continue;
      if (token === "min" ? v < bestVal : v > bestVal) {
        bestVal = v;
        best = i;
      }
    }
    if (best === -1) throw new Error(`resolveIndex: no data for "${token}" in the given window`);
    return best;
  }
  const idx = findIdx(data, token);
  if (idx === -1) throw new Error(`resolveIndex: date "${token}" not found in series`);
  return idx;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function makeWaypoints(
  data: DataRow[],
  idxs: number[],
  calloutBase: { max: number; pad: number },
  unit: Unit,
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
      valueLabel: fmt(unit, val, decimals),
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

// One-off placement fix for a waypoint whose default callout would collide
// with the line itself -- e.g. UnrateReveal's latest point sits just right
// of, and well below, a recent peak, so an above-the-dot callout there is
// right-anchored and extends its text back leftward, straight through the
// line descending from that peak. Drops that one callout below its dot
// instead, using the domain floor as headroom rather than the domain top.
export function belowDotOverride(wp: Waypoint, yDomainLo: number, pad: number): Waypoint {
  const calloutYValue = wp.val - (wp.val - yDomainLo) * 0.2;
  return { ...wp, calloutYValue, calloutYDate: calloutYValue + pad * 0.6 };
}
