# CLAUDE.md

## 1. What this is

A factory for short vertical (TikTok-format) economic data videos. The
workflow: "line graph of the quits rate, 2019 to now, zoom out at the end"
becomes a small JSON spec file, `./make.sh <spec.json>` renders it, you get
an mp4. No new React component, no edit to `Root.tsx`, no hand-picked peak
date to go stale next month.

Three layers, each independently useful:

- **Data** (`data/series.json`, `data/fetch.R`) — a registry of named series
  pulled from FRED, with a vintage record of when and what was fetched.
- **Engine** (`src/engine/*.ts`) — scales, number formatting, waypoint
  resolvers, the shot camera language, the annotation grammar. Pure
  functions, no React, no rendering.
- **Compositions/bodies** (`src/compositions/LineVideo.tsx`,
  `src/bodies/LineBody.tsx`, plus the card family) — turn a resolved spec
  into pixels.

`PLAN.md` is the design history — phase by phase, what was built and why,
including the bugs found along the way. This file is the reference for
using what's already built. Read `PLAN.md` when you want to know *why*
something is shaped the way it is or *what's not built yet*; read this file
to actually do something.

## 2. Repo conventions

- **Commits happen directly on `main`**, one commit per unit of work, only
  after that work has been rendered and checkpoint-verified (see Section
  11). No feature-branch workflow is in use — this is a single-maintainer
  repo today. Reconsider if that ever changes.
- **`npm ci`, not `npm install`**, on a fresh clone or after pulling —
  `package.json`'s versions are unpinned-caret-free on purpose (Remotion
  `4.0.515` exactly, not `^4.0.290`) so the lockfile is what actually
  determines what renders, not whatever `npm install` feels like resolving
  that day.
- **What's committed and why**: `node_modules/` and `out/` are gitignored —
  `out/` because an mp4 is derived (spec + committed data + this code
  reproduce it exactly) and is an already-compressed binary git can't delta.
  `src/data/*.json` and `*.meta.json` **are** committed despite looking
  derived — FRED revises, so a re-fetch six months from now returns
  different numbers than the vintage a published video actually showed. The
  meta sidecar is that vintage record. `.claude/` is gitignored (local
  per-machine state); this file is not.
- **`out/` nests by data-release folder.** `make.sh`'s `dated_out_path`
  derives the output path from the spec file's own location: a spec in a
  `specs/<release>/` subfolder (e.g. `specs/jobs-day/foo.json`) renders into
  the matching `out/<release>/` subfolder; a top-level spec (`specs/foo.json`)
  still renders flat into `out/`, unchanged. This falls out of where the
  spec file lives, not a per-spec setting -- a new `specs/<release>/` folder
  for a future data release gets its own `out/<release>/` for free.
- **`git mv` for every file relocation**, so history follows the file. For a
  case-only rename specifically (macOS is case-insensitive, GitHub/Linux
  CI are not), do it in two commits: `git mv foo.ts tmp && git mv tmp Foo.ts`
  — a single-commit case-only rename doesn't register as a rename on a
  case-insensitive filesystem.
