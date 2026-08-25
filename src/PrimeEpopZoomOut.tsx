import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ChartChrome } from "./ChartChrome";
import { AvgLine, LineChartBody } from "./LineChartBody";
import { DataRow, dataMaxAndPad, ease, findIdx, makeWaypoints, ylimFor } from "./chartEngine";
import data1995 from "./data/data_1995_present.json";

const DATA = data1995 as DataRow[];
export const DRAW_SECONDS = 3.5;
export const HOLD1_SECONDS = 6.0;
export const ZOOM_SECONDS = 3.0;
export const HOLD2_SECONDS = 10.0;

// 2024-2026 average reference line, revealed as the composition zooms out.
const AVG_START_IDX = findIdx(DATA, "2024-01-01");
const AVG_LABEL_IDX = Math.round((findIdx(DATA, "2007-12-01") + findIdx(DATA, "2009-06-01")) / 2); // Great Recession span
function meanFrom(data: DataRow[], i0: number, i1: number): number {
  let sum = 0, n = 0;
  for (let i = i0; i <= i1; i++) {
    const v = data[i].value;
    if (v !== null) { sum += v; n++; }
  }
  return sum / n;
}
const AVG_VALUE = meanFrom(DATA, AVG_START_IDX, DATA.length - 1);
const AVG_LABEL = "2024–2026 average";

export const PrimeEpopZoomOut: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = DATA.length;
  const start2019 = findIdx(DATA, "2019-01-01");

  const fDraw = Math.round(fps * DRAW_SECONDS);
  const fHold1 = Math.round(fps * HOLD1_SECONDS);
  const fZoom = Math.round(fps * ZOOM_SECONDS);

  const x2019Span = (n - 1) - start2019;
  const x2019Domain: [number, number] = [start2019 - x2019Span * 0.02, (n - 1) + x2019Span * 0.05];
  const y2019Domain = ylimFor(DATA, start2019, n - 1);
  const xFullDomain: [number, number] = [0 - (n - 1) * 0.02, (n - 1) + (n - 1) * 0.05];
  const yFullDomain = ylimFor(DATA, 0, n - 1);
  const cb2019 = dataMaxAndPad(DATA, start2019, n - 1);
  const cbFull = dataMaxAndPad(DATA, 0, n - 1);

  const may2023Idx = findIdx(DATA, "2023-05-01");
  const idxs = [findIdx(DATA, "1999-01-01"), findIdx(DATA, "2019-12-01"), may2023Idx, n - 1];

  let i0: number, tipExact: number, xDomain: [number, number], yDomain: [number, number], cbMax: number, cbPad: number;
  let zoomT: number;

  if (frame < fDraw) {
    const frac = frame / fDraw;
    i0 = start2019;
    tipExact = start2019 + frac * ((n - 1) - start2019);
    xDomain = x2019Domain;
    yDomain = y2019Domain;
    cbMax = cb2019.max;
    cbPad = cb2019.pad;
    zoomT = 0;
  } else if (frame < fDraw + fHold1) {
    i0 = start2019;
    tipExact = n - 1;
    xDomain = x2019Domain;
    yDomain = y2019Domain;
    cbMax = cb2019.max;
    cbPad = cb2019.pad;
    zoomT = 0;
  } else if (frame < fDraw + fHold1 + fZoom) {
    i0 = 0;
    tipExact = n - 1;
    const t = ease((frame - fDraw - fHold1) / fZoom);
    xDomain = [
      x2019Domain[0] + t * (xFullDomain[0] - x2019Domain[0]),
      x2019Domain[1] + t * (xFullDomain[1] - x2019Domain[1]),
    ];
    yDomain = [
      y2019Domain[0] + t * (yFullDomain[0] - y2019Domain[0]),
      y2019Domain[1] + t * (yFullDomain[1] - y2019Domain[1]),
    ];
    cbMax = cb2019.max + t * (cbFull.max - cb2019.max);
    cbPad = cb2019.pad + t * (cbFull.pad - cb2019.pad);
    zoomT = t;
  } else {
    i0 = 0;
    tipExact = n - 1;
    xDomain = xFullDomain;
    yDomain = yFullDomain;
    cbMax = cbFull.max;
    cbPad = cbFull.pad;
    zoomT = 1;
  }

  const zoomFactor = (xDomain[1] - xDomain[0]) / (x2019Domain[1] - x2019Domain[0]);
  const waypoints = makeWaypoints(DATA, idxs, { max: cbMax, pad: cbPad }).map((wp) =>
    wp.idx === may2023Idx ? { ...wp, opacity: 1 - zoomT } : wp
  );

  const inZoomOrLater = frame >= fDraw + fHold1;
  const avgLine: AvgLine | undefined = inZoomOrLater
    ? {
        value: AVG_VALUE,
        label: AVG_LABEL,
        leftIdx: Math.max(0, xDomain[0]),
        rightIdx: n - 1,
        labelIdx: AVG_LABEL_IDX,
      }
    : undefined;

  return (
    <ChartChrome
      title="Prime-age employment rate"
      subtitle="Employed share of the population, ages 25–54"
    >
      <LineChartBody
        data={DATA}
        xDomain={xDomain}
        yDomain={yDomain}
        i0={i0}
        tipExact={tipExact}
        waypoints={waypoints}
        zoomFactor={zoomFactor}
        avgLine={avgLine}
      />
    </ChartChrome>
  );
};
