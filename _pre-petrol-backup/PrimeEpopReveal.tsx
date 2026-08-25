import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ChartChrome } from "./ChartChrome";
import { LineChartBody } from "./LineChartBody";
import { DataRow, dataMaxAndPad, findIdx, makeWaypoints, ylimFor } from "./chartEngine";
import data2019 from "./data/data_2019_present.json";

const DATA = data2019 as DataRow[];
export const DRAW_SECONDS = 4.5;
export const HOLD_SECONDS = 6;

export const PrimeEpopReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = DATA.length;
  const drawFrames = Math.round(fps * DRAW_SECONDS);

  const span = n - 1;
  const xDomain: [number, number] = [0 - span * 0.02, span + span * 0.05];
  const yDomain = ylimFor(DATA, 0, n - 1);
  const calloutBase = dataMaxAndPad(DATA, 0, n - 1);
  const waypoints = makeWaypoints(
    DATA,
    [findIdx(DATA, "2019-12-01"), findIdx(DATA, "2023-05-01"), n - 1],
    calloutBase
  );

  const frac = Math.min(frame / drawFrames, 1.0);
  const tipExact = frac * (n - 1);

  return (
    <ChartChrome
      title="PRIME-AGE EMPLOYMENT RATE"
      subtitle="Employed share of the population, ages 25-54"
      sourceLine1="Source: BLS via FRED (LNS12300060), seasonally adjusted."
      sourceLine2="Gap = Oct 2025 (government shutdown, no data collected)."
    >
      <LineChartBody data={DATA} xDomain={xDomain} yDomain={yDomain} i0={0} tipExact={tipExact} waypoints={waypoints} />
    </ChartChrome>
  );
};
