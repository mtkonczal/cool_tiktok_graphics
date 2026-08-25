import { DataRow, ease } from "./scales";
import { WaypointToken, resolveIndex } from "./waypoints";
import { ShotWindow, resolveWindow } from "./shots";

// "Text on the thing": a general annotation layer generalizing the one
// bespoke reference-line prop the line bodies always had (LineChartBody's
// avgLine, then Phase 2/3's AvgLine) into a small vocabulary any spec can
// use. See PLAN.md Section 2f.
//
// A value expression is either a literal number, "value:TOKEN" (the
// series' value at a resolved date/token), or "mean:TOKEN..TOKEN" (the
// average over a resolved date range) -- e.g. "mean:2024-01-01..latest".
export type AnnotationValueExpr = string;

export type Annotation =
  | {
      kind: "hline";
      value: AnnotationValueExpr;
      label: string;
      labelAt: WaypointToken;
      /** Where the line is drawn, independent of the (possibly narrower)
       * range used to compute its value. Defaults to the spec's full outer
       * window, so a reference line reads as "compare the whole chart
       * against this," not just the range it was averaged over. */
      window?: ShotWindow;
      from?: string;
      until?: string;
    }
  | { kind: "vline"; at: WaypointToken; label: string; from?: string; until?: string }
  | { kind: "band"; window: ShotWindow; label?: string; from?: string; until?: string }
  | { kind: "point"; at: WaypointToken; value?: AnnotationValueExpr; label: string; from?: string; until?: string }
  | {
      kind: "free";
      /** Fractional position (0-1) within TEXTSAFE, not tied to any date --
       * for a punchline card overlaid on the chart. */
      x: number;
      y: number;
      label: string;
      align?: "start" | "middle" | "end";
      from?: string;
      until?: string;
    };

/** The built-in "recessions" shorthand expands to one unlabeled band per
 * NBER recession -- everything else is written out in full. */
export type AnnotationSpec = Annotation | "recessions";

export type ResolvedAnnotation =
  | { kind: "hline"; value: number; label: string; labelIdx: number; leftIdx: number; rightIdx: number; opacity: number }
  | { kind: "vline"; idx: number; label: string; opacity: number }
  | { kind: "band"; i0: number; i1: number; label?: string; opacity: number }
  | { kind: "point"; idx: number; value: number; label: string; opacity: number }
  | { kind: "free"; x: number; y: number; label: string; align: "start" | "middle" | "end"; opacity: number };

const MEAN_RE = /^mean:(.+)\.\.(.+)$/;
const VALUE_RE = /^value:(.+)$/;

export function resolveValueExpr(
  data: DataRow[],
  expr: AnnotationValueExpr,
  window?: { i0: number; i1: number }
): number {
  const mean = MEAN_RE.exec(expr);
  if (mean) {
    const i0 = resolveIndex(data, mean[1], window);
    const i1 = resolveIndex(data, mean[2], window);
    let sum = 0, n = 0;
    for (let i = i0; i <= i1; i++) {
      const v = data[i].value;
      if (v !== null) { sum += v; n++; }
    }
    if (n === 0) throw new Error(`resolveValueExpr: no data in mean range for "${expr}"`);
    return sum / n;
  }
  const val = VALUE_RE.exec(expr);
  if (val) {
    const idx = resolveIndex(data, val[1], window);
    const v = data[idx].value;
    if (v === null) throw new Error(`resolveValueExpr: null value at "${val[1]}" for "${expr}"`);
    return v;
  }
  const n = Number(expr);
  if (Number.isNaN(n)) throw new Error(`resolveValueExpr: cannot parse "${expr}" as mean:/value:/a plain number`);
  return n;
}

