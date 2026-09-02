# jobs-day

A monthly-reusable folder for the jobs-day TikTok suite: six videos across
four standalone scripts, built from the same headline data that feeds
`BLS-CPS-Jobs-Numbers/01_initial_tweet.R`. Most of it pulls directly from
BLS rather than FRED (see "why BLS not FRED" below); the two prime-age
videos are the exception, sourced from FRED since they're not part of that
direct-BLS-API path (see `run_prime_age.sh` below).

## What's here

- `run_unemployment_rate.sh` — standalone: fetch `unrate_bls`, render
  `unemployment-rate.json` (`LineVideo`). No scrape step.
- `run_payrolls_revisions.sh` — standalone: scrape, fetch
  `payrolls_change_1st`/`_2nd`/`_3rd`, render `monthly-job-growth.json`
  (`BarVideo`).
- `run_total_employment.sh` — standalone: fetch `payrolls_change`, render
  `total-employment-change.json` (`LineVideo`) and
  `total-employment-change-bar.json` (`BarVideo`, same series). No scrape
  step.
- `run_prime_age.sh` — standalone: fetch `prime_epop`/`prime_lfpr` from
  FRED, render `prime-epop-zoomout.json` and
  `prime-epop-participation-2025.json` (both `LineVideo`). No scrape step.
  The one script in this folder that pulls from FRED instead of the BLS API
  — see the intro above and the video list below for why.
- `run_manufacturing.sh` — standalone: fetch `manufacturing`/
  `manufacturing_change`, render `manufacturing-employment-level.json`
  (`LineVideo`, drawn recent-then-zoomed-out to 1990) and
  `manufacturing-employment-change.json` (`BarVideo`, same series pattern
  as `total-employment-change-bar.json`). No scrape step. **Not yet fetched
  or rendered as of this writing** — see the note at the end of this file.
- `run_gender_split.sh` — standalone: fetch `men_change`/`women_change`,
  render `gender-jobs-stacked.json` (`BarVideo`, 2-series **stacked** —
  the first spec in this repo to use `BarSpec.stacked`). No scrape step.
  **Not yet fetched or rendered as of this writing** — see the note at the
  end of this file.
- `run_jobs_day.sh` — convenience wrapper: runs the six scripts above in
  sequence. Nothing in it isn't in one of the six; use it when you want
  everything, use one of the six directly when you don't. See "Are these
  generated together?" below.
- `scrape_revisions.py` — scrapes the BLS CES revisions table
  (bls.gov/web/empsit/cesnaicsrev.htm), same page and parsing logic as
  `BLS-CPS-Jobs-Numbers/99_download_jobs_revisions.py` (there's also an
  unmodified copy of that script at the repo root, `99_download_jobs_revisions.py`,
  for side-by-side diffing if the upstream script ever changes). Writes
  `jobs-day/data/bls_ces_monthly_revisions.csv` (gitignored — regenerate any
  time, it isn't the vintage record; the `src/data/payrolls_change_*.json`
  files + their `.meta.json` sidecars are). Only `run_payrolls_revisions.sh`
  needs this — the other five pull straight from the BLS/FRED APIs.
- `../specs/jobs-day/*.json` — the nine specs (kept in the repo's normal
  `specs/` tree, in a `jobs-day/` subfolder, rather than duplicating the
  spec convention here). `prime-epop-zoomout.json` and
  `prime-epop-participation-2025.json` moved here from top-level `specs/`
  (`git mv`, so their history follows) specifically to join this suite —
  they were already using `prime_epop`/`prime_lfpr`, the same monthly
  Employment Situation release every other jobs-day video covers, just via
  FRED rather than a fresh registry entry of their own.
- `../data/series.json` gained five new registry entries (`unrate_bls`,
  `payrolls_change_1st`/`_2nd`/`_3rd`/`_change`), and `../data/fetch.R`
  gained two new source types (`"bls"`, `"bls_scrape"`) to pull them.
  `prime_epop`/`prime_lfpr` are older, pre-existing FRED-sourced entries,
  unchanged by any of this. It later gained four more `"bls"`-sourced
  entries for the manufacturing/gender additions below (`manufacturing`,
  `manufacturing_change`, `women_change`, `men_change`) — no new source
  type needed, same `"bls"` mechanism `payrolls_change` already uses.
