import React from "react";
import { useCurrentFrame } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import "../fonts";
import { ChartChrome } from "../ChartChrome";
import { AvgLine, LineBody, LineSeries } from "../bodies/LineBody";
import { alignToGrid, ease } from "../engine/scales";
import { Shot, resolveShot, shotsDurationSeconds } from "../engine/shots";
import { Waypoint, WaypointToken, belowDotOverride, makeWaypoints, resolveIndex } from "../engine/waypoints";
import { seriesData } from "../data/registry";
import { seriesMeta } from "../data/seriesMeta";
import { FRAME, PAPER, PETROL, Palette } from "../theme";

export const FPS = 30;

// A single line-video definition -- everything that varies between "line
// graph of the quits rate, 2019 to now" and "prime-age employment rate,
// zoom out at the end" lives here, not in a new .tsx file. See PLAN.md
// Section 2c. The shot sequence itself (draw/hold/zoom/pan/fade, relative
// windows, multi-stage sequences) is engine/shots.ts as of Phase 3; this
// file is the line-chart-specific glue on top -- waypoints, the avg
// reference line, and how a spec's fields turn into props for LineBody.
export type LineSpec = {
  id: string;
  /** 1 entry = single-line mode (waypoints, avg line). 2+ entries =
   * static-label mode (each line gets a label near its midpoint, no
   * waypoints). */
  series: { ref: string }[];
  chrome?: { title?: string; subtitle?: string };
  palette?: "petrol" | "paper";
  /** The full extent used to resolve waypoint/avg tokens ("min"/"max"/
   * "latest") -- independent of what's actually on screen at any given
   * moment, which each shot's own `window` controls. Also doubles as the
   * first shot's window when that shot doesn't declare its own (the
   * common case: a spec with no zoom/pan just has one window throughout). */
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
  /** A waypoint that fades from full opacity to 0 across the named shot
   * (default "zoom"), ceding the frame to the wider view -- e.g. a "cycle
   * low" waypoint that's redundant once decades of history are visible. */
  waypointFade?: { token: WaypointToken; duringShot?: string };
  /** Single-line mode only: a dashed reference line that appears once the
   * named shot (default "zoom") starts, same bespoke prop LineChartBody
   * always had -- generalizing this into a real annotation grammar is
   * Phase 4. */
  avg?: { from: WaypointToken; label: string; labelAt: string; fromShot?: string };
  shots: Shot[];
};

export function lineSpecDurationSeconds(spec: LineSpec): number {
  return shotsDurationSeconds(spec.shots);
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

  // The first shot inherits spec.window when it doesn't declare its own --
  // keeps a no-zoom spec from having to repeat the same window twice.
  const shots = spec.shots.map((s, i) =>
    i === 0 && (s.kind === "draw" || s.kind === "hold") && !s.window ? { ...s, window: spec.window } : s
  );
  const state = resolveShot(shots, frame, FPS, dataByRef);

  const outerWinStart = resolveIndex(primaryData, spec.window[0]);
  const outerWinEnd = resolveIndex(primaryData, spec.window[1]);

  let waypoints: Waypoint[] = [];
  let avgLine: AvgLine | undefined;

  if (spec.series.length === 1) {
    const decimals = spec.displayDecimals ?? primaryMeta.decimals;
    const anchor = spec.waypointAnchor ?? "max";
    if (spec.waypoints && spec.waypoints.length) {
      const idxs = spec.waypoints.map((token) =>
        resolveIndex(primaryData, token, { i0: outerWinStart, i1: outerWinEnd })
      );
      waypoints = makeWaypoints(primaryData, idxs, state.calloutBase, primaryMeta.units, decimals, anchor);

      if (spec.waypointFade) {
        const fadeIdx = resolveIndex(primaryData, spec.waypointFade.token, { i0: outerWinStart, i1: outerWinEnd });
        const progress = ease(state.shotProgress[spec.waypointFade.duringShot ?? "zoom"] ?? 0);
        waypoints = waypoints.map((wp) => (wp.idx === fadeIdx ? { ...wp, opacity: 1 - progress } : wp));
      }
      if (spec.waypointBelowDot) {
        const belowIdx = resolveIndex(primaryData, spec.waypointBelowDot, { i0: outerWinStart, i1: outerWinEnd });
        waypoints = waypoints.map((wp) =>
          wp.idx === belowIdx ? belowDotOverride(wp, state.yDomain[0], state.calloutBase.pad) : wp
        );
      }
    }

    if (spec.avg && state.shotStarted[spec.avg.fromShot ?? "zoom"]) {
      const fromIdx = resolveIndex(primaryData, spec.avg.from, { i0: outerWinStart, i1: outerWinEnd });
      let sum = 0, n = 0;
      for (let i = fromIdx; i <= outerWinEnd; i++) {
        const v = primaryData[i].value;
        if (v !== null) { sum += v; n++; }
      }
      avgLine = {
        value: sum / n,
        label: spec.avg.label,
        // Clamp to the window's start, not array index 0 -- with every
        // series living in one shared full-history array, index 0 is the
        // start of that series (e.g. 1948), not necessarily this spec's
        // window start.
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