- **A published spec is frozen.** Once a video has been rendered and posted,
  don't edit its `specs/*.json` file — the `out/` mp4 is gitignored, so the
  spec is the only durable record of exactly what was shown. If the video
  needs a revision, write a new spec file (or, for an NBER recession band,
  remember the shorthand also silently updates if a new recession gets
  dated after the fact — that's a feature, not a reason to re-edit a spec
  that's already shipped).
- **Remotion's license is settled**: source-available, not MIT, but the free
  tier explicitly covers individuals, organizations up to 3 employees, and
  **non-profits**. Economic Security Project is a non-profit, so free-tier
  use is permitted, including commercially. This would only need
  re-litigating if the project moved under a for-profit entity.

## 3. Adding a series

Add an entry to `data/series.json`:

```jsonc
"vu_ratio": {
  "source": "derived",              // "fred" (one FRED id) or "derived" (expr over other FRED ids)
  "inputs": { "v": "JTSJOL", "u": "UNEMPLOY" },   // derived only
  "expr": "v / u",                                 // derived only -- eval'd in R
  "units": "ratio",                  // see src/engine/format.ts's Unit type
  "decimals": 2,                     // storage precision, not necessarily display precision
  "title": "Vacancy-to-unemployment ratio",
  "subtitle": "Job openings per unemployed worker",
  "note": "..."                      // see below -- required for anything non-obvious
}
```

For `"source": "fred"`, add `"id"` (the FRED series ID) instead of
`inputs`/`expr`.

**The `note` field is not optional for anything a future reader would have
to guess at.** If a series is derived rather than the "obvious" published
number (e.g. `unrate` is `100 * UNEMPLOY / CLF16OV`, not the pre-rounded
`UNRATE` release), if it has a real gap, if it starts later than you'd
expect, if a display value differs from a stored value — write it down.
This is the single fix Phase 1 made for the biggest gap the original
prototype had: five pasted-in data files with no record of where they came
from.

Then:

```bash
Rscript data/fetch.R vu_ratio          # writes src/data/vu_ratio.json + .meta.json
```

**One manual step the registry can't do for you**: add the new series to
`src/data/registry.ts`'s static `SERIES_DATA` import map. Remotion's
bundler needs a literal, static `import` graph — it can't resolve
`` require(`./${name}.json`) `` — so this file is the one place that has to
change by hand when the registry gains an entry. `src/data/seriesMeta.ts`
needs no such update; it reads `data/series.json` directly.

## 4. Writing a spec

One file per video under `specs/`. Full annotated example — every field
`LineSpec` supports (`src/compositions/LineVideo.tsx`), with what's optional
and its default:

```jsonc
{
  "id": "unrate-reveal",                 // required. Also the default chrome title-fallback and dated-output filename stem.
  "series": [{ "ref": "unrate" }],       // required, 1+ entries. 1 = waypoints + single line. 2+ = static per-line labels, no waypoints.
  "chrome": {                            // optional. Omit title/subtitle entirely to pull from the registry (single-series only).
    "title": "Unemployment rate",
    "subtitle": "Unemployed share of the labor force"
  },
  "palette": "petrol",                   // optional, "petrol" (default) or "paper"
  "window": ["2022-01-01", "latest"],    // required [start, end]. Absolute dates or "latest" only -- no relative tokens here (see Section 5).
                                          // This is the FULL context waypoints/annotations resolve against, not what's on screen at any moment.
                                          // Also the first shot's window when that shot omits its own.
  "waypoints": ["min", "2024-07-01", "max", "latest"],  // optional. See Section 7.
  "waypointAnchor": "point",             // optional, "max" (default) or "point"
  "waypointBelowDot": "latest",          // optional -- see Section 7
  "waypointHideDate": ["min", "max"],    // optional -- see Section 7. Listed tokens drop the date line, value only.
  "waypointBesideDot": ["-1m", "latest"],// optional -- see Section 7. Listed tokens anchor beside their own dot, not above it.
  "theme": "butter_on_espresso",         // optional, "konczal_webpage" (default) -- see Section 13
  "displayDecimals": 1,                  // optional -- overrides the registry's storage decimals for on-screen labels
  "waypointFade": { "token": "2023-05-01", "duringShot": "zoom" },  // optional. duringShot defaults to "zoom".
  "annotations": [ /* see Section 6 */ ],
  "shots": [                             // required, 1+. See Section 5.
    { "kind": "draw", "seconds": 3.0 },
    { "kind": "hold", "seconds": 6 }
  ]
}
```

Validate before rendering (`make.sh` does this automatically):

```bash
node scripts/validate-spec.mjs specs/unrate-reveal.json
```

## 5. Shot grammar (`src/engine/shots.ts`)

A shot is `{ kind, seconds, ...kind-specific fields }`. Total duration is
the sum of every shot's `seconds` — `calculateMetadata` reads this, so no
duration constant is ever written by hand.

| kind | required fields | what it does |
| --- | --- | --- |
| `draw` | — | Animates the line in across the shot's window, linearly (not eased). Window defaults to spec.window on the first shot, or the previous shot's window otherwise. |
| `hold` | — | Freezes the tip at the window's end. Domains stay whatever the previous shot left, unless this shot declares its own `window` (an instant cut, no animation). |
| `zoom` | `window` | Eases from wherever the view currently is to the declared window — both axes, plus waypoint callout scale. |
| `pan` | `window` | Identical mechanism to `zoom` (interpolate to a declared window) — the separate name is for a spec author's intent, not different math. Use it when the target window is the same width (a slide, not a zoom). |
| `fade` | — | Interpolates an `opacity` value from `1 - to` to `to` (`to` defaults to `1`, i.e. fade in). No consumer wires this to anything yet — see Section 6's `from`/`until`, which is the thing that actually fades annotations today. |

**Window syntax** (a shot's own `window`, and `hline`/`band` annotation
windows): `[start, end]` where each bound is a literal `"YYYY-MM-DD"` date,
the keyword `"latest"` (the last row with data), or a relative offset like
`"-48m"` / `"+6m"` — N months before/after **the other bound in the same
pair**. At most one bound may be relative. `["-48m", "latest"]` means "the
last 48 months," and re-rendering next month after a fresh fetch moves the
whole window forward automatically — unlike an absolute start date, which
stays pinned and the visible span just grows.

Only monthly-frequency series make the relative-offset math this simple (an
"N months" offset is just an array-index offset). If a series at a
different frequency is ever added, this needs revisiting.

**The first shot must declare a window** (inherited from `spec.window` if
it's a `draw`/`hold` that doesn't declare its own) — there's no previous
shot to fall back to. A `fade` cannot be the first shot, for the same
reason.

**Naming a shot** for `from`/`until`/`duringShot` references (Section 6):
defaults to the shot's own `kind`, auto-suffixed only when a kind repeats
(`prime-epop-zoomout.json`'s two `hold` shots become `hold` and `hold-2`).
Give a shot an explicit `"name"` field when you need to refer to one of
several same-kind shots unambiguously.

**Zoom-out example** (`prime-epop-zoomout.json`, the real one in this repo):

```jsonc
"shots": [
  { "kind": "draw", "seconds": 3.5, "window": ["2019-01-01", "latest"] },
  { "kind": "hold", "seconds": 6.0 },
  { "kind": "zoom", "seconds": 3.0, "window": ["1995-01-01", "latest"] },
  { "kind": "hold", "seconds": 10.0 }
]
```

A second zoom (in, or to a third window) is a fifth line, not a rewrite.

## 6. Annotation grammar (`src/engine/annotations.ts`)

"Text on the thing." An `annotations` array entry is either the literal
string `"recessions"` or an object:

| kind | required | notes |
| --- | --- | --- |
| `hline` | `value`, `label`, `labelAt` | Dashed horizontal reference line. `value` is a **value expression** (below). `window` (optional, defaults to `spec.window`) is where the line is drawn — independent of the range used to compute its value, so a "2024-2026 average" line can still span the whole chart. Grows in from whichever edge is currently visible; the label only appears once revealed far enough to reach `labelAt`. |
| `vline` | `at`, `label` | Dashed vertical line at a resolved date/token, spanning the plot. |
| `band` | `window` | Shaded x-range (recessions, COVID, a policy window). Gets a 4px minimum render width so a 1-2 month event doesn't disappear once a chart is zoomed out to decades. |
| `point` | `at`, `label` | A dot + short leader line + label at a date. `value` (a value expression) is optional — defaults to the series' own value at `at`. |
| `free` | `x`, `y` (0-1 fractions of `TEXTSAFE`), `label` | Text at a fixed fractional position, not tied to any date — a punchline overlay. |

**Value expressions** (`hline.value`, `point.value`): a plain number, or
`"value:TOKEN"` (the series' value at a resolved date/token), or
`"mean:TOKEN..TOKEN"` (the average over a resolved range) — e.g.
`"mean:2024-01-01..latest"`.

**`from`/`until`** (every kind): shot names (Section 5) gating visibility.
Fades in across `from` (eased, 0 at its first frame to 1 once it
completes), full opacity until `until` starts, fades out across `until`.
Either is optional — omit `from` for something visible from frame 0, omit
`until` for something that stays once shown.

**`"recessions"`**: expands to one unlabeled `band` per contiguous NBER
recession month-run in the `recessions` registry series (FRED's `USREC`),
scoped to `spec.window`. No `from`/`until` (always visible) and no
per-recession label — add an explicit labeled `band` alongside it if you
want to call out one specific recession (e.g. `"COVID"`).

Example, the real `prime-epop-zoomout.json` average line:

```jsonc
{
  "kind": "hline",
  "value": "mean:2024-01-01..latest",
  "label": "2024–2026 average",
  "labelAt": "2008-09-01",
  "from": "zoom"
}
```

## 7. Waypoint resolvers (`src/engine/waypoints.ts`)

`waypoints` (single-series specs only) is a list of tokens, each `"min"`,
`"max"`, `"latest"`, a relative offset like `"-1m"`/`"-2m"`, or a literal
`"YYYY-MM-DD"` date.

**Relative tokens** (`"-Nm"`/`"+Nm"`, N months from `"latest"`) are for "the
last N months" as their own self-correcting waypoints, without hardcoding
dates that go stale — e.g. `["min", "max", "-2m", "-1m", "latest"]` labels
the historical extremes plus the last three prints, and rolls forward on
its own as new months arrive. Same `"-Nm"`/`"+Nm"` syntax a shot's own
window already used (Section 5) — not a second grammar, just extended to
waypoint tokens too (`resolveIndex` in `engine/waypoints.ts`). A tight
cluster of these (several months close together, especially near a
peak/trough waypoint) leans on the row-stagger logic described below —
it's designed for exactly this, but is still tuned by eye per spec; render
and look (Section 11) before trusting a new cluster of waypoints.

**`min`/`max`/`latest` resolve against `spec.window`** — the full context
the video ever shows, not whatever's currently on screen mid-zoom. This
means "max" always means "the highest value across the whole video's
range," computed fresh every render — this is the fix for a real bug: an
earlier version hardcoded a literal "cycle high" date, which silently went
stale the month a new high printed. Verified when this was built that
`min`/`max` over `unrate`'s 2022-present window landed on the exact same
dates the old hardcode did, so nothing changed for that video except that
it now self-corrects.

**Use a literal date instead of a resolver** for an editorial pick that
isn't "the extreme of the series" — a specific comparison point like "two
years ago," or a historically notable date that isn't necessarily a min/max
in the current window (`prime-epop-zoomout.json`'s `"1999-01-01"`).
Literal dates never go stale on their own; they're a deliberate choice, not
a moving target, so re-review them by eye if the underlying data changes
enough that the point no longer makes the intended comparison.

**`waypointAnchor`**: `"max"` (default) clusters every callout at the same
height near the series max — fine when the waypoints themselves cluster
near that max. `"point"` anchors each callout above its own point instead,
for waypoints that span a wide range (a cycle low next to a cycle high),
where `"max"` would strand a low point's label far above its dot.

**`waypointBelowDot`**: names one waypoint (by token) to render its label
below the dot instead of above — for the one-off case where an above-dot
label would extend back through the line itself (e.g. a "latest" point
sitting just right of, and below, a recent peak). Superseded for a given
waypoint by putting it in `waypointBesideDot` instead (below), which covers
the same "would run through the line" problem more generally.

**`waypointHideDate`**: tokens (by name, matching entries in `waypoints`)
whose label drops the date line entirely — value only, one line. Anything
not listed keeps its date, unchanged from the default two-line callout.
Useful when several waypoints are labeled close together and the date is
redundant with the x-axis (which, since Section 8's graduated ticks, often
already shows the month for anything zoomed in enough to have this problem).

**`waypointBesideDot`**: tokens whose label anchors at the point's own
height (beside its dot) instead of the usual headroom-based position above
it — reads as a small trailing readout next to the line rather than a
callout floating above it, e.g. for "the last three months" sitting close
together near a line's current end. Combines with `waypointHideDate`:
listed in both → value and date on one line, date to whichever side the
label's normal edge-avoidance anchor extends (`Waypoint.dateStyle:
"inline"`); besideDot alone → value only, still beside the dot (`"none"`);
neither → the original above-the-dot position, two-line stacked date+value
(`"stacked"`, unchanged default). Not itself a fix for a label running
through the line the way `waypointBelowDot` is — it repositions relative to
the dot, it doesn't check what the line is doing nearby.

**Collision handling among several waypoint labels** (`LineBody.tsx`) is a
greedy first-fit: each label takes the lowest of up to 4 stacked rows
(70px apart) that doesn't overlap an already-placed label, checked against
every previously-placed one — not just its immediate neighbor, which only
ever separates one colliding pair at a time and leaves a third or fourth
label in the same crowded stretch overlapping again. A label pushed off
its natural spot (row > 0) gets a thin leader line down to its own dot, so
it still reads as "this label belongs to that point" instead of floating.
This only engages when labels are close enough to actually collide —
sparse waypoints (the common case) render exactly as before.

## 8. The visual system (`src/theme.ts`)

- **Palettes**: `PETROL` (dark, default) and `PAPER` (light). Every color
  traces to a `mikekonczal.com` token or a documented derivation — e.g. the
  series blue is lightened 45% in HLS from the site's chart blue, because
  the raw color is only 2.55:1 against the petrol background (under WCAG's
  3:1 floor for graphical objects) and sits in the chroma channels H.264
  4:2:0 subsamples to half resolution; the lightened version holds the hue
  within 0.2° and gets 6.10:1.
- **Safe zones**: TikTok publishes no official pixel safe zone. `SAFE` and
  `TEXTSAFE` are a conservative consensus across third-party measurements —
  the tab bar owns the top 160px, the caption/ticker/scrubber/nav bar own
  the bottom 480px, the action rail owns the right 140px. Nothing
  load-bearing goes outside `TEXTSAFE`.
- **40px type floor**: the smallest text anywhere (`TYPE`) is sized so it
  survives a ~2.75x downscale to a phone screen and still clears the ONS's
  14px web minimum and broadcast subtitle norms once scaled back up.
- **No glow filter.** A knockout stroke — the path drawn first wider in the
  background color, then narrower in the series color — keeps a line clean
  where it crosses gridlines or another line, without a trading-terminal
  neon look.
- **The x-axis sits above the plot**, bound to it by a rule and tick marks.
  Same plot height either way; the point is that year labels never end up
  sharing a neighborhood with a caption block that expands upward when
  tapped. This is a time-axis-only convention — a bar chart or distribution
  keeps its x-axis at the bottom, where a top axis would read as a bug.
  "Time-axis" means whatever the x categories actually are: `BarVideo`'s
  grouped bars are months, so it uses the same above-the-plot convention as
  `LineBody` for the identical reason (nothing pushes those labels toward a
  caption block); a bar chart whose x isn't time (states, industries, a
  histogram's bins) is the case this bullet's "at the bottom" exception is
  for.
- **`LineBody`'s x-axis tick density is graduated by how much time is on
  screen** (`engine/scales.ts`'s `xAxisTicks`), not fixed at "one tick per
  January": under ~2.5 years visible, ticks are per-calendar-month instead
  (spaced out — every month, every 2nd/3rd/6th — to stay at roughly 8 or
  fewer). Above that, a wider step (in whole years) applies instead, same
  mechanism — a multi-decade zoomed-out shot (`prime-epop-zoomout.json`)
  still reads a handful of ticks, not a wall of them.
- **Ticks are built backward from the rightmost visible date, not forward
  from the leftmost** — mirrors `tidyusmacro::date_breaks_n()`/
  `date_breaks_gg()` (this project's companion R package): step back from
  `iHi` by a fixed cadence until passing `iLo`, so the actual endpoint is
  always a tick and every tick is evenly spaced from it, with whatever
  partial interval is left over landing at the old (least important) end
  instead of the new one. An earlier forward-from-`iLo` version had to
  special-case forcing the true endpoint in as an extra tick and dropping
  whichever regular tick sat closest to it, which left an uneven — sometimes
  visibly doubled — gap right next to the most important tick (found by
  rendering `jobs-day-unrate`: a forward grid landed on Sep/Mar, so forcing
  in a July endpoint dropped the nearby Mar tick and stranded Sep on its
  own). Anchoring from `iHi` needs no such case.
- **Every tick shows month + year, stacked two lines** (`"Jan"` / `"’25"`),
  **except the wide (multi-year) tier when the endpoint's month is
  January**, where the month is dropped (every tick shares that same
  anchor month by construction, so it would just repeat "Jan" 5-8 times).
  A wide-tier view anchored on any other month — most of them, in practice
  — shows that month on every tick (`prime-epop-zoomout.json`'s fully
  zoomed-out shot currently reads `Jul '96 Jul '01 Jul '06 ... Jul '26`,
  not bare years), which is a real, deliberate departure from this
  project's original all-January convention, not an oversight.

## 9. Commands

```bash
# Fetch or refresh series data (skips anything fetched in the last 7 days)
Rscript data/fetch.R                      # every series in data/series.json
Rscript data/fetch.R unrate recessions    # just these
Rscript data/fetch.R --refresh unrate     # force, ignoring the 7-day cache

# Preview interactively
npm start                                 # remotion studio

# Validate a spec without rendering
node scripts/validate-spec.mjs specs/unrate-reveal.json

# Render
./make.sh specs/unrate-reveal.json                              # one LineVideo spec -> out/YYYY-MM-DD-<id>.mp4
./make.sh specs/jobs-day/unemployment-rate.json                  # a spec in a specs/<release>/ subfolder -> out/<release>/YYYY-MM-DD-<id>.mp4
./make.sh specs/some-sequence.json                               # a "type": "sequence" spec -> one stitched mp4
./make.sh src/data/cards_full_employment_reasons.json out/prefix # every rip-card / list-reveal step in a cards file

# One frame, for a QA checkpoint still
ffmpeg -y -v error -i out/2026-08-25-unrate-reveal.mp4 \
  -vf "select=eq(n\,150)" -vsync 0 -frames:v 1 /tmp/checkpoint.png
```

**Sequence specs** (`"type": "sequence"`) stitch several clips — mixing
compositions — into one video via `ffmpeg`'s concat demuxer:

```jsonc
{
  "type": "sequence",
  "id": "full-employment-story",
  "steps": [
    { "composition": "ListReveal", "props": { "title": "...", "items": [...], "activeIndex": 0 } },
    { "composition": "LineVideo", "spec": "unrate-reveal.json" }
  ]
}
```

Each step is either `"props"` (inline, for `RipCardReveal`/`ListReveal`,
which have no spec-file convention of their own) or `"spec"` (a path,
relative to the sequence file's own directory, to a `LineVideo` spec file)
— never both.

**A frame-seek gotcha, worth knowing before trusting a checkpoint still
pulled from a stitched sequence**: `ffmpeg`'s concat demuxer with `-c copy`
(stream copy, no re-encode) can produce a file where `select=eq(n,N)`
extracts the *wrong* segment's content right around a stitch boundary —
this bit the sequence feature during Phase 5 development and looked exactly
like a rendering bug until a clean re-encode (`ffmpeg -i stitched.mp4 -c:v
libx264 clean.mp4`) proved the stitched file's actual frame data was
correct and the extraction was the unreliable part. If a checkpoint still
from a sequence looks wrong, re-encode before concluding the render itself
is broken.

## 10. QA checklist before publishing

- [ ] Vintage checked: `make.sh`'s freshness check printed a fetch date
      that's actually recent, or you know why it isn't (already refreshed
      today's release, deliberately rendering a frozen historical spec).
- [ ] Units and SA/NSA confirmed against `data/series.json`'s
      `title`/`subtitle`/`note` for every series in the spec.
- [ ] Latest value matches the source you'd cite (spot-check against
      FRED/BLS directly, not just against what the chart draws).
- [ ] Nothing renders outside `TEXTSAFE` — check the actual checkpoint
      stills, not just that the render didn't error.
- [ ] Checkpoint frames eyeballed: mid-draw, post-hold, mid-zoom (if any),
      and the final frame. See Section 9's `ffmpeg` one-liner.
- [ ] Waypoint labels not stale: `min`/`max`/`latest` self-correct, but any
      literal editorial date (Section 7) needs a human glance — a specific
      date chosen for a reason can stop making sense as more data arrives,
      and nothing in the code will notice that for you.

## 11. Rules for me

- **Never invent or interpolate a data value.** If a number isn't in the
  fetched series, it doesn't go on screen. A gap in the data is a gap on
  screen (`buildRuns` already renders `null` as a break in the line), not a
  smoothed-over guess.
- **Never change a transform — a registry `expr`, a `decimals` value, which
  source series feeds a derived one — without saying so explicitly.** These
  are empirical choices, not implementation details; PLAN.md's Section 1
  gap (five pasted-in files with no record of their own provenance) is
  exactly what happens when this rule isn't followed.
- **Render and look at actual frames before calling a video, or a change to
  the engine, done.** Every phase of this project's build found at least
  one real bug that only showed up in a rendered frame, never in a type
  check or an exit code: a `--props` merge silently leaking a stale field
  across renders (Phase 2), an index-space bug invisible until the exact
  frame where it mattered (Phase 2/3), a recession band computed correctly
  but geometrically eclipsed by the chart's own line stroke (Phase 4), and
  a sequence-stitching props bug that looked like a rendering issue until a
  clean re-encode isolated it (Phase 5). None of these would have been
  caught by "it rendered without error."
- **When verifying a change against "existing behavior," verify against a
  fresh render of the actual prior source** (a `git worktree` at the last
  commit works well), not against whatever happens to be sitting in `out/`
  — `out/` is gitignored and can go stale relative to `src/` without
  anyone noticing, which happened once already during this project's build.
- **When a request needs a genuinely new chart type** (bar, scatter,
  histogram, table) **, say so rather than bending the line spec to fake
  it.** The bespoke-`.tsx`-escape-hatch is real and fine to reach for; a
  spec grammar that can become anything stops being a spec grammar.
- **A published spec is frozen** (Section 2) — don't edit
  `specs/*.json` for a video that's already been posted. Write a new one.

## 12. Bar charts (`BarVideo`)

The bespoke-`.tsx`-escape-hatch Section 11 mentions, exercised for real: a
grouped bar chart (e.g. a month's 1st/2nd/3rd BLS payroll estimate side by
side) is not a line, and `LineBody` doesn't bend into drawing one. `BarVideo`
(`src/compositions/BarVideo.tsx`) + `BarBody` (`src/bodies/BarBody.tsx`) are
a second, much smaller composition living alongside `LineVideo`/`LineBody`
— same `ChartChrome`, same `theme.ts` geometry (`PLOT`/`ROW`/`TEXTSAFE`), but
a categorical x-axis (one tick per period) instead of a continuous date
scale, so it does not reuse `engine/scales.ts`'s `px()`/`pathD()` — those are
line-specific.

A bar spec:

```jsonc
{
  "id": "jobs-day-payrolls",
  "type": "bar",                          // required -- this is what make.sh/Root.tsx/the validator switch on
  "chrome": { "title": "...", "subtitle": "..." },  // optional, falls back to the first series' registry meta
  "palette": "paper",                      // optional, same "petrol"/"paper" choice as LineSpec
  "series": [                              // required, 2-3 entries -- one bar per entry, per period
    { "ref": "payrolls_change_1st", "label": "1st estimate" },
    { "ref": "payrolls_change_2nd", "label": "2nd estimate" },
    { "ref": "payrolls_change_3rd", "label": "3rd estimate" }
  ],
  "window": ["2026-03-01", "latest"],      // required [start, end], literal dates or "latest" -- NO relative tokens
  "revealSeconds": 4.0,                    // required -- total time to sweep every group in, left to right
  "holdSeconds": 5.5                       // required -- hold time after the sweep finishes
}
```

**Deliberately a much smaller grammar than `LineSpec`** — one reveal (group
by group, left to right, each group's own bars growing from the zero line),
then a hold. No shots array, no waypoints, no annotations. Add surface here
only when a real bar-chart video needs it, not preemptively to mirror
`LineSpec`.

**No relative window tokens.** A `BarSpec`'s `window` *is* what's on screen
— there's no separate zoomed/panned view the way a line spec's shots can
diverge from `spec.window`, so `"−Nm"` tokens aren't supported; both bounds
must be a literal `"YYYY-MM-DD"` or `"latest"`.

**A `null` value for one series in one period just omits that bar** — the
same "gap in the data is a gap on screen" rule Section 11 states for lines,
applied to bars: a month whose 2nd estimate hasn't been published yet draws
a 1st-estimate bar and nothing else in that slot, not a zero-height bar
(which would be indistinguishable from an actual zero).

**Bar-count vs. window width is a real tradeoff, tuned by eye, not by
formula.** `BarBody` fits `n` month-groups (from `window`) into the fixed
`PLOT.left`–`PLOT.right` span; each group's cluster then splits three ways
for the bars, and value labels sit directly above/below each bar. 5 months of groups is the confirmed max on a 1080px-wide frame with
3 bars/group and 3-digit values — 6 and 7 were both tried (down to a
smaller font than the 5-month version uses) and still left two labels
touching within a group. Found by rendering and looking at an actual frame
(Section 11's hard rule), not by calculation.
`monthGroupsFromSeries`'s caller (a spec's `window`) is what controls this,
so keeping a bar spec's window short is the fix, not a code change.

**A third categorical color.** `theme.ts`'s `Palette` type gained
`seriesAlt` for this — `series/accent` are only two colors, and a grouped
bar with 3 series needs a third. mikekonczal.com's stylesheet has no third
token to lift (checked directly), so `seriesAlt` is a documented derivation
using the same method as `series`/`accent`: a fixed hue distinct from both
existing colors, HLS-lightened/darkened per palette, searched for a
contrast ratio matching that palette's other two colors on their own
background. See the comment above `PETROL`/`PAPER` in `theme.ts` for the
exact numbers.

**Wiring, if you add a third composition later**: a `"type"` field is what
`make.sh`'s `render_spec` and `scripts/validate-spec.mjs`'s `main()` switch
on (`"sequence"` / `"bar"` / anything else falls through to the `LineSpec`
validator) — a spec with no `"type"` at all is still assumed to be a
`LineSpec`, unchanged from before `BarVideo` existed. The composition itself
still needs registering in `src/Root.tsx` the normal Remotion way.

## 13. Themes (`src/themes/`)

A **theme** is a swappable visual design for `LineVideo`/`LineBody`: palette,
type scale (font family/size/weight per role), and one mark-style flag.
Deliberately NOT layout/geometry — `ROW`/`PLOT`/`STROKE`/`MARK` in
`theme.ts` stay shared across every theme, since those were tuned through
many rendered-and-checked iterations specific to this engine's proportions
(waypoint collision-avoidance, safe zones, the axis-above-plot rhythm), not
a per-design choice. See `src/themes/types.ts`'s `Theme` type comment for
the same reasoning in more detail.

**One file per theme in `src/themes/`, listed in `src/themes/index.ts`'s
`THEMES` registry.** `konczal_webpage.ts` is the original design this whole
chart family launched with (Newsreader + Inter, the mikekonczal.com-derived
petrol/paper palettes) — it's the default when a spec's top-level `"theme"`
field is omitted, so every spec written before themes existed still renders
exactly as it did before. Adding a theme means adding a file shaped like
that one plus one line in the registry; nothing else needs to change to
pick it up. `scripts/validate-spec.mjs`'s `THEME_IDS` mirrors the registry
and needs the same one-line addition.

**A theme's `palettes` still has both a `petrol` and a `paper` key**,
matching a spec's own existing `"palette": "petrol" | "paper"` field (this
predates themes and is orthogonal to which theme is active) — a theme with
only one real design, like `butter_on_espresso`, just points both keys at
the same colors, so an existing spec's `palette` field never silently
breaks against a new theme.

**Fonts are still self-hosted woff2** (`src/fonts.ts`, `public/fonts/`),
matching this repo's existing convention (reproducible offline, no
mid-render network fetch) — a new theme's fonts need adding to `FACES` in
`fonts.ts` the same way. `butter_on_espresso`'s Archivo ships from Google as
a single variable-font file; four `FACES` entries (weights 400/600/700/800)
all point at that one file, exactly like Google's own served CSS does —
Chrome (which Remotion renders through) matches `font-weight` against the
variable font's weight axis correctly, so this isn't four separate files.

**How `LineBody`/`ChartChrome` actually become theme-aware**: both keep
their original fixed imports (`TYPE` from `theme.ts`, aliased to
`DEFAULT_TYPE`) as the default for any prop-less caller, but each also
takes an optional `type` prop; the first line of the component body does
`const TYPE = type;`, shadowing the module-level import for the rest of the
function. Every existing `TYPE.xxx` reference in either file therefore
follows whichever theme was resolved without individually touching each
call site — `LineVideo.tsx` is the only place that calls `resolveTheme` and
threads the result through. `BarVideo`/`BarBody`/`RipCardReveal`/`ListReveal`
aren't theme-aware yet and still read `theme.ts`'s fixed exports directly;
extending them later means giving them the same optional-prop-plus-shadow
treatment, not a different mechanism.

**Waypoint collision-avoidance paddings scale with the active theme's type
size.** `LineBody`'s `VERT_PAD`/`ROW_STAGGER`/`BESIDE_LIFT`/`INLINE_GAP`/
`DOT_PAD`/`EDGE_PAD` were originally tuned as fixed pixel constants against
`konczal_webpage`'s 46px value text; they're now each that original pixel
count times `PAD_SCALE = TYPE.value.size / 46`, so a theme with meaningfully
bigger or smaller type gets correctly-scaled spacing instead of the same
absolute pixels tuned for a different font size (`PAD_SCALE` is 1 for
`konczal_webpage`, so this is a no-op there — checked by rendering, byte-
identical output). Deliberately keyed to the theme's own (un-zoomed)
`TYPE.value.size`, not the zoom-divided `valueFontPx` — this should vary by
theme, not by how zoomed-out the current shot happens to be.

**`butter_on_espresso`'s value size is 52px, not the source brief's 60/66px
split** (this engine has one value-label size for every waypoint, no per-
waypoint size hook, so it can't reproduce that split anyway) — at 66px, a
`waypointBesideDot` label got wide enough to run under a *neighboring*
waypoint's own dot on `jobs-day-unrate` (5 waypoints in a ~22-month window),
a collision the row-stagger system doesn't model (a dot never enters the
stagger competition, since it never moves). 52px rendered clean on that
same dense spec — checked by rendering, not assumed. If a future theme
wants materially bigger value text than that, expect to hit the same
ceiling on any spec with several close-together `waypointBesideDot` labels,
and either shrink the type or teach the collision system about neighboring
dots (tried once here, reverted — it over-corrected and pushed a label into
the axis row instead; a real fix needs more care than a quick pass gives).

**`marks.latestSolid`**: `false` (default, `konczal_webpage`) keeps every
waypoint dot's existing construction — a solid ring with a bg-colored hole
in the middle, accent-colored instead of series-colored for "latest" (the
color switch alone already carries the "this one's different" signal).
`true` (`butter_on_espresso`) renders "latest" as a solid accent-filled
disc with a thin bg-colored border instead, via a single `<circle>` with
`fill`+`stroke` rather than the two-nested-circles technique every other
dot still uses — a deliberate different construction for a design that
wants the endpoint to read as a punched-in dot, not another ring in the
same family as the peak's.
