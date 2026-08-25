# Plan: turn this folder into a general economic-video factory

**Goal.** You say "line graph of the quits rate, 2019 to now, zoom out at the
end." I pull the data, write one small spec file, render, and hand you an mp4.
No new component, no edit to `Root.tsx`, no hand-picked peak dates. Two or
three of these a week for a year, with the look evolving over time without
breaking old specs.

**Terminal artifact.** `CLAUDE.md` in this folder. It is the contract that makes
every future session start from the same place. It gets written incrementally,
one section per phase, not all at the end.

**Status.** Phase 0 and Phase 1 are done. Repo lives at
`~/Documents/GitHub/cool_tiktok_graphics`, pushed to
`github.com/mtkonczal/cool_tiktok_graphics` (public, per an explicit choice —
see Section 6). `data/series.json` and `data/fetch.R` exist; all five
series behind the existing videos were regenerated from FRED and matched the
committed legacy JSON exactly, decimal for decimal, so none of the provenance
guesses in Section 7's table turned out to be wrong. The legacy
`src/data/data_*.json` files are untouched and still what the six current
compositions import — rewiring them onto the registry is Phase 2's job, not
done yet. Section 7 has every environment fact verified before the move, so a
fresh session can start without re-checking any of it.

---

## 0. Moving to GitHub: do this first, in this order

The folder is 592 MB, of which 583 MB is `node_modules`. Getting that into git
history even once makes the repo permanently huge and needs `git-filter-repo` or
BFG to undo. So the `.gitignore` goes in **before** the first `git add`.

### The rule that matters most

> **Never run `git add .` in this folder until `.gitignore` exists and
> `git status --short` shows fewer than 40 files.**

If `git status` after `git add` lists thousands of paths, you staged
`node_modules`. Stop, run `git reset`, fix `.gitignore`, start over. Before the
first commit this is free to fix. After a push it is not.

### Step 1. Prepare in place (before moving anything)

```bash
cd /Users/mtkonczal/Documents/remotion-tiktok
rm -rf _pre-petrol-backup            # git replaces it
find . -name .DS_Store -not -path "./node_modules/*" -delete
```

Write `.gitignore`:

```gitignore
# ── never ────────────────────────────────────────────────────────────────
node_modules/
.DS_Store
.Rhistory
.Rapp.history
.Renviron
*.log

# ── out/: renders, not committed ─────────────────────────────────────────
# Rule of thumb (same as the other repos): if a script can rebuild it, it is
# not committed. A spec + its committed data JSON + this code reproduce any
# mp4 exactly, so the mp4 itself is derived output. mp4 is also an already-
# compressed binary that git cannot delta: every re-render of the same video
# stores a full new blob. At 2-3 videos/week for a year that is several
# hundred MB of undeltifiable history for files we can regenerate in seconds.
out/

# ── src/data/*.json: the exception, DO commit ────────────────────────────
# These look derived but are not reproducible. FRED revises: re-running
# fetch.R six months from now returns different numbers than the vintage a
# published video actually showed. The JSON plus its .meta.json sidecar is
# the vintage record for what went on screen. They are a few KB each.
!src/data/
```

Write `.gitattributes` (matches the convention in `BLS-JOLTS-Analysis`, plus
explicit binary marks so LF normalization can never touch a font or a video):

```gitattributes
* text=auto
*.woff2 binary
*.mp4 binary
```

Fix `package.json`: the `name` field still says `prime-epop-remotion`, which is
no longer what this is. See Step 5 on pinning versions.

### Step 2. Initialize and verify before committing

```bash
git init -b main
git add .
git status --short | wc -l      # expect roughly 25-35, NOT thousands
git status --short | head -40   # eyeball it: no node_modules, no out/
```

Only when that list looks right:

```bash
git commit -m "Initial commit: working TikTok chart renderer as built"
```

Commit the **current working state first**, before any refactor. That first
commit is the thing you can always get back to when a visual experiment goes
sideways.

