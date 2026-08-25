import { DataRow, dataMaxAndPadMulti, ease, ylimForMulti } from "./scales";
import { resolveIndex } from "./waypoints";

// The camera language for a line video: a sequence of shots, each with a
// duration, that together describe everything the frame does over time --
// what's drawn, what's in view, whether something is fading. This is a
// direct extraction of the draw/hold/zoom/hold ladder that used to live
// hardcoded in PrimeEpopZoomOut.tsx (then, after Phase 2, in
// compositions/LineVideo.tsx): the math is unchanged, just generalized so
// a second zoom, a pan, or a zoom-*in* is a config change instead of a new
// branch of hand-written interpolation.
//
// A window bound is a literal "YYYY-MM-DD" date, the keyword "latest" (the
// last row with data), or a relative offset like "-48m" / "+6m" (N months
// before/after the OTHER bound in the same pair) -- see resolveWindow.
export type ShotWindow = [string, string];

export type Shot =
  | { kind: "draw"; seconds: number; window?: ShotWindow; name?: string }
  | { kind: "hold"; seconds: number; window?: ShotWindow; name?: string }
  | { kind: "zoom"; seconds: number; window: ShotWindow; name?: string }
  | { kind: "pan"; seconds: number; window: ShotWindow; name?: string }
  | { kind: "fade"; seconds: number; to?: 0 | 1; name?: string };

export type ShotResult = {
  i0: number;
  tipExact: number;
  xDomain: [number, number];
  yDomain: [number, number];
  calloutBase: { max: number; pad: number };
  zoomFactor: number;
  opacity: number;
  shotName: string;
  shotT: number;
  /** Raw (un-eased) 0-1 completion for every shot, keyed by name (or by
   * kind, auto-suffixed on collision -- see nameShots). 0 before a shot
   * starts, rises linearly while it's active, pinned at 1 once it's done
   * -- forever after, not just at the moment it finishes. Lets a spec tie
   * an effect (a fading waypoint, a Phase 4 annotation's from/until) to a
   * specific shot without this module knowing anything about waypoints or
   * annotations. */
  shotProgress: Record<string, number>;
  /** Whether frame has reached each shot's start at all -- shotProgress
   * alone can't distinguish "not started" from "just started" (both read
   * 0), and that distinction matters for a state that should flip on at a
   * shot's first frame rather than ease in (e.g. the average line in
   * prime-epop-zoomout.json, which should be visible on zoom's very first
   * frame, not fade in with it). */
  shotStarted: Record<string, boolean>;
};

const RELATIVE_RE = /^([+-]\d+)m$/;

function resolveWindowBound(data: DataRow[], token: string, otherIdx?: number): number {
  const rel = RELATIVE_RE.exec(token);
  if (rel) {
    if (otherIdx === undefined) {
      throw new Error(`resolveWindowBound: relative token "${token}" needs the other bound resolved first`);
    }
    return otherIdx + parseInt(rel[1], 10);
  }
  return resolveIndex(data, token);
}

// Resolves a [start, end] window against `data`'s dates. At most one bound
// may be relative ("-48m" etc) -- it resolves against whichever bound is
// literal/"latest", so ["-48m", "latest"] means "48 months before the last
// row with data," and moves forward automatically as fresh months arrive
// (unlike an absolute date, which stays pinned).
export function resolveWindow(data: DataRow[], window: ShotWindow): { i0: number; i1: number } {
  const [a, b] = window;
  const aRel = RELATIVE_RE.test(a);
  const bRel = RELATIVE_RE.test(b);
  if (aRel && bRel) throw new Error(`resolveWindow: both bounds are relative in [${a}, ${b}]`);
  if (aRel) {
    const i1 = resolveWindowBound(data, b);
    return { i0: resolveWindowBound(data, a, i1), i1 };
  }
  const i0 = resolveWindowBound(data, a);
  return { i0, i1: resolveWindowBound(data, b, i0) };
}