- `../src/compositions/BarVideo.tsx` + `../src/bodies/BarBody.tsx` — a new
  chart-type composition (grouped bars, revealed group-by-group left to
  right), alongside `LineVideo`/`LineBody` rather than bending the line spec
  to fake a bar chart (see CLAUDE.md Section 11's rule against exactly that,
  and Section 12 for how it plugs into `make.sh`/`Root.tsx`/the validator).
  `theme.ts` gained a third palette color (`seriesAlt`, a derived green/teal
  depending on theme) for the third bar in each group — see its comment for
  the derivation. It later gained a `stacked` mode (`BarSpec.stacked`) for
  the gender-split video — see that video's own entry below and
  `BarBody.tsx`'s `stacked` prop comment for the diverging-stack mechanics.
- Every spec in this folder except `monthly-job-growth.json` now renders
  with `"theme": "butter_on_espresso"` (root `CLAUDE.md` Section 13,
  `src/themes/`) — a warm dark palette with a serif headline, distinct from
  the mikekonczal.com-derived default every other spec in this repo still
  uses. `BarVideo`/`BarBody` are now theme-aware too (same optional-prop-
  plus-shadow mechanism as `LineBody`/`ChartChrome` — see CLAUDE.md Section
  13's "How `LineBody`/`ChartChrome` actually become theme-aware"), added
  specifically to give `total-employment-change-bar.json` the same look as
  its line counterpart. `monthly-job-growth.json` (the 3-series `BarVideo`)
  doesn't set a `"theme"` and keeps rendering with the untouched default
  petrol/paper palette from `theme.ts` — nothing about it changed.
- **Applying the theme to `prime-epop-zoomout.json` and
  `prime-epop-participation-2025.json` surfaced two real bugs, both fixed
  at the spec level with no engine changes**: butter's title is Playfair
  Display at 86px (vs. `konczal_webpage`'s 60px Newsreader) — comfortably
  wider per character, and `ChartChrome`'s title has no auto-fit/wrap, so
  either spec's original long title (`"Prime-age employment rate"` /
  `"Employment & participation"`) ran clean off the right edge of the frame
  (checked by rendering — the fix every other butter spec in this repo
  already needed by accident, since `"Total employment"`/`"Unemployment
  rate"` both happen to be short). Both specs now set an explicit, shorter
  `chrome.title` (`"Employment rate"` / `"EPOP vs. LFPR"`) confirmed by
  rendering to land inside `TEXTSAFE`. Separately, `prime-epop-zoomout.json`'s
  first (narrow, 2019-latest) shot's three close waypoints (Dec 2019, May
  2023, latest) fit cleanly under `konczal_webpage`'s narrower date/value
  text but collided under butter's wider Archivo Bold labels, which forced
  `LineBody`'s row-stagger collision system to bump one label up a row —
  and this shot's available headroom (a function of the data's own y-range,
  not the theme) was too small to fit even one extra row without
  overshooting into the x-axis tick row above the plot (checked by
  instrumenting and rendering the actual collision math, not guessed).
  Fixed with `"waypointHideDate": ["2023-05-01"]` — dropping that one
  waypoint's date line (CLAUDE.md Section 7's existing, documented lever
  for "several waypoints labeled close together") shortens it just enough
  that all three fit on the shared row with no stagger needed at all.
  `manufacturing-employment-level.json` and `gender-jobs-stacked.json`
  below use short `chrome.title`s (`"Manufacturing jobs"` / `"Who gained
  jobs"`) specifically to avoid needing this same fix — chosen by length
  comparison against the two titles that are already confirmed to fit, not
  yet confirmed by rendering (see the note at the end of this file).
- **`total-employment-change-bar.json`** (`BarVideo`) is a second rendering
  of `total-employment-change.json`'s exact series (`payrolls_change`) as a
  single-series bar chart instead of a line: one bar per month, colored by
  sign rather than a flat series color — a gain renders in the theme's
  `series` color (butter yellow), a loss in its `accent` color (hot orange,
  otherwise reserved for a `LineVideo`'s "latest" waypoint dot — reused here
  since a `BarVideo` has no waypoints to compete with it). This is a new,
  general `BarBody` capability (`negativeColor`), not a one-off hack: any
  future single-series bar spec gets sign-coloring for free, and a
  single-series bar chart's legend (redundant with the title/subtitle) is
  suppressed automatically rather than shown with one swatch. A grouped
  (2-3 series) bar spec like `monthly-job-growth.json` is unaffected either
  way — sign-coloring and the legend only change behavior when
  `series.length === 1`. `manufacturing-employment-change.json` reuses this
  same `negativeColor` mechanism unchanged.

## Are these generated together?

