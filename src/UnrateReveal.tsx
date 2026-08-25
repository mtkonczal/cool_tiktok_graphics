import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ChartChrome } from "./ChartChrome";
import { LineChartBody } from "./LineChartBody";
import { DataRow, dataMaxAndPad, findIdx, makeWaypoints, ylimFor } from "./chartEngine";
import dataUnrate from "./data/data_unrate_2022_present.json";

const DATA = dataUnrate as DataRow[];
export const DRAW_SECONDS = 3.0;
export const HOLD_SECONDS = 6;

// Waypoints marked from the full-decimal series (tidyusmacro::getUnrateFRED,
// unemployed / labor force -- not the pre-rounded BLS UNRATE release). Since
// the clock starts January 2022, the cycle high is November 2025, not the
// still-elevated pandemic-recovery readings from 2021.
const LOW_IDX = findIdx(DATA, "2023-04-01");
const TWO_YEARS_AGO_IDX = findIdx(DATA, "2024-07-01");
const HIGH_IDX = findIdx(DATA, "2025-11-01");

export const UnrateReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = DATA.length;
  const drawFrames = Math.round(fps * DRAW_SECONDS);

  const span = n - 1;
  const xDomain: [number, number] = [0 - span * 0.02, span + span * 0.05];
  const yDomain = ylimFor(DATA, 0, n - 1);
  const calloutBase = dataMaxAndPad(DATA, 0, n - 1);
  const latestIdx = n - 1;
  // The latest point sits just right of, and well below, the November 2025
  // peak -- an above-the-dot callout there is right-anchored (near the right
  // edge) and extends its text back leftward, straight through the line
  // descending from that peak. Dropping only this callout below its dot
  // avoids the peak entirely; the other three have open space above them.
  const rawWaypoints = makeWaypoints(DATA, [LOW_IDX, TWO_YEARS_AGO_IDX, HIGH_IDX, latestIdx], calloutBase, 1, "point");
  const waypoints = rawWaypoints.map((wp) => {
    if (wp.idx !== latestIdx) return wp;
    const calloutYValue = wp.val - (wp.val - yDomain[0]) * 0.2;
    return { ...wp, calloutYValue, calloutYDate: calloutYValue + calloutBase.pad * 0.6 };
  });

  const frac = Math.min(frame / drawFrames, 1.0);
  const tipExact = frac * (n - 1);

  return (
    <ChartChrome
      title="Unemployment rate"
      subtitle="Unemployed share of the labor force"
    >
      <LineChartBody data={DATA} xDomain={xDomain} yDomain={yDomain} i0={0} tipExact={tipExact} waypoints={waypoints} />
    </ChartChrome>
  );
};
