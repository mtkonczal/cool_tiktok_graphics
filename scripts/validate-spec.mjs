#!/usr/bin/env node
// Validates a specs/*.json file against LineSpec's shape (src/compositions/
// LineVideo.tsx) before make.sh renders it -- catches a typo'd series ref
// or a malformed shot with a clear message instead of a cryptic crash 200
// frames into a render. Deliberately not a general JSON-Schema validator:
// this project has one spec shape, and hand-written checks give better
// error messages for it than a schema library would.
//
// Usage: node scripts/validate-spec.mjs <spec.json>
// Exits 0 and prints nothing on success; exits 1 and prints every problem
// found (not just the first) on failure.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const errors = [];
function fail(msg) {
  errors.push(msg);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE_RE = /^[+-]\d+m$/;
const ANNOTATION_KINDS = ["hline", "vline", "band", "point", "free"];
const SHOT_KINDS = ["draw", "hold", "zoom", "pan", "fade"];

function isString(v) {
  return typeof v === "string";
}
function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// A window bound valid at the spec's top level (spec.window): a literal
// date or "latest" -- NOT "min"/"max" and not a relative "-Nm" token, both
// of which only resolve against a window that's already been established
// (see resolveIndex/resolveWindow). A shot's own `window` additionally
// allows relative tokens.
function isAbsoluteToken(v) {
  return v === "latest" || (isString(v) && DATE_RE.test(v));
}
function isShotToken(v) {
  return isAbsoluteToken(v) || (isString(v) && RELATIVE_RE.test(v));
}
function isWaypointToken(v) {
  return v === "min" || v === "max" || isAbsoluteToken(v);
}

function checkWindow(win, where, { allowRelative } = {}) {
  if (!Array.isArray(win) || win.length !== 2) {
    fail(`${where}: must be a 2-element array [start, end], got ${JSON.stringify(win)}`);
    return;
  }
  const ok = allowRelative ? isShotToken : isAbsoluteToken;
  win.forEach((tok, i) => {
    if (!ok(tok)) {
      fail(
        `${where}[${i}]: "${tok}" is not a valid ${allowRelative ? "shot" : "spec"} window bound ` +
          `(expected "YYYY-MM-DD", "latest"${allowRelative ? ', or "-Nm"/"+Nm"' : ""})`
      );
    }
  });
  if (allowRelative && win.every((t) => isString(t) && RELATIVE_RE.test(t))) {
    fail(`${where}: both bounds are relative in ${JSON.stringify(win)} -- at least one must be absolute`);
  }
}

// Mirrors engine/shots.ts's nameShots: default name is the shot's kind,
// auto-suffixed only when a kind repeats. Needed here so from/until/
// duringShot references can be checked against the actual set of names a
// real render would produce.
function shotNames(shots) {
  const seen = {};
  return shots.map((s) => {
    if (isString(s?.name)) return s.name;
    const kind = s?.kind;
    seen[kind] = (seen[kind] ?? 0) + 1;
    return seen[kind] === 1 ? kind : `${kind}-${seen[kind]}`;
  });
}

function checkShotRef(value, field, validNames) {
  if (value === undefined) return;
  if (!isString(value)) {
    fail(`${field}: must be a string shot name, got ${JSON.stringify(value)}`);
    return;
  }
  if (!validNames.includes(value)) {
    fail(`${field}: "${value}" is not a shot name in this spec's shots array (have: ${validNames.join(", ")})`);
  }
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/validate-spec.mjs <spec.json>");
    process.exit(2);
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`${file}: ${e.message}`);
    process.exit(1);
  }

  if (spec.type === "sequence") {
    validateSequence(spec, file);
  } else {
    validateLineSpec(spec, file);
  }

  if (errors.length) {
    console.error(`${file}: ${errors.length} problem(s) found:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

function validateSequence(spec, file) {
  if (!isString(spec.id)) fail("id: required string");
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    fail("steps: required non-empty array");
    return;
  }
  const COMPOSITIONS = ["LineVideo", "RipCardReveal", "ListReveal"];
  spec.steps.forEach((step, i) => {
    if (!isString(step.composition) || !COMPOSITIONS.includes(step.composition)) {
      fail(`steps[${i}].composition: required, must be one of ${COMPOSITIONS.join("/")}`);
    }
    if (step.spec !== undefined && step.props !== undefined) {
      fail(`steps[${i}]: has both "spec" and "props" -- use exactly one`);
    }
    if (step.spec === undefined && step.props === undefined) {
      fail(`steps[${i}]: needs either "spec" (a spec file path) or "props" (inline props)`);
    }
    if (step.spec !== undefined && step.composition !== "LineVideo") {
      fail(`steps[${i}]: "spec" is only for composition "LineVideo" -- ${step.composition} takes inline "props"`);
    }
    if (step.spec !== undefined) {
      if (!isString(step.spec)) {
        fail(`steps[${i}].spec: must be a string path`);
      } else {
        const stepPath = path.resolve(path.dirname(path.resolve(file)), step.spec);
        let stepSpec;
        try {
          stepSpec = JSON.parse(readFileSync(stepPath, "utf8"));
        } catch (e) {
          fail(`steps[${i}].spec: cannot read/parse "${step.spec}" (${e.message})`);
          return;
        }
        validateLineSpec(stepSpec, step.spec);
      }
    }
  });
}

function validateLineSpec(spec, file) {
  const registry = JSON.parse(readFileSync(path.join(REPO_ROOT, "data", "series.json"), "utf8"));

  if (!isString(spec.id)) fail("id: required string");

  if (!Array.isArray(spec.series) || spec.series.length === 0) {
    fail("series: required non-empty array of { ref }");
  } else {
    spec.series.forEach((s, i) => {
      if (!isPlainObject(s) || !isString(s.ref)) {
        fail(`series[${i}]: must be an object { "ref": string }`);
      } else if (!(s.ref in registry)) {
        fail(`series[${i}].ref: "${s.ref}" is not in data/series.json`);
      }
    });
  }

  if (spec.chrome !== undefined) {
    if (!isPlainObject(spec.chrome)) fail("chrome: must be an object");
    else {
      if (spec.chrome.title !== undefined && !isString(spec.chrome.title)) fail("chrome.title: must be a string");
      if (spec.chrome.subtitle !== undefined && !isString(spec.chrome.subtitle)) fail("chrome.subtitle: must be a string");
    }
  }

  if (spec.palette !== undefined && spec.palette !== "petrol" && spec.palette !== "paper") {
    fail(`palette: must be "petrol" or "paper", got ${JSON.stringify(spec.palette)}`);
  }

  if (spec.window === undefined) {
    fail("window: required [start, end]");
  } else {
    checkWindow(spec.window, "window", { allowRelative: false });
  }

  if (spec.waypoints !== undefined) {
    if (!Array.isArray(spec.waypoints)) fail("waypoints: must be an array of tokens");
    else
      spec.waypoints.forEach((tok, i) => {
        if (!isWaypointToken(tok)) fail(`waypoints[${i}]: "${tok}" is not "min"/"max"/"latest"/a "YYYY-MM-DD" date`);
      });
  }

  if (spec.waypointAnchor !== undefined && spec.waypointAnchor !== "max" && spec.waypointAnchor !== "point") {
    fail(`waypointAnchor: must be "max" or "point", got ${JSON.stringify(spec.waypointAnchor)}`);
  }

  if (spec.waypointBelowDot !== undefined && !isWaypointToken(spec.waypointBelowDot)) {
    fail(`waypointBelowDot: "${spec.waypointBelowDot}" is not a valid waypoint token`);
  }

  if (spec.displayDecimals !== undefined && !isNumber(spec.displayDecimals)) {
    fail("displayDecimals: must be a number");
  }

  const shots = Array.isArray(spec.shots) ? spec.shots : [];
  const names = shotNames(shots);

  if (spec.waypointFade !== undefined) {
    if (!isPlainObject(spec.waypointFade) || !isWaypointToken(spec.waypointFade.token)) {
      fail('waypointFade: must be { "token": <waypoint token>, "duringShot"?: <shot name> }');
    } else {
      checkShotRef(spec.waypointFade.duringShot, "waypointFade.duringShot", names);
    }
  }

  if (spec.annotations !== undefined) {
    if (!Array.isArray(spec.annotations)) {
      fail("annotations: must be an array");
    } else {
      spec.annotations.forEach((a, i) => {
        const where = `annotations[${i}]`;
        if (a === "recessions") return;
        if (!isPlainObject(a) || !ANNOTATION_KINDS.includes(a.kind)) {
          fail(`${where}: must be "recessions" or an object with kind in ${ANNOTATION_KINDS.join("/")}`);
          return;
        }
        if (a.kind === "hline") {
          if (!isString(a.value)) fail(`${where}.value: required string (a number, "value:TOKEN", or "mean:TOKEN..TOKEN")`);
          if (!isString(a.label)) fail(`${where}.label: required string`);
          if (!isWaypointToken(a.labelAt)) fail(`${where}.labelAt: required valid token`);
          if (a.window !== undefined) checkWindow(a.window, `${where}.window`, { allowRelative: true });
        } else if (a.kind === "vline") {
          if (!isWaypointToken(a.at)) fail(`${where}.at: required valid token`);
          if (!isString(a.label)) fail(`${where}.label: required string`);
        } else if (a.kind === "band") {
          if (a.window === undefined) fail(`${where}.window: required [start, end]`);
          else checkWindow(a.window, `${where}.window`, { allowRelative: true });
          if (a.label !== undefined && !isString(a.label)) fail(`${where}.label: must be a string`);
        } else if (a.kind === "point") {
          if (!isWaypointToken(a.at)) fail(`${where}.at: required valid token`);
          if (!isString(a.label)) fail(`${where}.label: required string`);
          if (a.value !== undefined && !isString(a.value)) fail(`${where}.value: must be a string expression`);
        } else if (a.kind === "free") {
          if (!isNumber(a.x) || a.x < 0 || a.x > 1) fail(`${where}.x: required number in [0, 1]`);
          if (!isNumber(a.y) || a.y < 0 || a.y > 1) fail(`${where}.y: required number in [0, 1]`);
          if (!isString(a.label)) fail(`${where}.label: required string`);
          if (a.align !== undefined && !["start", "middle", "end"].includes(a.align)) {
            fail(`${where}.align: must be "start"/"middle"/"end"`);
          }
        }
        checkShotRef(a.from, `${where}.from`, names);
        checkShotRef(a.until, `${where}.until`, names);
      });
    }
  }

  if (!Array.isArray(spec.shots) || spec.shots.length === 0) {
    fail("shots: required non-empty array");
  } else {
    spec.shots.forEach((s, i) => {
      const where = `shots[${i}]`;
      if (!isPlainObject(s) || !SHOT_KINDS.includes(s.kind)) {
        fail(`${where}.kind: must be one of ${SHOT_KINDS.join("/")}`);
        return;
      }
      if (!isNumber(s.seconds) || s.seconds <= 0) fail(`${where}.seconds: required positive number`);
      if (s.kind === "zoom" || s.kind === "pan") {
        if (s.window === undefined) fail(`${where}.window: required for a "${s.kind}" shot`);
        else checkWindow(s.window, `${where}.window`, { allowRelative: true });
      } else if (s.kind === "draw" || s.kind === "hold") {
        if (s.window !== undefined) checkWindow(s.window, `${where}.window`, { allowRelative: true });
        if (i === 0 && s.window === undefined && spec.window === undefined) {
          fail(`${where}: the first shot needs a window (spec.window is also missing, so there's nothing to inherit)`);
        }
      } else if (s.kind === "fade") {
        if (i === 0) fail(`${where}: the first shot cannot be "fade" -- it has no window to establish the initial view`);
        if (s.to !== undefined && s.to !== 0 && s.to !== 1) fail(`${where}.to: must be 0 or 1`);
      }
    });
  }
}

main();
