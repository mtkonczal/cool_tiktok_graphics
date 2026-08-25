import React from "react";
import { useCurrentFrame } from "remotion";
import "./fonts";
import { ChartChrome } from "./ChartChrome";
import { ListRevealBody, TOTAL_FRAMES } from "./ListRevealBody";

export const FPS = 30;
export { TOTAL_FRAMES };

export type ListRevealProps = {
  /** Persistent title at the top, e.g. "Full Employment Signs". */
  title: string;
  /** Every label in the eventual list, in order. Spell out acronyms -- this
   *  is read at a glance, not explained on screen. */
  items: string[];
  /** Which item this render wipes in. Earlier items show already-revealed;
   *  later ones stay blank until their own render. 0-indexed. */
  activeIndex: number;
};

// Fixed 1.5s duration for every card -- no per-render hold/disappear
// anymore. Reuses ChartChrome for the title so this stays visually
// consistent with the chart family (same serif title treatment, same
// TEXTSAFE bounds) without duplicating that layout.
export const ListReveal: React.FC<ListRevealProps> = ({ title, items, activeIndex }) => {
  const frame = useCurrentFrame();
  return (
    <ChartChrome title={title}>
      <ListRevealBody items={items} activeIndex={activeIndex} frame={frame} />
    </ChartChrome>
  );
};
