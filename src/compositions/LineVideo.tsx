import React from "react";
import { useCurrentFrame } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import "../fonts";
import { ChartChrome } from "../ChartChrome";
import { AvgLine, LineBody, LineSeries } from "../bodies/LineBody";
import { DataRow, alignToGrid, dataMaxAndPadMulti, ease, ylimForMulti } from "../engine/scales";
import { Waypoint, WaypointToken, belowDotOverride, makeWaypoints, resolveIndex } from "../engine/waypoints";
import { seriesData } from "../data/registry";
import { seriesMeta } from "../data/seriesMeta";
import { FRAME, PAPER, PETROL, Palette } from "../theme";

export const FPS = 30;

// A single line-video definition -- everything that varies between "line
// graph of the quits rate, 2019 to now" and "prime-age employment rate,
// zoom out at the end" lives here, not in a new .tsx file. See PLAN.md
// Section 2c/Phase 2. Deliberately smaller than the eventual full spec
// grammar: window bounds are absolute dates only (relative windows are
// Phase 3), and the shot vocabulary here covers exactly what the four
// current videos need (draw, hold, and a single draw->hold->zoom->hold
// zoom-out) -- Phase 3 extracts this into a general engine/shots.ts.
export type LineShot =
  | { kind: "draw"; seconds: number }
  | { kind: "hold"; seconds: number }
  | { kind: "zoom"; seconds: number };

export type LineSpec = {
  id: string;
  /** 1 entry = single-line mode (waypoints, zoom, optional avg line). 2+
   * entries = static-label mode (each line gets a label near its midpoint,
   * no waypoints). */
  series: { ref: string }[];
  chrome?: { title?: string; subtitle?: string };
  palette?: "petrol" | "paper";
  /** Absolute date bounds into the full registry series, e.g.
   * ["2019-01-01", "latest"]. "latest" means the last row with data. */
  window: [string, string];
  /** Single-line mode only. Resolver keywords ("min"/"max"/"latest") or
   * literal "YYYY-MM-DD" dates -- see engine/waypoints.ts. */
  waypoints?: WaypointToken[];
  waypointAnchor?: "max" | "point";
  /** The one waypoint (by token) that should render below its dot instead
   * of above -- see belowDotOverride in engine/waypoints.ts. */
  waypointBelowDot?: WaypointToken;
  /** Overrides the registry's storage decimals for on-screen labels (e.g.
   * unrate is stored at 4 decimals for vintage precision but shown at 1). */
  displayDecimals?: number;
  /** The narrower pre-zoom window's start date, only meaningful when shots
   * includes a "zoom". Defaults to window[0] (no zoom). */
  initialWindowStart?: string;
  /** A waypoint (by token) that fades from full opacity to 0 across the
   * zoom shot, ceding the frame to the wider view -- e.g. a "cycle low"
   * waypoint that's redundant once decades of history are visible. */
  waypointFade?: WaypointToken;
  /** Single-line mode only: a dashed reference line that appears once the
   * zoom shot begins, same bespoke prop LineChartBody always had --
   * generalizing this into a real annotation grammar is Phase 4. */
  avg?: { from: WaypointToken; label: string; labelAt: string };
  shots: LineShot[];
};

