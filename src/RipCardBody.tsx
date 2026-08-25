import React from "react";
import { Palette, PETROL, FRAME, TYPE } from "./theme";
import {
  PRE_HOLD_FRAMES,
  RIP_FRAMES,
  DISAPPEAR_FRAMES,
  tearFlapPaths,
  flapTransform,
  easeOutCubic,
  clamp01,
} from "./ripCardEngine";

// Pure shape: given a frame number and a duration, draws the covered label,
// the torn flap, and the two reveal/disappear phases. No timing constants of
// its own -- those live in ripCardEngine.ts so the composition and the body
// agree on when things happen.
export const RipCardBody: React.FC<{
  text: string;
  eyebrow?: string;
  frame: number;
  durationInFrames: number;
  palette?: Palette;
}> = ({ text, eyebrow, frame, durationInFrames, palette = PETROL }) => {
  const { width, height } = FRAME;
  const box = { x: 0, y: 0, width, height };

  const ripT = easeOutCubic(clamp01((frame - PRE_HOLD_FRAMES) / RIP_FRAMES));
  const disappearStart = durationInFrames - DISAPPEAR_FRAMES;
  const disappearT = easeOutCubic(clamp01((frame - disappearStart) / DISAPPEAR_FRAMES));

  const { left: leftPath, right: rightPath } = tearFlapPaths(box);
  const leftFlap = flapTransform(box, ripT, "left");
  const rightFlap = flapTransform(box, ripT, "right");

  const cardOpacity = 1 - disappearT;
  const cardTranslateY = -40 * disappearT;

  return (
    <g transform={`translate(0, ${cardTranslateY})`} opacity={cardOpacity}>
      <rect x={0} y={0} width={width} height={height} fill={palette.bg} />

      <foreignObject x={0} y={0} width={width} height={height}>
        <div
          // @ts-expect-error -- xmlns is valid on the foreignObject's HTML root
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "0 80px",
            boxSizing: "border-box",
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontFamily: TYPE.subtitle.family,
                fontWeight: 700,
                fontSize: TYPE.subtitle.size,
                letterSpacing: "0.12em",
                color: palette.accent,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              fontFamily: TYPE.card.family,
              fontWeight: TYPE.card.weight,
              fontSize: TYPE.card.size,
              lineHeight: TYPE.card.lineHeight,
              color: palette.text,
              textAlign: "center",
            }}
          >
            {text}
          </div>
        </div>
      </foreignObject>

      {/* torn cover -- same close-to-bg tone as the gridlines elsewhere, so
          it reads as a faint seam before the tear and a clean flap once it
          moves, without inventing a new color. */}
      <path
        d={leftPath}
        fill={palette.grid}
        stroke={palette.dim}
        strokeWidth={2}
        opacity={leftFlap.opacity}
        transform={leftFlap.transform}
      />
      <path
        d={rightPath}
        fill={palette.grid}
        stroke={palette.dim}
        strokeWidth={2}
        opacity={rightFlap.opacity}
        transform={rightFlap.transform}
      />
    </g>
  );
};
