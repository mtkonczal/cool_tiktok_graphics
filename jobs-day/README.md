# jobs-day

A monthly-reusable folder for the jobs-day TikTok suite: three videos, each
with its own standalone script, built from the same headline data that
feeds `BLS-CPS-Jobs-Numbers/01_initial_tweet.R`, sourced directly from BLS
rather than FRED.

## What's here

- `run_unemployment_rate.sh` — standalone: fetch `unrate_bls`, render
  `unemployment-rate.json` (`LineVideo`). No scrape step.
- `run_payrolls_revisions.sh` — standalone: scrape, fetch
  `payrolls_change_1st`/`_2nd`/`_3rd`, render `monthly-job-growth.json`
  (`BarVideo`).
- `run_total_employment.sh` — standalone: fetch `payrolls_change`, render
  `total-employment-change.json` (`LineVideo`). No scrape step.
- `run_jobs_day.sh` — convenience wrapper: runs the three scripts above in
  sequence. Nothing in it isn't in one of the three; use it when you want
  everything, use one of the three directly when you don't. See "Are these
  generated together?" below.
- `scrape_revisions.py` — scrapes the BLS CES revisions table
  (bls.gov/web/empsit/cesnaicsrev.htm), same page and parsing logic as
  `BLS-CPS-Jobs-Numbers/99_download_jobs_revisions.py` (there's also an
  unmodified copy of that script at the repo root, `99_download_jobs_revisions.py`,
  for side-by-side diffing if the upstream script ever changes). Writes
  `jobs-day/data/bls_ces_monthly_revisions.csv` (gitignored — regenerate any
  time, it isn't the vintage record; the `src/data/payrolls_change_*.json`
  files + their `.meta.json` sidecars are). Only `run_payrolls_revisions.sh`
  needs this — the other two pull straight from the BLS API.
- `../specs/jobs-day/*.json` — the three specs (kept in the repo's normal
  `specs/` tree, in a `jobs-day/` subfolder, rather than duplicating the
  spec convention here).
- `../data/series.json` gained five new registry entries (`unrate_bls`,
  `payrolls_change_1st`/`_2nd`/`_3rd`/`_change`), and `../data/fetch.R`
  gained two new source types (`"bls"`, `"bls_scrape"`) to pull them.
- `../src/compositions/BarVideo.tsx` + `../src/bodies/BarBody.tsx` — a new
  chart-type composition (grouped bars, revealed group-by-group left to
  right), alongside `LineVideo`/`LineBody` rather than bending the line spec
  to fake a bar chart (see CLAUDE.md Section 11's rule against exactly that,
  and Section 12 for how it plugs into `make.sh`/`Root.tsx`/the validator).
  `theme.ts` gained a third palette color (`seriesAlt`, a derived green) for
  the third bar in each group — see its comment for the derivation.

## Are these generated together?

Originally yes — one script did all of it. That's now three standalone
scripts plus a wrapper (above) precisely so each can be run, tweaked, and
re-rendered independently. This is meant to generalize: the long-term idea
is one script per monthly data release this repo covers (CPI, JOLTS, etc.,
as those get built out), not one big script per release that bundles every
chart from it. `jobs-day` itself covers one release (BLS's Employment
Situation) but produces three separate videos, so it already needed this
split internally.

## The three videos, and why they're BLS- not FRED-sourced

Both `payrolls_change*` and `unrate_bls` pull the *same underlying numbers*
FRED eventually gets, not FRED's copies of them, because on jobs day itself
BLS publishes before FRED has necessarily synced, and because none of the
`payrolls_change*` series are FRED series at all (see below).

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

## Prerequisites

