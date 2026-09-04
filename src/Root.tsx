import React from "react";
import { Composition } from "remotion";
import { LineVideo, LineSpec, calculateLineMetadata } from "./compositions/LineVideo";
import { BarVideo, BarSpec, calculateBarMetadata } from "./compositions/BarVideo";
import { CategoryBarVideo, CategoryBarSpec, calculateCategoryBarMetadata } from "./compositions/CategoryBarVideo";
import { RipCardReveal, calculateRipCardMetadata } from "./RipCardReveal";
import { ListReveal, TOTAL_FRAMES as LIST_TOTAL_FRAMES } from "./ListReveal";
import { TitleCard, TitleCardProps } from "./TitleCard";
import { Card, CardProps } from "./Card";

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

const STUDIO_DEFAULT_BAR_SPEC: BarSpec = {
  id: "studio-default-bar",
  type: "bar",
  series: [
    { ref: "payrolls_change_1st", label: "1st estimate" },
    { ref: "payrolls_change_2nd", label: "2nd estimate" },
    { ref: "payrolls_change_3rd", label: "3rd estimate" },
  ],
  window: ["2026-01-01", "latest"],
  revealSeconds: 4,
  holdSeconds: 5,
};

const STUDIO_DEFAULT_CATEGORY_BAR_SPEC: CategoryBarSpec = {
  id: "studio-default-category-bar",
  type: "category-bar",
  categories: [
    { ref: "payrolls_change", label: "All jobs" },
    { ref: "private_change", label: "Private sector" },
    { ref: "leisure_change", label: "Leisure & hospitality" },
    { ref: "local_gov_education_change", label: "Local gov't education" },
  ],
  revealSeconds: 3,
  holdSeconds: 6,
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
      {/* One generic grouped-bar shape, reused for every bar video -- see
          src/compositions/BarVideo.tsx. Same --props-at-render-time pattern
          as LineVideo above. */}
      <Composition
        id="BarVideo"
        component={BarVideo}
        calculateMetadata={calculateBarMetadata}
        defaultProps={STUDIO_DEFAULT_BAR_SPEC}
        durationInFrames={30}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* One generic category-diverging-bar shape, reused for every category
          snapshot video -- see src/compositions/CategoryBarVideo.tsx. Same
          --props-at-render-time pattern as LineVideo/BarVideo above. */}
      <Composition
        id="CategoryBarVideo"
        component={CategoryBarVideo}
        calculateMetadata={calculateCategoryBarMetadata}
        defaultProps={STUDIO_DEFAULT_CATEGORY_BAR_SPEC}
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
      {/* Square (1080x1080) TikTok title/cover tile -- not part of the
          vertical chart family, its own bespoke shape (CLAUDE.md Section 11
          / "Title cards"). Fixed 2s duration. No eyebrow/dot by default; the
          pop-in effect on whichever line popLine names is the one shipped
          example -- expect to hand-edit TitleCardBody.tsx's animation for
          the next card's own "cool little graphic thing" (see CLAUDE.md). */}
      <Composition
        id="TitleCard"
        component={TitleCard}
        defaultProps={
          {
            lines: ["Why you", "are", "squeezed:", "lowest labor", "share ever"],
            popLine: 2,
          } satisfies TitleCardProps
        }
        durationInFrames={60}
        fps={FPS}
        width={1080}
        height={1080}
      />
      {/* Chapter card -- a smaller, transitional cousin of TitleCard: full
          width, 16:9 banner instead of a full 1080x1080 reveal. Same corner
          mark + bottom bar as TitleCard (src/cardPalette.ts), single-line
          headline. See CLAUDE.md's Title cards section. */}
      <Composition
        id="Card"
        component={Card}
        defaultProps={
          {
            eyebrowText: "PART 02",
            headline: "Corporate Power",
            fontSize: 115,
          } satisfies CardProps
        }
        durationInFrames={60}
        fps={FPS}
        width={1080}
        height={608}
      />
    </>
  );
};