### Step 3. Move

`Documents` and `Documents/GitHub` are on the same volume, so a move is an
instant rename no matter how large `node_modules` is. Finder drag works too, for
the same reason. Do not *copy*: a 583 MB copy is slow and pointless.

```bash
mv /Users/mtkonczal/Documents/remotion-tiktok \
   /Users/mtkonczal/Documents/GitHub/remotion-tiktok
```

Pick the final repo name now, since renaming later means renaming the GitHub
remote too. Suggestion: `econ-video-factory` or `tiktok-econ-charts`. It is no
longer prime-EPOP-specific.

### Step 4. Verify node still works after the move

npm's `.bin` symlinks are relative, so a same-volume move survives. Confirm
rather than assume:

```bash
cd /Users/mtkonczal/Documents/GitHub/remotion-tiktok
npx remotion versions        # expect 4.0.515
npx remotion studio          # expect the six compositions to load
```

If anything is odd, the fix is cheap and total:

```bash
rm -rf node_modules && npm install
```

### Step 5. Pin the toolchain

Real reproducibility problem today: `package.json` asks for `remotion ^4.0.290`
but `4.0.515` is installed. The caret means a fresh `npm install` on a new
machine, or any `npm update`, pulls a different Remotion that can render
differently. `package-lock.json` is the only thing currently holding this
steady, and it is one careless command from moving.

Drop the carets so the manifest states the truth:

```jsonc
"dependencies": {
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "remotion": "4.0.515",
  "@remotion/cli": "4.0.515"
}
```

Add `.nvmrc` containing `25` (the Node in use is v25.4.0), and always use
`npm ci` rather than `npm install` on a fresh clone, so the lockfile wins.
Upgrading Remotion then becomes a deliberate, single, reviewable commit, and if
a render changes you know exactly why.

### Step 6. Create the remote

```bash
gh repo create remotion-tiktok --private --source=. --remote=origin --push
```

`gh` is already authenticated as `mtkonczal`. **Recommend private to start.**
Nothing here is sensitive, but the visual system is your on-air identity and
half-finished specs would be public. Flipping to public later is one command.

Pre-push secret check (should return nothing; `getFRED` needs no key and
`.Renviron` lives in your home directory, not here):

```bash
git grep -inE "api[_-]?key|bearer |secret|token" -- . ':!package-lock.json'
```

### Step 7. Turn on strict TypeScript

`tsconfig.json` currently has `"strict": false`. The whole plan below moves this
project to prop-driven compositions, and under non-strict TS a composition
missing a required prop does not error, it renders a blank or half-drawn frame
that you might not catch until after posting. Set `"strict": true` and fix the
fallout in its own commit, before Phase 1.

### Things that will bite later, worth knowing now

- **Case-only renames.** macOS is case-insensitive, GitHub and Linux CI are not.
  Phases 2 and 3 move files into `engine/` and `bodies/`. Use `git mv` for every
  move so history follows the file, and for a case-only rename do it in two
  commits (`git mv foo.ts tmp && git mv tmp Foo.ts`) or git will not notice.
- **`CLAUDE.md` must be committed.** Your global `~/.claude/CLAUDE.md` still
  applies everywhere; the project one adds to it. The `.claude/` directory
  itself (settings, local state) should be gitignored, matching
  `ai-tech-markets-research`.
- **Remotion licensing is settled.** Remotion is source-available, not MIT. The
  free tier explicitly covers individuals, organizations up to 3 employees, and
  **non-profits**. Economic Security Project is a non-profit, so free-tier use is
  permitted including commercially. Worth one line in `CLAUDE.md` so it is never
  re-litigated. A company license would only come up if this moved under a
  for-profit entity.
- **Fonts.** `public/fonts/` holds four woff2 files (Inter, Newsreader), both
  under the SIL Open Font License, which permits redistribution. If the repo
  goes public, drop the OFL text in `public/fonts/OFL.txt` to be clean about it.
