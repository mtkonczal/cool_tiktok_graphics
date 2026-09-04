import React from "react";
import { BG, ACCENT, EYEBROW_TEXT, BUTTER_YELLOW } from "./cardPalette";

// Pure shape for the "chapter card" -- a smaller, transitional cousin of
// TitleCardBody (src/TitleCardBody.tsx): identical corner mark and bottom
// bar (same size, same position), but a single-line headline in a full-
// horizontal 16:9 banner instead of TitleCardBody's full 1080x1080 reveal.
// See CLAUDE.md's Title cards section -- this is its own file because the
// two are separate one-off design briefs sharing only a palette, not a
// parameterized "big card / small card" system.
export const CARD_FRAME = { width: 1080, height: 608 } as const; // 16:9

export type CardBodyProps = {
  /** Full eyebrow text, e.g. "PART 02" -- rendered as-is (unlike
   * TitleCardBody's episodeNumber, this isn't "EP. "-prefixed). */
  eyebrowText: string;
  /** Single-line headline, e.g. "Corporate Power". */
  headline: string;
  /** Headline font size in px. 205 is the design spec's ceiling -- longer
   * headlines need a smaller value to stay on one line within the frame
   * (see CLAUDE.md's Title cards section: check this against the actual
   * headline length each time, same as the pop animation is re-tuned per
   * card). Defaults to 205. */
  fontSize?: number;
};

export const CardBody: React.FC<CardBodyProps> = ({ eyebrowText, headline, fontSize = 205 }) => {
  return (
    <div
      style={{
        width: CARD_FRAME.width,
        height: CARD_FRAME.height,
        backgroundColor: BG,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Corner mark: dot + eyebrow text -- identical size/position to TitleCardBody's */}
      <div
        style={{
          position: "absolute",
          top: 108,
          left: 108,
          height: 24,
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: ACCENT,
          }}
        />
        <div
          style={{
            fontFamily: "Archivo, sans-serif",
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: "0.18em",
            color: EYEBROW_TEXT,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {eyebrowText}
        </div>
      </div>

      {/* Headline, single line, bottom-left anchored -- identical anchor
          offsets to TitleCardBody's headline block */}
      <div
        style={{
          position: "absolute",
          left: 108,
          bottom: 118,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 800,
          fontSize,
          lineHeight: 0.94,
          letterSpacing: "-0.02em",
          color: BUTTER_YELLOW,
          whiteSpace: "nowrap",
        }}
      >
        {headline}
      </div>

      {/* Accent bar -- identical size, same 54px gap below the headline */}
      <div
        style={{
          position: "absolute",
          left: 108,
          bottom: 118 - 54 - 8,
          width: 172,
          height: 8,
          backgroundColor: ACCENT,
        }}
      />
    </div>
  );
};