// `dataArrays` is every plotted series, already aligned onto a shared date
// grid (see alignToGrid in scales.ts) -- a 2-line spec's y-domain spans
// both lines rather than clipping whichever isn't first.
function windowGeom(dataArrays: DataRow[][], i0: number, i1: number) {
  const span = i1 - i0;
  const xDomain: [number, number] = [i0 - span * 0.02, i1 + span * 0.05];
  const yDomain = ylimForMulti(dataArrays, i0, i1);
  const cb = dataMaxAndPadMulti(dataArrays, i0, i1);
  return { xDomain, yDomain, cb };
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function lerpPair(a: [number, number], b: [number, number], t: number): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

// Default names by kind, auto-suffixed only when a kind repeats (matching
// e.g. prime-epop-zoomout.json's two "hold" shots) -- so the common case of
// one shot per kind stays referenceable by its bare kind ("zoom"), and a
// spec only needs an explicit `name` when it actually wants one.
function nameShots(shots: Shot[]): string[] {
  const seen: Record<string, number> = {};
  return shots.map((shot) => {
    if (shot.name) return shot.name;
    seen[shot.kind] = (seen[shot.kind] ?? 0) + 1;
    return seen[shot.kind] === 1 ? shot.kind : `${shot.kind}-${seen[shot.kind]}`;
  });
}

// "fade" has no window field at all (it never changes what's in view), so a
// plain `shot.window` doesn't typecheck across the whole union -- this reads
// as "the window this shot declares, or none" for every kind uniformly.
function shotWindow(shot: Shot): ShotWindow | undefined {
  return shot.kind === "fade" ? undefined : shot.window;
}

export function shotsDurationSeconds(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + s.seconds, 0);
}

export function resolveShot(shots: Shot[], frame: number, fps: number, dataArrays: DataRow[][]): ShotResult {
  if (!shots.length) throw new Error("resolveShot: shots array is empty");
  const primary = dataArrays[0];
  const names = nameShots(shots);

  const first = shots[0];
  const firstWindow = shotWindow(first);
  if (!firstWindow) {
    throw new Error("resolveShot: the first shot must declare a window -- there is no previous shot to inherit from");
  }

  let window = resolveWindow(primary, firstWindow);
  let geom = windowGeom(dataArrays, window.i0, window.i1);
  const firstWidth = geom.xDomain[1] - geom.xDomain[0];

  let i0 = window.i0;
  let tipExact = window.i0;
  let opacity = 1;
  let shotName = names[0];
  let shotT = 0;
  const shotProgress: Record<string, number> = {};
  const shotStarted: Record<string, boolean> = {};

  let acc = 0;
  shots.forEach((shot, idx) => {
    const shotFrames = Math.max(1, Math.round(fps * shot.seconds));
    const local = frame - acc;
    const name = names[idx];
    const started = local >= 0;
    const rawFrac = started ? Math.min(local / shotFrames, 1) : 0;
    shotProgress[name] = rawFrac;
    shotStarted[name] = started;

    if (started) {
      shotName = name;
      shotT = rawFrac;

      if (shot.kind === "draw") {
        const w = shot.window ? resolveWindow(primary, shot.window) : window;
        window = w;
        geom = windowGeom(dataArrays, w.i0, w.i1);
        i0 = w.i0;
        tipExact = w.i0 + rawFrac * (w.i1 - w.i0);
        opacity = 1;
      } else if (shot.kind === "hold") {
        const w = shot.window ? resolveWindow(primary, shot.window) : window;
        window = w;
        geom = windowGeom(dataArrays, w.i0, w.i1);
        i0 = w.i0;
        tipExact = w.i1;
        opacity = 1;
      } else if (shot.kind === "zoom" || shot.kind === "pan") {
        const target = resolveWindow(primary, shot.window);
        const targetGeom = windowGeom(dataArrays, target.i0, target.i1);
        const t = ease(rawFrac);
        geom = {
          xDomain: lerpPair(geom.xDomain, targetGeom.xDomain, t),
          yDomain: lerpPair(geom.yDomain, targetGeom.yDomain, t),
          cb: { max: lerp(geom.cb.max, targetGeom.cb.max, t), pad: lerp(geom.cb.pad, targetGeom.cb.pad, t) },
        };
        // Never erase already-drawn history: the visible line spans the
        // union of the window we're leaving and the one we're moving to,
        // regardless of which is wider -- a zoom-out reveals older history
        // instantly (matching the original PrimeEpopZoomOut behavior) and a
        // zoom-in doesn't retroactively hide what's already been drawn.
        i0 = Math.min(window.i0, target.i0);
        tipExact = Math.max(window.i1, target.i1);
        opacity = 1;
        window = target;
      } else {
        const to = shot.to ?? 1;
        opacity = lerp(1 - to, to, ease(rawFrac));
      }
    }
    acc += shotFrames;
  });

  return {
    i0,
    tipExact,
    xDomain: geom.xDomain,
    yDomain: geom.yDomain,
    calloutBase: geom.cb,
    zoomFactor: (geom.xDomain[1] - geom.xDomain[0]) / firstWidth,
    opacity,
    shotName,
    shotT,
    shotProgress,
    shotStarted,
  };
}