- **`out/` is ignored, so back up published videos elsewhere.** The mp4 you
  actually posted is regenerable from the committed spec and data, but only if
  you do not later edit that spec. Once a video is published, treat its spec
  file as frozen and start a new one rather than editing in place.

---

## 1. What we actually have

Six videos in `out/`, produced by four bespoke compositions plus two card
shapes. The shared parts are already good and stay:

| Keep as-is | Why |
| --- | --- |
| `theme.ts` | Every color traced to a site token with contrast ratios. Genuinely reusable. The safe-zone and 40px type-floor derivations are the hard-won part. |
| `fonts.ts` | Correct (`font-display:block`, `delayRender`, offline). Untouched. |
| `chartEngine.ts` scales/runs/paths | `px`/`py`/`buildRuns`/`pathD`/`chooseYStep` are already generic. |
| Knockout-stroke technique, no-glow rule | Visual identity. Encoded in `CLAUDE.md`. |
| The rip-card and list-card shapes | Good primitives. They need a geometry fix, not a rewrite. |

### What blocks reuse

1. **No data layer at all.** The five `src/data/*.json` files were produced
   somewhere outside this folder and pasted in. There is no record of which
   series ID, which vintage, or which transform. `data_unrate_2022_present.json`
   carries four decimals because it is unemployed/labor-force computed from
   components, not the published rounded `UNRATE`. That is an empirical choice
   currently documented only in a code comment inside a React component.
   This is the single biggest gap.

2. **One composition per video.** `PrimeEpopReveal`, `UnrateReveal`,
   `UnemployedOpeningsReveal`, `PrimeEpopZoomOut` are each ~40-130 lines that
   differ in: which JSON to import, title text, two duration constants,
   which dates get waypoints, and which palette. Everything else is copy-paste.
   `Root.tsx` grows by ~10 lines per video forever.

3. **The zoom is a hand-written phase machine.** `PrimeEpopZoomOut.tsx` lines
   50-100 are an if/else ladder over `frame` that manually lerps `xDomain`,
   `yDomain`, `cbMax`, `cbPad`. Any second zoom, a pan, a zoom-in, or a
   different phase order means writing that ladder again by hand.

4. **Waypoint dates are hand-picked and go stale.** `UnrateReveal` hardcodes
   `"2025-11-01"` as the cycle high. Next month that may not be the high, and
   the video will silently mislabel. At a 2-3x/week cadence this is the most
   likely way a wrong number ships.

5. **Number formatting is hardcoded per body.** `makeWaypoints` bakes in `%`.
   `TwoLineChartBody` bakes in `${yv / 1000}M` on the y-axis. A ratio, a dollar
   level, an index, or a change in percentage points each needs a new code edit.

6. **`TwoLineChartBody` is 80% a copy of `LineChartBody`.** Gridlines, x-axis,
   knockout lines, tip dot: duplicated. They have already drifted (the two-line
   version lost waypoint support and zoom support).

7. **No annotation layer.** "Text on the thing" today means either a waypoint
   callout (date + value only) or the one bespoke `avgLine` prop. No arbitrary
   labels, no recession bands, no arrows, no event markers.

8. **`ListRevealBody` geometry is fixed at three rows.** `LIST_TOP = 420`,
   `ROW_H = 300`. A four-item list runs off the bottom of `TEXTSAFE`.

---

## 2. The target architecture

Three layers, each independently useful.

```
data/
  series.json          # registry: friendly name -> source, ID, units, transform, copy
  fetch.R              # resolves names -> tidy data -> src/data/<slug>.json + .meta.json
specs/
  2026-08-24-unrate.json   # one file per video
src/
  theme.ts  fonts.ts       # unchanged
  engine/
    scales.ts  format.ts  shots.ts  waypoints.ts  annotations.ts
  bodies/
    LineBody.tsx           # 1..N series. Replaces LineChartBody + TwoLineChartBody
    CardBody.tsx  ListBody.tsx
  compositions/
    LineVideo.tsx  CardVideo.tsx  ListVideo.tsx   # three total, all prop-driven
  Root.tsx                 # three Compositions, stops growing
make.sh                    # spec in, dated mp4 out
CLAUDE.md
```

