import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import "./fonts";
import { PETROL, FRAME } from "./theme";
import { RipCardBody } from "./RipCardBody";
import { DEFAULT_HOLD_SECONDS, ripCardDurationFrames } from "./ripCardEngine";

export const FPS = 30;

export type RipCardProps = {
  /** The label the flap reveals, e.g. "25-54 EPOP". Wraps if it's long. */
  text: string;
  /** Small kicker above the label, e.g. "REASON 1". Omit for none. */
  eyebrow?: string;
  /** Seconds the label stays fully revealed before the card disappears. */
  holdSeconds?: number;
};

// Duration depends on holdSeconds, which varies per render (see
// render-cards.sh) -- calculateMetadata lets each render size its own
// composition instead of hardcoding one duration for every label.
export const calculateRipCardMetadata: CalculateMetadataFunction<RipCardProps> = async ({
  props,
}) => ({
  durationInFrames: ripCardDurationFrames(props.holdSeconds ?? DEFAULT_HOLD_SECONDS, FPS),
  fps: FPS,
  width: FRAME.width,
  height: FRAME.height,
});

export const RipCardReveal: React.FC<RipCardProps> = ({
  text,
  eyebrow,
  holdSeconds = DEFAULT_HOLD_SECONDS,
}) => {
  const frame = useCurrentFrame();
  const durationInFrames = ripCardDurationFrames(holdSeconds, FPS);

  return (
    <AbsoluteFill style={{ backgroundColor: PETROL.bg }}>
      <svg
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        width={FRAME.width}
        height={FRAME.height}
        xmlns="http://www.w3.org/2000/svg"
      >
        <RipCardBody text={text} eyebrow={eyebrow} frame={frame} durationInFrames={durationInFrames} />
      </svg>
    </AbsoluteFill>
  );
};
