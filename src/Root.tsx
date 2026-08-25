import React from "react";
import { Composition } from "remotion";
import { PrimeEpopReveal, DRAW_SECONDS, HOLD_SECONDS } from "./PrimeEpopReveal";
import {
  PrimeEpopZoomOut,
  DRAW_SECONDS as ZO_DRAW,
  HOLD1_SECONDS,
  ZOOM_SECONDS,
  HOLD2_SECONDS,
} from "./PrimeEpopZoomOut";
import { UnrateReveal, DRAW_SECONDS as UR_DRAW, HOLD_SECONDS as UR_HOLD } from "./UnrateReveal";
import {
  UnemployedOpeningsReveal,
  DRAW_SECONDS as UO_DRAW,
  HOLD_SECONDS as UO_HOLD,
} from "./UnemployedOpeningsReveal";
import { RipCardReveal, calculateRipCardMetadata } from "./RipCardReveal";
import { ListReveal, TOTAL_FRAMES as LIST_TOTAL_FRAMES } from "./ListReveal";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PrimeEpopReveal"
        component={PrimeEpopReveal}
        durationInFrames={Math.round(FPS * (DRAW_SECONDS + HOLD_SECONDS))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="PrimeEpopZoomOut"
        component={PrimeEpopZoomOut}
        durationInFrames={Math.round(FPS * (ZO_DRAW + HOLD1_SECONDS + ZOOM_SECONDS + HOLD2_SECONDS))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="UnrateReveal"
        component={UnrateReveal}
        durationInFrames={Math.round(FPS * (UR_DRAW + UR_HOLD))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="UnemployedOpeningsReveal"
        component={UnemployedOpeningsReveal}
        durationInFrames={Math.round(FPS * (UO_DRAW + UO_HOLD))}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* One generic label-reveal shape, reused for every future card --
          actual labels/holdSeconds come from --props at render time (see
          render-cards.sh), not from new compositions. defaultProps below is
          only what Studio shows when you open this composition directly. */}
      <Composition
        id="RipCardReveal"
        component={RipCardReveal}
        calculateMetadata={calculateRipCardMetadata}
        defaultProps={{ text: "25-54 EPOP" }}
        durationInFrames={150}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* Numbered build-up list: title + rows, one row wipes in left-to-
          right per render. See render-list-cards.sh for how a topic's cards
          are made. Fixed 1.5s duration -- no calculateMetadata needed. */}
      <Composition
        id="ListReveal"
        component={ListReveal}
        defaultProps={{
          title: "Full Employment Signs",
          items: ["25-54 employment rate", "Unemployment rate", "Vacancy-to-unemployment ratio"],
          activeIndex: 0,
        }}
        durationInFrames={LIST_TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
