import React from "react";
import { Palette, PETROL, TEXTSAFE, TYPE } from "./theme";
import { clamp01 } from "./ripCardEngine";

// Row geometry. Sits below ChartChrome's title block (which ends well before
// y 420). 300px was the fixed row height this always used, sized for a
// 2-line label at 3 rows; now it's a ceiling instead of a constant, so a
// 4-6 item list shrinks to fit TEXTSAFE instead of running off the bottom
// (2-3 items still get exactly the original 300px rows, unchanged).
const LIST_TOP = 420;
const MAX_ROW_H = 300;
const NUM_COL_W = 110;

function rowHeight(itemCount: number): number {
  const available = TEXTSAFE.y + TEXTSAFE.h - LIST_TOP;
  return Math.min(MAX_ROW_H, available / itemCount);
}

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
  const rowH = rowHeight(items.length);

  return (
    <>
      {items.map((label, i) => {
        const rowY = LIST_TOP + i * rowH;
        const revealed = i < activeIndex;
        const active = i === activeIndex;
        const labelX = TEXTSAFE.x + NUM_COL_W;
        const labelW = TEXTSAFE.w - NUM_COL_W;

        return (
          <g key={i}>
            <foreignObject x={TEXTSAFE.x} y={rowY} width={NUM_COL_W} height={rowH}>
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
              <foreignObject x={labelX} y={rowY} width={labelW} height={rowH}>
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