Originally yes — one script did all of it. That's now six standalone
scripts plus a wrapper (above) precisely so each can be run, tweaked, and
re-rendered independently. This is meant to generalize: the long-term idea
is one script per monthly data release this repo covers (CPI, JOLTS, etc.,
as those get built out), not one big script per release that bundles every
chart from it. `jobs-day` itself covers one release (BLS's Employment
Situation) but produces nine videos across six standalone scripts (the
total-employment, prime-age, and manufacturing scripts each render two
videos from one fetch), so it already needed this split internally.

## The nine videos, and why most of them are BLS- not FRED-sourced

Both `payrolls_change*` and `unrate_bls` pull the *same underlying numbers*
FRED eventually gets, not FRED's copies of them, because on jobs day itself
BLS publishes before FRED has necessarily synced, and because none of the
`payrolls_change*` series are FRED series at all (see below). `prime_epop`/
`prime_lfpr` (videos 5-6) are the exception — plain FRED-sourced series,
predating this direct-BLS-API convention, joining this suite because
they cover the same monthly release, not because they were re-sourced to
match it. The manufacturing and gender-split videos (7-9) are direct-BLS,
same convention as `payrolls_change`.

1. **`jobs-day-unrate`** (`unemployment-rate.json`, `LineVideo`) —
   unemployment rate, `100 * LNS13000000 / LNS11000000` (unemployment level
   / labor force level), pulled straight from the BLS public API via
   `blsR`. Same construction as `01_initial_tweet.R`'s right panel and as
   the existing FRED-sourced `unrate` registry entry (`100 * UNEMPLOY /
   CLF16OV`) — FRED's UNEMPLOY/CLF16OV are themselves just BLS's numbers, so
   in steady state these two series should match to the decimal. The point
   of `unrate_bls` isn't different numbers, it's not depending on FRED's
   sync timing on the one day of the month timing actually matters.
   Waypoints are `["min", "max", "-2m", "-1m", "latest"]` — the historical
   low/high plus the last three prints as their own labeled points (`-1m`/
   `-2m` are relative tokens, CLAUDE.md Section 7, so this rolls forward on
   its own) — at `displayDecimals: 2`, since a 1-decimal rate rounds two
   adjacent recent months to the same printed value often enough that the
   line's actual up/down isn't legible from the labels alone.

2. **`jobs-day-payrolls`** (`monthly-job-growth.json`, `BarVideo`) —
   monthly change in total nonfarm payrolls, grouped bars for the 1st/2nd/3rd
   published estimate of each month (`sa_1st`/`sa_2nd`/`sa_3rd` from the BLS
   revisions table), matching `01_initial_tweet.R`'s left panel. A given
   month's 2nd/3rd bar is simply absent until BLS has actually published
   that revision (most recently, the current month only has a 1st estimate)
   — this falls out of the same "gap in the data is a gap on screen" rule
   CLAUDE.md's Section 11 states for line charts; `BarBody` just skips
   drawing a `null` bar rather than drawing one at zero. The window is a
   short, fixed span (`"2026-03-01"` to `"latest"` as of this writing, ~5
   months) rather than the ~2-year windows the line specs use — see "Things
   worth a human glance" below for why, and what to do about it monthly.