### 2a. Series registry (`data/series.json`)

Every series you will ever use, named once, with its metadata and its default
on-screen copy. This is what makes "line graph of blank" resolvable.

```jsonc
{
  "prime_epop": {
    "source": "fred", "id": "LNS12300060",
    "units": "percent", "decimals": 1,
    "title": "Prime-age employment rate",
    "subtitle": "Employed share of the population, ages 25-54"
  },
  "unrate": {
    "source": "derived",
    "inputs": { "u": "UNEMPLOY", "lf": "CLF16OV" },
    "expr": "100 * u / lf",
    "units": "percent", "decimals": 1,
    "title": "Unemployment rate",
    "subtitle": "Unemployed share of the labor force",
    "note": "Computed from components, not the pre-rounded UNRATE release, so waypoint ordering is stable at one decimal."
  },
  "vu_ratio": {
    "source": "derived",
    "inputs": { "v": "JTSJOL", "u": "UNEMPLOY" },
    "expr": "v / u",
    "units": "ratio", "decimals": 2,
    "title": "Vacancy-to-unemployment ratio"
  }
}
```

That `note` field is the fix for empirical decisions currently buried in
component comments.

### 2b. Fetch (`data/fetch.R`)

```
Rscript data/fetch.R prime_epop unrate vu_ratio
```

Uses `tidyusmacro::getFRED()`, which I verified works with no API key, pulls
multiple named series in one call, and returns `NA` at ragged series ends. For
each name it writes:

- `src/data/<name>.json` -> `[{"date":"1995-01-01","value":79.7}, ...]`,
  `NA` serialized as `null` (which `buildRuns` already handles as a gap)
- `src/data/<name>.meta.json` -> series ID, source, transform expression,
  fetch timestamp, first/last date, last value, row count

The meta sidecar is the vintage record, and the reason `src/data/` is committed
despite being nominally derived. `make.sh` prints the fetch timestamp before
every render so you never ship a video off two-week-old data without seeing it.
`--refresh` forces a pull, and anything older than 7 days warns.

Sanity checks that fail loudly, per your release-mode standard: monotonic dates,
no duplicate months, expected frequency, value in a plausible range for its
unit, and last value within 3 standard deviations of the prior 12 months.

### 2c. Video spec (`specs/*.json`)

One file per video. Everything that varies lives here.

```jsonc
{
  "id": "unrate-zoomout",
  "type": "line",
  "palette": "petrol",
  "series": [{ "ref": "unrate" }],
  "chrome": { "title": "auto", "subtitle": "auto" },
  "format": { "unit": "percent", "decimals": 1 },

  "shots": [
    { "kind": "draw", "window": ["-48m", "latest"], "seconds": 3.0 },
    { "kind": "hold", "seconds": 6 },
    { "kind": "zoom", "window": ["1995-01", "latest"], "seconds": 3 },
    { "kind": "hold", "seconds": 10 }
  ],

  "waypoints": ["min", "max", "latest"],
  "annotations": [
    { "kind": "hline", "value": "mean:2024-01..latest", "label": "2024-2026 average",
      "labelAt": "2008-06", "from": "zoom" },
    { "kind": "band", "window": ["2020-02", "2020-04"], "label": "COVID" }
  ]
}
```

Four things to note:

- **`"window": ["-48m", "latest"]`.** Relative windows. Re-render next month
  and the window moves with the data. Absolute dates still allowed where the
  point is a specific era.
- **`"waypoints": ["min","max","latest"]`.** Resolvers, not hardcoded dates.
  Computed against the *visible window*, so the cycle high is whatever the data
  says it is today. Literal dates stay allowed for editorial picks.