// `dataArrays` is every plotted series (already aligned onto a shared date
// grid -- see alignToGrid), so a 2-line spec's y-domain spans both lines
// rather than clipping whichever one isn't first.
function windowGeom(dataArrays: DataRow[][], i0: number, i1: number) {
  const span = i1 - i0;
  const xDomain: [number, number] = [i0 - span * 0.02, i1 + span * 0.05];
  const yDomain = ylimForMulti(dataArrays, i0, i1);
  const cb = dataMaxAndPadMulti(dataArrays, i0, i1);
  return { xDomain, yDomain, cb };
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function lerpPair(a: [number, number], b: [number, number], t: number): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

type ShotState = {
  i0: number;
  tipExact: number;
  xDomain: [number, number];
  yDomain: [number, number];
  cbMax: number;
  cbPad: number;
  zoomFactor: number;
  zoomT: number;
  zoomed: boolean;
  winStart: number;
  winEnd: number;
};

function resolveShotState(spec: LineSpec, primaryData: DataRow[], dataArrays: DataRow[][], frame: number, fps: number): ShotState {
  const winStart = resolveIndex(primaryData, spec.window[0]);
  const winEnd = resolveIndex(primaryData, spec.window[1]);
  const initStart = spec.initialWindowStart != null ? resolveIndex(primaryData, spec.initialWindowStart) : winStart;

  const initWin = windowGeom(dataArrays, initStart, winEnd);
  const outerWin = windowGeom(dataArrays, winStart, winEnd);

  let i0 = initStart;
  let tipExact = initStart;
  let xDomain = initWin.xDomain;
  let yDomain = initWin.yDomain;
  let cbMax = initWin.cb.max;
  let cbPad = initWin.cb.pad;
  let zoomT = 0;
  let zoomed = false;

  let acc = 0;
  for (const shot of spec.shots) {
    const shotFrames = Math.max(1, Math.round(fps * shot.seconds));
    const local = frame - acc;
    if (local >= 0) {
      const effFrac = Math.min(local / shotFrames, 1);
      if (shot.kind === "draw") {
        i0 = zoomed ? winStart : initStart;
        tipExact = initStart + effFrac * (winEnd - initStart);
        xDomain = initWin.xDomain;
        yDomain = initWin.yDomain;
        cbMax = initWin.cb.max;
        cbPad = initWin.cb.pad;
      } else if (shot.kind === "hold") {
        i0 = zoomed ? winStart : initStart;
        tipExact = winEnd;
        // domains intentionally untouched -- a hold just freezes whatever
        // the previous shot left in place.
      } else {
        zoomed = true;
        i0 = winStart;
        tipExact = winEnd;
        const t = ease(effFrac);
        xDomain = lerpPair(initWin.xDomain, outerWin.xDomain, t);
        yDomain = lerpPair(initWin.yDomain, outerWin.yDomain, t);
        cbMax = lerp(initWin.cb.max, outerWin.cb.max, t);
        cbPad = lerp(initWin.cb.pad, outerWin.cb.pad, t);
        zoomT = t;
      }
    }
    acc += shotFrames;
  }

  const zoomFactor = (xDomain[1] - xDomain[0]) / (initWin.xDomain[1] - initWin.xDomain[0]);
  return { i0, tipExact, xDomain, yDomain, cbMax, cbPad, zoomFactor, zoomT, zoomed, winStart, winEnd };
}

export function lineSpecDurationSeconds(spec: LineSpec): number {
  return spec.shots.reduce((sum, s) => sum + s.seconds, 0);
}

export const calculateLineMetadata: CalculateMetadataFunction<LineSpec> = async ({ props }) => ({
  durationInFrames: Math.round(FPS * lineSpecDurationSeconds(props)),
  fps: FPS,
  width: FRAME.width,
  height: FRAME.height,
});

export const LineVideo: React.FC<LineSpec> = (spec) => {
  const frame = useCurrentFrame();
  const palette: Palette = spec.palette === "paper" ? PAPER : PETROL;

  const refs = spec.series.map((s) => s.ref);
  const rawByRef = refs.map((ref) => seriesData(ref));
  // Every series must share the primary series' array-index -> date mapping
  // before it can be plotted alongside it (see alignToGrid); the primary
  // series is already its own reference grid.
  const dataByRef = rawByRef.map((data, i) => (i === 0 ? data : alignToGrid(rawByRef[0], data)));
  const metaByRef = refs.map((ref) => seriesMeta(ref));
  const primaryData = dataByRef[0];
  const primaryMeta = metaByRef[0];

  const state = resolveShotState(spec, primaryData, dataByRef, frame, FPS);
  const { winStart: outerWinStart, winEnd: outerWinEnd } = state;

  let waypoints: Waypoint[] = [];
  let avgLine: AvgLine | undefined;

  if (spec.series.length === 1) {
    const decimals = spec.displayDecimals ?? primaryMeta.decimals;
    const anchor = spec.waypointAnchor ?? "max";
    if (spec.waypoints && spec.waypoints.length) {
      const idxs = spec.waypoints.map((token) =>
        resolveIndex(primaryData, token, { i0: outerWinStart, i1: outerWinEnd })
      );
      waypoints = makeWaypoints(primaryData, idxs, { max: state.cbMax, pad: state.cbPad }, primaryMeta.units, decimals, anchor);

      if (spec.waypointFade) {
        const fadeIdx = resolveIndex(primaryData, spec.waypointFade, { i0: outerWinStart, i1: outerWinEnd });
        waypoints = waypoints.map((wp) => (wp.idx === fadeIdx ? { ...wp, opacity: 1 - state.zoomT } : wp));
      }
      if (spec.waypointBelowDot) {
        const belowIdx = resolveIndex(primaryData, spec.waypointBelowDot, { i0: outerWinStart, i1: outerWinEnd });
        waypoints = waypoints.map((wp) => (wp.idx === belowIdx ? belowDotOverride(wp, state.yDomain[0], state.cbPad) : wp));
      }
    }

    if (spec.avg && state.zoomed) {
      const fromIdx = resolveIndex(primaryData, spec.avg.from, { i0: outerWinStart, i1: outerWinEnd });
      let sum = 0, n = 0;
      for (let i = fromIdx; i <= outerWinEnd; i++) {
        const v = primaryData[i].value;
        if (v !== null) { sum += v; n++; }
      }
      avgLine = {
        value: sum / n,
        label: spec.avg.label,
        // Clamp to the window's start, not array index 0 -- the original
        // clamped to 0 because its array was already sliced to the window,
        // so index 0 and the window start were the same row. Here the array
        // is full history, so index 0 would be 1948, not the window start.
        leftIdx: Math.max(outerWinStart, state.xDomain[0]),
        rightIdx: outerWinEnd,
        labelIdx: resolveIndex(primaryData, spec.avg.labelAt),
      };
    }
  }

  const lineSeries: LineSeries[] = spec.series.map((s, i) => ({
    data: dataByRef[i],
    label: spec.series.length > 1 ? metaByRef[i].title : undefined,
    color: spec.series.length > 1 ? (i % 2 === 0 ? palette.series : palette.accent) : undefined,
  }));

  const title = spec.chrome?.title ?? (spec.series.length === 1 ? primaryMeta.title : undefined);
  const subtitle = spec.chrome?.subtitle ?? (spec.series.length === 1 ? primaryMeta.subtitle : undefined);

  return (
    <ChartChrome title={title ?? spec.id} subtitle={subtitle} palette={palette}>
      <LineBody
        series={lineSeries}
        xDomain={state.xDomain}
        yDomain={state.yDomain}
        i0={state.i0}
        tipExact={state.tipExact}
        unit={primaryMeta.units}
        zoomFactor={state.zoomFactor}
        palette={palette}
        avgLine={avgLine}
        waypoints={waypoints}
      />
    </ChartChrome>
  );
};
