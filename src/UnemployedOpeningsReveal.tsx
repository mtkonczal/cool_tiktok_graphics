import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ChartChrome } from "./ChartChrome";
import { TwoLineChartBody } from "./TwoLineChartBody";
import { DataRow } from "./chartEngine";
import { PETROL } from "./theme";
import dataUnemployed from "./data/data_unemployed_2023_present.json";
import dataOpenings from "./data/data_openings_2023_present.json";

const UNEMPLOYED = dataUnemployed as DataRow[];
const OPENINGS = dataOpenings as DataRow[];

export const DRAW_SECONDS = 3.5;
export const HOLD_SECONDS = 6;

export const UnemployedOpeningsReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = UNEMPLOYED.length;
  const drawFrames = Math.round(fps * DRAW_SECONDS);

  const span = n - 1;
  const xDomain: [number, number] = [0 - span * 0.02, span + span * 0.05];

  let lo = Infinity;
  let hi = -Infinity;
  for (const row of [...UNEMPLOYED, ...OPENINGS]) {
    if (row.value === null) continue;
    if (row.value < lo) lo = row.value;
    if (row.value > hi) hi = row.value;
  }
  const pad = (hi - lo) * 0.15;
  const yDomain: [number, number] = [lo - pad, hi + pad];

  const frac = Math.min(frame / drawFrames, 1.0);
  const tipExact = frac * span;

  return (
    <ChartChrome title="Job openings vs. unemployed" palette={PETROL}>
      <TwoLineChartBody
        seriesA={{ data: UNEMPLOYED, label: "Unemployed", color: PETROL.series }}
        seriesB={{ data: OPENINGS, label: "Job openings", color: PETROL.accent }}
        xDomain={xDomain}
        yDomain={yDomain}
        i0={0}
        tipExact={tipExact}
        palette={PETROL}
      />
    </ChartChrome>
  );
};