- **`"title": "auto"`** pulls from the registry, so copy is written once.
- **`"from": "zoom"`** ties an annotation's appearance to a named shot.

### 2d. Shot engine (`engine/shots.ts`)

The one piece of real new engineering. A single function:

```ts
resolveShot(shots, frame, fps, data) -> {
  i0, tipExact, xDomain, yDomain, calloutBase, zoomFactor,
  shotName, shotT
}
```

Shot kinds: `draw` (line animates in over a window), `hold`, `zoom` (eased
interpolation from the previous shot's window to a new one, in both axes plus
`calloutBase`), `pan`, `fade`. Total duration is the sum, which
`calculateMetadata` reads, so no duration constant is ever written by hand
again.

This makes zoom-out a two-line config change instead of a new file, and gets
you zoom-*in*, multi-stage zooms, and pans for free. It is a direct extraction
of the ladder already working in `PrimeEpopZoomOut.tsx`, so the math is proven.

### 2e. Format engine (`engine/format.ts`)

```ts
fmt(value, {unit, decimals, scale, suffix})
```
Units: `percent` (`4.1%`), `pp` (`+0.3pp`), `ratio` (`1.28`), `thousands`
(`7.4M`), `dollars` (`$1,240`), `index` (`104.2`), `count`. Used by y-axis
labels, waypoint values, and annotation labels alike. Kills the `%` in
`makeWaypoints` and the `/1000` in `TwoLineChartBody`.

### 2f. Annotation layer (`engine/annotations.ts`)

Generalizes the bespoke `avgLine` prop into an array of:

- `hline` / `vline`: reference line plus label. Value can be a literal or
  computed (`"mean:2024-01..latest"`, `"value:2019-12"`).
- `band`: shaded x-range with a label. Recessions, COVID, a policy window.
- `point`: arbitrary text pinned to a date/value, with a leader line.
- `free`: text at a fractional frame position, for a punchline card that
  overlays the chart.

Each takes `from`/`until` (shot names) and fades in and out. This is the
"text on the thing" request, done once.

---

## 3. Phases

Ordered so each phase ships something usable. **You could stop after Phase 3
and have most of the value.** Each phase is one commit series on its own
branch, merged to `main` only after its verification gate passes.

### Phase 0. Migration and foundation (~45 min)
All of Section 0: gitignore, first commit of the working state, move, remote,
pinned versions, `"strict": true`. Nothing else starts until `main` exists and
`npx remotion studio` runs from the new location.

### Phase 1. Data layer (~2 hrs)
`data/series.json` seeded with the six series behind the existing videos,
`data/fetch.R`, meta sidecars, staleness warning, sanity checks. Regenerate all
five existing JSON files from it and confirm the numbers match what is currently
committed. Any mismatch is a real finding about an undocumented transform, and
gets recorded in the registry `note`.

**Unlocks:** "line graph of blank" for anything on FRED, with a provenance trail.

### Phase 2. Generic line composition (~3 hrs)
`LineBody.tsx` taking `series: Series[]` (1..N), absorbing `TwoLineChartBody`'s
static midpoint labels as the N>1 case and keeping waypoints/zoom for the N=1
case. `engine/format.ts`. Waypoint resolvers. `LineVideo.tsx` reading a spec
prop, `calculateMetadata` deriving duration. Port all four existing chart videos
to specs and render them. Use `git mv` for every file that relocates.

**Verification gate:** render each ported video and compare against the existing
mp4 in `out/` at three checkpoint frames (mid-draw, post-hold, final). Any
intentional difference gets noted; anything unintentional gets fixed before
moving on. `Root.tsx` drops from six compositions to three.

### Phase 3. Shot engine (~2 hrs)
`engine/shots.ts`, relative window parsing, `PrimeEpopZoomOut` deleted and
reborn as a four-line `shots` array. Same checkpoint-frame verification.

