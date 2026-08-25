// Timing + geometry for the "rip card" reveal: a single big label sits on
// screen the whole time, covered by a torn flap split down the middle. On
// cue the flap tears apart and flies off both sides revealing the label,
// which holds, then the whole card disappears. One shape, reused for every
// new label -- see .claude/skills/tiktok-chart/SKILL.md for the render
// workflow (one JSON file of labels in, one video per label out).

export const PRE_HOLD_FRAMES = 6; // beat before the tear starts
export const RIP_FRAMES = 16; // ~0.53s at 30fps -- fast and punchy, not a slow wipe
export const DISAPPEAR_FRAMES = 10; // quick fade/lift at the end
export const DEFAULT_HOLD_SECONDS = 4; // label fully revealed before it disappears

export function ripCardDurationFrames(holdSeconds: number, fps: number): number {
  return PRE_HOLD_FRAMES + RIP_FRAMES + Math.round(fps * holdSeconds) + DISAPPEAR_FRAMES;
}

// Deterministic tear silhouette (not randomized) so every render of the same
// composition tears identically -- reproducible frames, consistent brand
// look across every future topic. Values are x-offsets in px from the
// vertical center seam, sampled top to bottom.
export const TEAR_OFFSETS = [0, 22, -14, 30, -20, 12, -26, 18, -8, 24, -18, 10, 0];

export function tearSeam(height: number): { dx: number; y: number }[] {
  const n = TEAR_OFFSETS.length - 1;
  return TEAR_OFFSETS.map((dx, i) => ({ dx, y: (height * i) / n }));
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);

export type Box = { x: number; y: number; width: number; height: number };

// The torn-flap polygons for an arbitrary rectangle -- used both for a
// full-frame single-label card and for one row of a build-up list, so the
// seam geometry only needs to be right in one place.
export function tearFlapPaths(box: Box): { left: string; right: string } {
  const { x, y, width, height } = box;
  const centerX = x + width / 2;
  const seam = tearSeam(height).map((p) => ({ dx: p.dx, y: y + p.y }));

  const left =
    `M${x},${y} ` + seam.map((p) => `L${centerX + p.dx},${p.y}`).join(" ") + ` L${x},${y + height} Z`;
  const right =
    `M${x + width},${y} L${x + width},${y + height} ` +
    [...seam].reverse().map((p) => `L${centerX + p.dx},${p.y}`).join(" ") +
    ` Z`;
  return { left, right };
}

// Where a flap sits at rip-progress ripT (0 = fully covering, 1 = fully torn
// away), scaled to the rectangle it's covering rather than the full frame.
export function flapTransform(
  box: Box,
  ripT: number,
  side: "left" | "right"
): { transform: string; opacity: number } {
  const sign = side === "left" ? -1 : 1;
  const travel = box.width * 0.75 * sign;
  const rotate = 6 * ripT * sign;
  const pivotX = side === "left" ? box.x + box.width / 4 : box.x + (box.width * 3) / 4;
  const pivotY = box.y + box.height / 2;
  return {
    transform: `translate(${ripT * travel},0) rotate(${rotate} ${pivotX} ${pivotY})`,
    opacity: 1 - ripT,
  };
}
