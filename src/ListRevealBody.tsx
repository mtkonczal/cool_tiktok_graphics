import React from "react";
import { Palette, PETROL, TEXTSAFE, TYPE } from "./theme";
import { clamp01 } from "./ripCardEngine";

// Row geometry. Sits below ChartChrome's title block (which ends well before
// y 420), three rows fit inside TEXTSAFE with room for a 2-line label.
const LIST_TOP = 420;
const ROW_H = 300;
const NUM_COL_W = 110;

export const REVEAL_FRAMES = 24; // 0.8s of the 1.5s clip is the wipe itself
export const TOTAL_FRAMES = 45; // 1.5s at 30fps, fixed -- no per-card hold anymore

// Pure shape: a numbered list where every row before `activeIndex` is
// already fully revealed (that happened in an earlier video), `activeIndex`
// wipes its label in left-to-right this frame, and later rows are blank
// placeholders (just the numeral) until their own turn. No cover, no
// tear -- just a clip-path reveal.
export const ListRevealBody: React.FC<{
  items: string[];
  activeIndex: number;
  frame: number;
  palette?: Palette;
}> = ({ items, activeIndex, frame, palette = PETROL }) => {
  // Linear, not eased -- an eased ramp front-loads so hard it looks like a
  // near-instant snap rather than a visible left-to-right sweep at this
  // short a duration.
  const revealT = clamp01(frame / REVEAL_FRAMES);

  return (
    <>
      {items.map((label, i) => {
        const rowY = LIST_TOP + i * ROW_H;
        const revealed = i < activeIndex;
        const active = i === activeIndex;
        const labelX = TEXTSAFE.x + NUM_COL_W;
        const labelW = TEXTSAFE.w - NUM_COL_W;

        return (
          <g key={i}>
            <foreignObject x={TEXTSAFE.x} y={rowY} width={NUM_COL_W} height={ROW_H}>
              <div
                // @ts-expect-error -- xmlns is valid on the foreignObject's HTML root
                xmlns="http://www.w3.org/1999/xhtml"
                style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}
              >
                <div
                  style={{
                    fontFamily: TYPE.listItem.family,
                    fontWeight: TYPE.listItem.weight,
                    fontSize: TYPE.listItem.size,
                    color: palette.dim,
                  }}
                >
                  {i + 1}.
                </div>
              </div>
            </foreignObject>

            {(revealed || active) && (
              <foreignObject x={labelX} y={rowY} width={labelW} height={ROW_H}>
                <div
                  // @ts-expect-error -- xmlns is valid on the foreignObject's HTML root
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}
                >
                  <div
                    style={{
                      width: "100%",
                      fontFamily: TYPE.listItem.family,
                      fontWeight: TYPE.listItem.weight,
                      fontSize: TYPE.listItem.size,
                      lineHeight: TYPE.listItem.lineHeight,
                      color: palette.text,
                      clipPath: active ? `inset(0 ${(1 - revealT) * 100}% 0 0)` : undefined,
                    }}
                  >
                    {label}
                  </div>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </>
  );
};
