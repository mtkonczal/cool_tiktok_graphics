import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import "./fonts";
import { TitleCardBody, TITLE_FRAME } from "./TitleCardBody";

export const FPS = 30;

export type TitleCardProps = {
  /** Omit for no eyebrow/dot at all -- the default (see CLAUDE.md's Title
   * cards section). */
  episodeNumber?: string;
  lines: [string, string, string, string, string];
  popLine: number;
};

export const TitleCard: React.FC<TitleCardProps> = ({ episodeNumber, lines, popLine }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#191510" }}>
      <TitleCardBody
        episodeNumber={episodeNumber}
        lines={lines}
        popLine={popLine}
        frame={frame}
        fps={fps}
      />
    </AbsoluteFill>
  );
};

export { TITLE_FRAME };
