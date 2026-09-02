import React from "react";
import { AbsoluteFill } from "remotion";
import "./fonts";
import { Palette, PETROL, FRAME, ROW, TABULAR, TEXTSAFE, TYPE as DEFAULT_TYPE } from "./theme";
import { ThemeType } from "./themes/types";

// Shared "chrome" for every chart in this library: background and the title
// block. Chart-type-specific compositions render their own SVG as children.
//
// Deliberately absent, compared with the first version of this file:
//   - the glow filter        -- the chart bodies use a knockout stroke instead
//   - the source caption     -- it sat at y 1855, which on TikTok is behind the
//                               app's nav bar. Sourcing lives in the post
//                               caption and in replies to comments.
//   - any wordmark           -- not earning its space.
export const ChartChrome: React.FC<{
  title: string;
  subtitle?: string;
  /** Second subtitle line, for when the first would run past TEXTSAFE. */
  subtitle2?: string;
  palette?: Palette;
  /** The active theme's type scale (src/themes/) -- defaults to
   * konczal_webpage's for any caller that isn't theme-aware (BarVideo,
   * RipCardReveal, ListReveal). Shadows the module-level `TYPE` import
   * below, so title/subtitle rendering follows the resolved theme without
   * touching the JSX itself. */
  type?: ThemeType;
  children: React.ReactNode;
}> = ({ title, subtitle, subtitle2, palette = PETROL, type = DEFAULT_TYPE, children }) => {
  const TYPE = type;
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg }}>
      <svg
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        width={FRAME.width}
        height={FRAME.height}
        xmlns="http://www.w3.org/2000/svg"
        style={TABULAR}
      >
        <rect width={FRAME.width} height={FRAME.height} fill={palette.bg} />

        <text
          x={TEXTSAFE.x}
          y={ROW.title}
          fontFamily={TYPE.title.family}
          fontSize={TYPE.title.size}
          fontWeight={TYPE.title.weight}
          letterSpacing={TYPE.title.tracking}
          fill={palette.text}
        >
          {title}
        </text>

        {subtitle && (
          <text
            x={TEXTSAFE.x}
            y={ROW.sub1}
            fontFamily={TYPE.subtitle.family}
            fontSize={TYPE.subtitle.size}
            fontWeight={TYPE.subtitle.weight}
            fill={palette.dim}
          >
            {subtitle}
          </text>
        )}
        {subtitle2 && (
          <text
            x={TEXTSAFE.x}
            y={ROW.sub2}
            fontFamily={TYPE.subtitle.family}
            fontSize={TYPE.subtitle.size}
            fontWeight={TYPE.subtitle.weight}
            fill={palette.dim}
          >
            {subtitle2}
          </text>
        )}

        {children}
      </svg>
    </AbsoluteFill>
  );
};