**Unlocks:** zoom-outs, zoom-ins, pans, multi-stage sequences as config.

### Phase 4. Annotations and cards (~2-3 hrs)
`engine/annotations.ts` with `hline`/`band`/`point`/`free`. Recession bands as a
built-in dataset (`USREC` from FRED) so `"annotations": ["recessions"]` just
works. Fix `ListRevealBody` geometry to compute row height from item count and
fit within `TEXTSAFE` for 2-6 items. Unify the two card render scripts into
`make.sh`.

### Phase 5. Orchestration and CLAUDE.md (~2 hrs)
`make.sh <spec.json>`: check data freshness, validate spec against a schema,
render to `out/YYYY-MM-DD-<id>.mp4`, print the vintage line. A `sequence` spec
type that renders several clips and concatenates with ffmpeg, so a list-card
build-up plus its three charts becomes one video. Then write `CLAUDE.md` in full.

---

## 4. What `CLAUDE.md` will contain

1. **What this is** and the one-sentence workflow.
2. **Repo conventions**: branch model, what is and is not committed and why,
   `npm ci` not `npm install`, `git mv` for relocations, specs frozen once
   published, Remotion non-profit licensing.
3. **Adding a series**: registry fields, derived-series syntax, the rule that any
   non-obvious transform gets a `note`.
4. **Writing a spec**: full annotated example, every field, defaults.
5. **Shot grammar**: each kind, window syntax including relative windows.
6. **Annotation grammar**: each kind, anchoring, timing.
7. **Waypoint resolvers**: what `max` means (visible window, not full series),
   when to override with a literal date.
8. **The visual system**: palettes and their contrast rationale, TikTok safe
   zones, the 40px type floor, the no-glow / knockout-stroke rule, the
   x-axis-above-the-plot convention and why. Ported from the existing comments,
   which are the best documentation in the repo.
9. **Commands**: fetch, studio, render, checkpoint stills, stitch.
10. **QA checklist before publishing**: vintage timestamp checked, units and
    SA/NSA confirmed, latest value matches the source, nothing outside
    `TEXTSAFE`, checkpoint frames eyeballed, waypoint labels not stale.
11. **Rules for me**: never invent or interpolate a data value; never change a
    transform without saying so; render and look at frames before calling a
    video done; when a request needs a genuinely new chart type, say so rather
    than bending the line spec.

---

## 5. Deliberate non-goals

- **No grammar of graphics.** Line charts, cards, and lists cover what you have
  made and what you described. Bar and scatter get built when you actually need
  one, as a fourth body sharing the engine, not by abstracting the line body
  into something that can be anything.
- **No spec GUI.** JSON plus Remotion Studio preview is fast enough.
- **No cloud rendering.** Local render times here are seconds.
- **No git LFS.** Not installed, and unnecessary once `out/` is ignored.
- **Bespoke `.tsx` escape hatch stays.** If a video needs something genuinely
  one-off, write a component for it. The spec system is for the 90% case, and
  forcing the last 10% through config is how config systems rot.

---

## 6. Open decisions

1. ~~**Repo name.**~~ Decided: `cool_tiktok_graphics`, matching the remote
   that already existed under that name. Folder, `package.json`, and GitHub
   all agree as of Phase 0.
2. ~~**Private or public.**~~ Decided: public, kept as it already was.
3. **Palette default.** Petrol (dark) for everything, or dark for charts and
   paper (light) for cards? Right now everything is petrol and `PAPER` is unused.
4. **Sequence stitching.** Worth building in Phase 5, or do you assemble clips
   in a video editor anyway?

`out/` retention is no longer open: ignored, per the reasoning in Section 0.

None of these block Phase 0 or Phase 1.

---

## 7. Verified environment (checked 2026-08-24, before the move)

Everything here was confirmed by running it, not assumed. A fresh session can
trust this list.

