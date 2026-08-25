import React from "react";
import { Composition } from "remotion";
import { LineVideo, LineSpec, calculateLineMetadata } from "./compositions/LineVideo";
import { RipCardReveal, calculateRipCardMetadata } from "./RipCardReveal";
import { ListReveal, TOTAL_FRAMES as LIST_TOTAL_FRAMES } from "./ListReveal";

const FPS = 30;

// Remotion's --props shallow-merges the render-time spec ONTO defaultProps
// rather than replacing it, so any optional field this default sets (avg,
// initialWindowStart, waypointFade, ...) would silently survive into every
// spec rendered here that doesn't itself set that field -- a real bug this
// project hit once already (see PLAN.md Phase 2 verification notes). Keeping
// this to only the fields every LineSpec must set means there is nothing
// optional left to leak, for this spec or any future one.
const STUDIO_DEFAULT_SPEC: LineSpec = {
  id: "studio-default",
  series: [{ ref: "prime_epop" }],
  window: ["2019-01-01", "latest"],
  shots: [
    { kind: "draw", seconds: 4.5 },
    { kind: "hold", seconds: 6 },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* One generic line-chart shape, reused for every line video -- which
          spec loads comes from --props at render time (see specs/*.json),
          not from a new composition per video. defaultProps below is only
          what Studio shows when you open this composition directly. */}
      <Composition
        id="LineVideo"
        component={LineVideo}
        calculateMetadata={calculateLineMetadata}
        defaultProps={STUDIO_DEFAULT_SPEC}
        durationInFrames={30}
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