- `BLS_KEY` in the environment. R picks this up from `~/.Renviron`
  automatically (same as `BLS-CPS-Jobs-Numbers`) — nothing to export by
  hand if that's already set up, which it should be on this machine.
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
```

**First run only, per script** — the first time each script's fetch step
produces a new `src/data/*.json` file, that script will stop and tell you
to add import lines to `src/data/registry.ts` (Remotion's bundler needs a
literal static import graph, so this one step can't be scripted away — see
CLAUDE.md Section 3). Add them, then re-run the same command. Every run
after that is fully unattended. (All five jobs-day series are already
registered as of this writing — this only bites again if `registry.ts` is
reverted, or a new series is added later.)

To run a video's steps individually (e.g. to re-render after tweaking a
spec, without re-fetching):

```bash
node scripts/validate-spec.mjs specs/jobs-day/unemployment-rate.json
./make.sh specs/jobs-day/unemployment-rate.json

node scripts/validate-spec.mjs specs/jobs-day/monthly-job-growth.json
./make.sh specs/jobs-day/monthly-job-growth.json

node scripts/validate-spec.mjs specs/jobs-day/total-employment-change.json
./make.sh specs/jobs-day/total-employment-change.json
```

Output lands in `out/jobs-day/YYYY-MM-DD-jobs-day-{unrate,payrolls,total-employment}.mp4`
— today's date, not a data date, per `make.sh`'s existing convention (see
root `CLAUDE.md` Section 9). The `jobs-day/` nesting isn't special-cased for
this folder -- `make.sh` derives it from the spec's own path (any
`specs/<release>/` spec renders into the matching `out/<release>/`), so a
future release folder gets the same grouping automatically.

## Things worth a human glance each month

- `unemployment-rate.json` and `total-employment-change.json`'s `window`s
  start at a hardcoded date (top-level `window` can't be a relative token —
  see `CLAUDE.md` Section 5 — so unlike a shot's own window this doesn't
  roll forward on its own). Bump them forward roughly once a year (unrate)
  or as the multi-year span starts feeling too long (total-employment) so
  the reveal doesn't show an ever-growing span; every waypoint token in both
  specs (`min`/`max`/`-1m`/`-2m`/`latest`) self-corrects regardless of the
  window's start.
- `monthly-job-growth.json`'s `window` needs a **monthly** bump, not yearly:
  a `BarVideo` window is literally what's on screen (no zoom/pan shots to
  grow into), and `BarBody` fits a fixed number of month-groups into a fixed
  plot width — 5 months is the confirmed max that renders with no
  overlapping value labels (checked by rendering, at 6 and 7 months even a
  smaller font still left two 3-digit labels touching within a group).
  Move the start date forward by one month each time you run this, keeping
  it to a 5-month trailing window.
- `scrape_revisions.py` scrapes a live HTML table — if BLS restructures
  that page, it fails loudly (a `RuntimeError`, not a silent empty file);
  if that happens, the same fix applies here as it would in
  `BLS-CPS-Jobs-Numbers/99_download_jobs_revisions.py`, since it's a direct
  port of that script's parsing logic (and the repo-root copy of that same
  script is there to diff against if the upstream one changes).
- A real gap exists in `sa_1st` at October 2025 (no standalone first print
  that month — BLS folded it into a later combined release during the 2025
  shutdown). `data/fetch.R`'s `bls_scrape` source now preserves that as a
  `null` row rather than silently dropping it (dropping it turned a 1-month
  gap into a 61-day hole that failed the monthly-cadence sanity check) — if
  a `BarVideo` window ever includes that month, expect that group to show
  only whichever estimates actually exist for it. `payrolls_change` (the
  `CES0000000001`-differenced series) has no such gap — BLS still published
  a combined-period *level*, `lag()` just differences straight across it.
- `payrolls_change*`'s displayed values are already in thousands of jobs
  (e.g. "224", not "224,000" or "0.224M") — matches how `01_initial_tweet.R`
  labels its bars. Confirm this still reads right after any format.ts change.
- `payrolls_change_1st` and `payrolls_change` will show DIFFERENT numbers
  for the same month once revisions land (see item 3 above) — this is
  correct, not a bug. If the two jobs-day-payrolls-flavored videos in one
  posting cycle show different values for the same month, that's the point
  of having both; don't "fix" one to match the other.