3. **`jobs-day-total-employment`** (`total-employment-change.json`,
   `LineVideo`) — monthly change in total nonfarm payrolls again, but a
   deliberately DIFFERENT number from `payrolls_change_1st` above: this is
   `payrolls_change`, `CES0000000001` (total nonfarm employment level, SA)
   differenced month-over-month via the BLS API, so every historical month
   reflects however many rounds of revision have landed since — the
   current best-known change, not a frozen first print. Matches the
   `ces = CES0000000001 - lag(CES0000000001, 1)` pattern used throughout
   `BLS-CPS-Jobs-Numbers` (`00_run_monthly.R`, `02_unrate_jobs.R`). Window
   is `["2024-01-01", "latest"]`; only `"latest"` is a waypoint (no min/max,
   no last-3-months) — this one video is deliberately just "here's the
   line, here's where it is right now." Shots are `draw: 3.0s` / `hold:
   10.0s`, a 3-second sweep across ~2.5 years of history followed by a long
   hold — plenty of time to talk over the final number without the video
   ending mid-sentence.

4. **`jobs-day-total-employment-bar`** (`total-employment-change-bar.json`,
   `BarVideo`) — the SAME `payrolls_change` series as #3, rendered as a
   single-series bar chart instead of a line, to sit next to it in `out/`.
   Also `"theme": "butter_on_espresso"`, so the two share type/color. Each
   bar is colored by sign rather than one flat series color — a gain in
   butter yellow (`palette.series`), a loss in hot orange
   (`palette.accent`) — via `BarBody`'s new `negativeColor` prop, which only
   engages for a single-series bar spec (a grouped one like
   `monthly-job-growth.json` keeps its per-series legend colors unchanged).
   Window is `["2025-12-01", "latest"]`, currently 8 months — deliberately
   much shorter than #3's `["2024-01-01", "latest"]`, because a `BarVideo`
   window is literally what's on screen (CLAUDE.md Section 12) and 8
   one-bar-per-month groups is the confirmed max that keeps 3-digit value
   labels from crowding at this frame width (checked by rendering — see
   "Things worth a human glance" below). `revealSeconds`/`holdSeconds` are
   `3.0`/`10.0`, matching #3's `draw`/`hold` shot lengths.

5. **`prime-epop-zoomout`** (`prime-epop-zoomout.json`, `LineVideo`) —
   the prime-age (25-54) employment rate, `LNS12300060` straight from FRED,
   drawn over 2019-latest then zoomed out to the full 1995-latest history.
   Waypoints are `["1999-01-01", "2019-12-01", "2023-05-01", "latest"]` —
   a pre-2001-recession peak, the pre-COVID peak, an editorial "recovery
   complete" point, and the current value — plus an `hline` showing the
   2024-2026 average once zoomed out. `chrome.title` is explicitly
   `"Employment rate"` (see the theme bullet above for why) rather than the
   registry's full `"Prime-age employment rate"`; the subtitle still pulls
   the registry's `"Employed share of the population, ages 25–54"` to keep
   the age slice explicit.
6. **`prime-epop-participation-2025`** (`prime-epop-participation-2025.json`,
   `LineVideo`) — the same prime-age employment rate plus its companion
   labor-force-participation rate (`prime_lfpr`, `LNS11300060`) as a static
   2-line comparison (2+ series mode — CLAUDE.md Section 4 — so each line
   gets its own on-chart label instead of waypoints), windowed to
   `["2025-01-01", "latest"]`. `chrome.title` is `"EPOP vs. LFPR"` (again,
   see the theme bullet above); despite the acronyms, the two full names
   ("Prime-age employment rate" / "Prime-age labor force participation")
   still render directly on the chart as each line's own label, so nothing
   about what's being compared is lost.

7. **`jobs-day-manufacturing-level`** (`manufacturing-employment-level.json`,
   `LineVideo`) — manufacturing employment, `CES3000000001` (All Employees,
   Manufacturing) straight from the BLS API, drawn over 2015-latest then
   zoomed out to 1990-latest. Waypoints are `["max", "2019-12-01",
   "latest"]` with `waypointAnchor: "point"` (a wide-range mix: the 1990-
   latest historical max is almost certainly a late-1990s value far above
   the pre-COVID and current levels) — the point being to let the zoomed-
   out shot make the long secular-decline case (current employment well
   below its `"max"` waypoint) alongside the 2015-latest short view. An
   `hline` shows the 2024-2026 average once zoomed out, same pattern as
   `prime-epop-zoomout.json`. Registered at `decimals: 1` (registry note)
   so on-screen values read e.g. "12.9M" instead of flattening to "13M".

8. **`jobs-day-manufacturing-bar`** (`manufacturing-employment-change.json`,
   `BarVideo`) — `manufacturing_change` (CES3000000001 differenced month-
   over-month, same construction as `payrolls_change`), single-series bar
   chart colored by sign, same pattern and window convention as
   `total-employment-change-bar.json` (#4).

9. **`jobs-day-gender-stacked`** (`gender-jobs-stacked.json`, `BarVideo`) —
   the first spec in this repo to set `"stacked": true`: `men_change` and
   `women_change` (CES0000000001/CES0000000010-derived monthly changes, see
   `data/series.json`'s notes) drawn as one column per month instead of two
   side-by-side bars, positive values stacking upward from zero and
   negative values stacking downward from zero (a diverging stack, not a
   naive sequential cumsum — see `BarBody.tsx`'s `stacked` prop comment for
   why that distinction matters whenever one sex loses jobs in a given
   month). `men_change` + `women_change` reconstructs `payrolls_change`
   exactly every month, by construction. Each segment's value label sits at
   its own vertical midpoint, colored `palette.bg` rather than
   `palette.text` — the in-segment equivalent of this repo's usual outside-
   the-bar label, chosen because every series/seriesAlt color here is
   already tuned for high contrast against `bg` (see `butter_on_espresso.ts`),
   and contrast is symmetric.

## Prerequisites

- `BLS_KEY` in the environment (needed by every script except
  `run_prime_age.sh`). R picks this up from `~/.Renviron` automatically
  (same as `BLS-CPS-Jobs-Numbers`) — nothing to export by hand if that's
  already set up, which it should be on this machine.
- A working FRED setup for `data/fetch.R` (needed only by
  `run_prime_age.sh`) — same one every other FRED-sourced series in this
  repo already uses.
- `blsR` installed for R (already confirmed installed — see
  `PLAN.md` Section 7's verified-environment notes).
- `python3` with `pandas` and `requests` (confirmed installed) — only
  needed for `run_payrolls_revisions.sh`. `curl_cffi` is optional but
  recommended — without it, `scrape_revisions.py` falls back to a plain
  `requests` session, which BLS's Akamai bot detection occasionally 403s.
  Install with:
  ```bash
  pip install curl_cffi
  ```

## Running it

```bash
cd cool_tiktok_graphics