**Data.** `tidyusmacro` is installed and `getFRED()` works with **no API key**
(it reads FRED's public CSV endpoint). Verified: `getFRED("LNS12300060")`
returned 943 rows through 2026-07-01. Multi-series named pulls work:
`getFRED(unrate="UNRATE", openings="JTSJOL")` returns one tidy frame with
lowercase column names and `NA` at ragged ends. There is **no** `FRED_API_KEY`
in `.Renviron`, and none is needed. Also installed: `fredr`, `blsR`, `tidyverse`,
`dplyr`, `jsonlite`, `httr2`, `lubridate`, `readr`.
`.Renviron` holds `BLS_KEY`, `BEA_KEY`, `CENSUS_API_KEY`, `NASS_API_KEY`,
`EIA_KEY`, `FOOD_DATA_KEY`, `IPUMS_API_KEY`.

**Toolchain.** Node v25.4.0, Remotion 4.0.515 installed (manifest says
`^4.0.290`, see Step 5), git 2.50.1, `jq` at `/usr/bin/jq`, `ffmpeg` at
`/opt/homebrew/bin/ffmpeg`, `R`/`Rscript` at `/usr/local/bin`. No `git-lfs`.

**Git.** `gh` authenticated as `mtkonczal` over HTTPS. Commit identity is
`Mike Konczal <100174099+mtkonczal@users.noreply.github.com>`.
`init.defaultBranch` is unset, so pass `-b main` explicitly; sibling repos use
`main`. Global gitignore at `~/.gitignore` contains only
`**/.claude/settings.local.json`, so `.DS_Store` and `node_modules` must be
handled locally. `~/Documents/GitHub` holds 38 repos;
`ai-tech-markets-research` is the best local model for a commented `.gitignore`
and a repo-root `CLAUDE.md`.

**Sizes.** `node_modules` 583 MB, `out/` 7.7 MB across 10 mp4s, `src/` 144 KB,
`public/` 96 KB, `_pre-petrol-backup/` 128 KB (delete it).

**Current source inventory.** 16 files, 1,654 lines in `src/`:
`chartEngine.ts` 204, `theme.ts` 113, `fonts.ts` 35, `index.ts` 4,
`ripCardEngine.ts` 66, `Root.tsx` 89, `ChartChrome.tsx` 75,
`LineChartBody.tsx` 338, `TwoLineChartBody.tsx` 179, `PrimeEpopReveal.tsx` 39,
`PrimeEpopZoomOut.tsx` 127, `UnrateReveal.tsx` 54,
`UnemployedOpeningsReveal.tsx` 51, `RipCardReveal.tsx` 52, `RipCardBody.tsx` 108,
`ListReveal.tsx` 32, `ListRevealBody.tsx` 88.

**Current data files and what we know about their provenance.** All five were
pasted in from outside; none has a recorded vintage. This is what Phase 1 fixes.

| File | Rows | Span | Almost certainly |
| --- | --- | --- | --- |
| `data_1995_present.json` | 379 | 1995-01 to 2026-07 | `LNS12300060`, prime-age EPOP, 1 decimal |
| `data_2019_present.json` | 91 | 2019-01 to 2026-07 | same series, shorter window |
| `data_unrate_2022_present.json` | 55 | 2022-01 to 2026-07 | unemployed / labor force, 4 decimals, **not** `UNRATE` |
| `data_unemployed_2023_present.json` | 42 | 2023-01 to 2026-06 | `UNEMPLOY`, thousands |
| `data_openings_2023_present.json` | 42 | 2023-01 to 2026-06 | `JTSJOL`, thousands |
| `cards_full_employment_reasons.json` | 3 | n/a | list-card copy, not data |

**Known stale hardcodes to fix, not preserve.** `UnrateReveal.tsx:18-20` pins
`2023-04-01` as the low, `2024-07-01` as "two years ago", and `2025-11-01` as
the cycle high. `PrimeEpopZoomOut.tsx` pins `2024-01-01` as the average window
start and labels it "2024-2026 average". Both need to become resolvers.