// Fades an annotation in across `from` and out across `until` (shot names,
// matching engine/shots.ts's shotProgress keys) -- 0 before `from` starts,
// eased in while it runs, full opacity once past it and before `until`
// starts, eased out across `until`. Either end is optional: omit `from` for
// something visible from frame 0, omit `until` for something that stays
// once shown.
export function resolveAnnotationOpacity(shotProgress: Record<string, number>, from?: string, until?: string): number {
  let opacity = 1;
  if (from !== undefined) opacity = Math.min(opacity, ease(shotProgress[from] ?? 0));
  if (until !== undefined) opacity = Math.min(opacity, 1 - ease(shotProgress[until] ?? 0));
  return opacity;
}

// One band per contiguous run of `value === 1` in an indicator series (e.g.
// USREC) that falls within `window`. `indicatorData` must already be
// aligned onto the chart's primary series' date grid (see alignToGrid in
// scales.ts) -- recessions.json runs back to 1854 on its own grid, which
// doesn't line up index-for-index with a series that starts later.
export function recessionBands(indicatorData: DataRow[], window: { i0: number; i1: number }): ResolvedAnnotation[] {
  const bands: ResolvedAnnotation[] = [];
  let runStart: number | null = null;
  for (let i = window.i0; i <= window.i1; i++) {
    const on = indicatorData[i]?.value === 1;
    if (on && runStart === null) {
      runStart = i;
    } else if (!on && runStart !== null) {
      bands.push({ kind: "band", i0: runStart, i1: i - 1, opacity: 1 });
      runStart = null;
    }
  }
  if (runStart !== null) bands.push({ kind: "band", i0: runStart, i1: window.i1, opacity: 1 });
  return bands;
}

export function resolveAnnotations(
  specs: AnnotationSpec[],
  data: DataRow[],
  outerWindow: { i0: number; i1: number },
  xDomain: [number, number],
  shotProgress: Record<string, number>,
  recessionsData?: DataRow[]
): ResolvedAnnotation[] {
  const out: ResolvedAnnotation[] = [];
  for (const spec of specs) {
    if (spec === "recessions") {
      if (!recessionsData) {
        throw new Error('resolveAnnotations: "recessions" needs recessionsData (aligned onto the primary series)');
      }
      out.push(...recessionBands(recessionsData, outerWindow));
      continue;
    }

    const opacity = resolveAnnotationOpacity(shotProgress, spec.from, spec.until);

    if (spec.kind === "hline") {
      const value = resolveValueExpr(data, spec.value, outerWindow);
      const win = spec.window ? resolveWindow(data, spec.window) : outerWindow;
      const labelIdx = resolveIndex(data, spec.labelAt, outerWindow);
      out.push({
        kind: "hline",
        value,
        label: spec.label,
        labelIdx,
        // Grows in from wherever the current view's left/right edges are,
        // clamped to the line's own valid range -- so a wide reference line
        // reveals progressively as a zoom-out camera passes over it, the
        // same effect the original bespoke avgLine had.
        leftIdx: Math.max(win.i0, xDomain[0]),
        rightIdx: Math.min(win.i1, xDomain[1]),
        opacity,
      });
    } else if (spec.kind === "vline") {
      out.push({ kind: "vline", idx: resolveIndex(data, spec.at, outerWindow), label: spec.label, opacity });
    } else if (spec.kind === "band") {
      const win = resolveWindow(data, spec.window);
      out.push({ kind: "band", i0: win.i0, i1: win.i1, label: spec.label, opacity });
    } else if (spec.kind === "point") {
      const idx = resolveIndex(data, spec.at, outerWindow);
      const value = spec.value !== undefined ? resolveValueExpr(data, spec.value, outerWindow) : data[idx].value;
      if (value === null) throw new Error(`resolveAnnotations: point at "${spec.at}" has no value and none was given`);
      out.push({ kind: "point", idx, value, label: spec.label, opacity });
    } else {
      out.push({ kind: "free", x: spec.x, y: spec.y, label: spec.label, align: spec.align ?? "middle", opacity });
    }
  }
  return out;
}