# Everything:
./jobs-day/run_jobs_day.sh

# Or just one:
./jobs-day/run_unemployment_rate.sh
./jobs-day/run_payrolls_revisions.sh
./jobs-day/run_total_employment.sh
./jobs-day/run_prime_age.sh
./jobs-day/run_manufacturing.sh
./jobs-day/run_gender_split.sh
```

**First run only, per script** — the first time each script's fetch step
produces a new `src/data/*.json` file, that script will stop and tell you
to add import lines to `src/data/registry.ts` (Remotion's bundler needs a
literal static import graph, so this one step can't be scripted away — see
CLAUDE.md Section 3). Add them, then re-run the same command. Every run
after that is fully unattended. (The seven original jobs-day series,
including `prime_epop`/`prime_lfpr`, are already registered as of this
writing — this only bites again if `registry.ts` is reverted. The four
newer series below — `manufacturing`, `manufacturing_change`, `men_change`,
`women_change` — are NOT yet registered, so `run_manufacturing.sh` and
`run_gender_split.sh` will hit this STOP block on their first run; that's
expected, not a bug.)

## Manufacturing and gender-split additions: not yet fetched or rendered

`run_manufacturing.sh`, `run_gender_split.sh`, their three specs
(`manufacturing-employment-level.json`, `manufacturing-employment-change.json`,
`gender-jobs-stacked.json`), the four new `data/series.json` entries, and
`BarBody`'s new `stacked` prop were all written and validated
(`node scripts/validate-spec.mjs`, plus a clean `tsc --noEmit`) without
access to `Rscript`, a BLS-key-bearing environment, or `npx remotion
render` — so none of the following has actually happened yet, and none of
it should be assumed to work until it does:

- The BLS fetches (`Rscript data/fetch.R --refresh manufacturing
  manufacturing_change men_change women_change`) have not run. The four
  series' `expr` strings (R, evaluated by `data/fetch.R` via
  `eval(parse(text = ...))`) have not been executed even once.
- `src/data/registry.ts` has not been touched — both new scripts will stop
  at their one-time STOP check on first run and print the exact import/map
  lines to add (same mechanism every other series in this folder already
  uses).
- No video has been rendered. In particular, `gender-jobs-stacked.json`'s
  stacked-bar geometry (`BarBody.tsx`'s new `stacked` branch: diverging
  positive/negative stacking, `palette.bg`-colored in-segment labels, the
  narrower single-column bar width) has never been checked by eye — only
  by TypeScript compiling and the spec validator accepting the shape. The
  in-segment label contrast and the "positive stacks up, negative stacks
  down" layout are reasoned from this repo's documented palette-contrast
  numbers and the existing per-bar reveal math, not confirmed by rendering.
- `manufacturing-employment-level.json`'s and `gender-jobs-stacked.json`'s
  short `chrome.title`s were chosen by comparing character counts against
  `"Employment rate"`/`"EPOP vs. LFPR"` (already confirmed to fit under
  `butter_on_espresso` — see the theme bullet above), not by rendering
  these two specs themselves.

**To actually turn these into videos**: run `./jobs-day/run_manufacturing.sh`
and `./jobs-day/run_gender_split.sh` from a terminal with `BLS_KEY` set
(e.g. via Claude Code on this machine, where `Rscript`/`.Renviron` are
available). Each will stop once with the registry.ts edit instructions;
add those four lines, re-run, and check the rendered `.mp4`s in
`out/jobs-day/` before posting — especially the stacked chart's layout and
labels, and both new specs' titles against `TEXTSAFE`.
