import React from "react";
import { interpolate, spring } from "remotion";
import { BG, ACCENT, EYEBROW_TEXT, HEADLINE_TEXT, BUTTER_YELLOW } from "./cardPalette";

// Pure shape for the square (1080x1080) episode-cover title tile. Not part
// of the vertical (1080x1920) chart family -- no TEXTSAFE/ROW/PLOT geometry
// applies here, this is a standalone bespoke composition (see CLAUDE.md
// Section 11: a genuinely new shape gets its own file, not a bent spec).
export const TITLE_FRAME = { width: 1080, height: 1080 } as const;

export type TitleCardBodyProps = {
  /** Eyebrow kicker, e.g. "01" -> renders the dot + "EP. 01". Omit for
   * neither -- the default going forward (see CLAUDE.md's Title cards
   * section); only pass this for a card that actually wants episode
   * numbering back. */
  episodeNumber?: string;
  /** Exactly 5 headline lines, rendered as hard line breaks (no wrapping). */
  lines: [string, string, string, string, string];
  /** Which line (0-indexed) gets the pop-color + pop-in animation. */
  popLine: number;
  frame: number;
  fps: number;
};

export const TitleCardBody: React.FC<TitleCardBodyProps> = ({
  episodeNumber,
  lines,
  popLine,
  frame,
  fps,
}) => {
  // Everything else is static from frame 0; only the pop line animates in --
  // a short beat, then a spring with overshoot so it reads as "popping".
  const POP_START = Math.round(fps * 0.27); // ~8 frames at 30fps
  const popProgress = spring({
    frame: frame - POP_START,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 200 },
  });
  const popOpacity = interpolate(frame - POP_START, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: TITLE_FRAME.width,
        height: TITLE_FRAME.height,
        backgroundColor: BG,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Eyebrow: dot + "EP. 0N" -- only when episodeNumber is passed */}
      {episodeNumber && (
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
            EP. {episodeNumber}
          </div>
        </div>
      )}

      {/* Headline, anchored to the bottom-left */}
      <div
        style={{
          position: "absolute",
          left: 108,
          bottom: 118,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {lines.map((line, i) => {
          const isPop = i === popLine;
          return (
            <div
              key={i}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 800,
                fontSize: 140,
                lineHeight: 0.96,
                letterSpacing: "-0.02em",
                color: isPop ? BUTTER_YELLOW : HEADLINE_TEXT,
                whiteSpace: "nowrap",
                ...(isPop
                  ? {
                      opacity: popOpacity,
                      transform: `scale(${popProgress})`,
                      transformOrigin: "left center",
                    }
                  : {}),
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Accent bar, below the headline */}
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
