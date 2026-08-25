import React from "react";
import { AbsoluteFill } from "remotion";
import { BG, TEXT_LIGHT, TEXT_MUTED } from "./chartEngine";

// Shared "chrome" for every chart in this library: background, title block,
// source caption, and the glow filter used for the accent-colored strokes.
// Chart-type-specific compositions render their own SVG content as children.
export const ChartChrome: React.FC<{
  title: string;
  subtitle: string;
  sourceLine1: string;
  sourceLine2?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, sourceLine1, sourceLine2, children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <svg
        viewBox="0 0 1080 1920"
        width="1080"
        height="1920"
        xmlns="http://www.w3.org/2000/svg"
        style={{ fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif' }}
      >
        <rect width={1080} height={1920} fill={BG} />
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="blur" />
          </filter>
        </defs>
        <text x={100} y={100} fontSize={34} fontWeight={700} fill={TEXT_LIGHT}>
          {title}
        </text>
        <text x={100} y={140} fontSize={21} fill={TEXT_MUTED}>
          {subtitle}
        </text>
        <text x={100} y={1855} fontSize={15} fill={TEXT_MUTED}>
          {sourceLine1}
        </text>
        {sourceLine2 && (
          <text x={100} y={1880} fontSize={15} fill={TEXT_MUTED}>
            {sourceLine2}
          </text>
        )}
        {children}
      </svg>
    </AbsoluteFill>
  );
};
