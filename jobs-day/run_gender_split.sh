#!/usr/bin/env bash
# Standalone: the men/women stacked monthly-change video, nothing else.
#
#   ./jobs-day/run_gender_split.sh
#
# Does, in order:
#   1. Force-refresh men_change, women_change from the BLS API
#      (data/fetch.R --refresh) -> src/data/men_change.json,
#      src/data/women_change.json
#   2. Render specs/jobs-day/gender-jobs-stacked.json (BarVideo, 2-series
#      stacked) -> out/jobs-day/YYYY-MM-DD-jobs-day-gender-stacked.mp4
#
# women_change is CES0000000010 (women employees, total nonfarm) differenced
# month-over-month; men_change is the total-minus-women residual, both via
# the direct BLS API in one request per series (see data/series.json's
# notes). Needs BLS_KEY in the environment, same as run_total_employment.sh.
# No scrape step.
#
# `"stacked": true` (BarSpec/BarBody) is new with this script: positive
# values stack upward from zero in series order, negative values stack
# downward from zero in series order, so a month where one sex lost jobs
# still reads as "gains above the line, losses below" rather than a naive
# cumulative sum burying a negative segment inside the positive stack. See
# src/bodies/BarBody.tsx's `stacked` prop comment.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── refreshing men_change, women_change from BLS ────────────────────────"
Rscript data/fetch.R --refresh men_change women_change

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3 -- Remotion's bundler needs
# a literal import graph, so this can't be automated away).
if ! grep -q "men_change:" src/data/registry.ts 2>/dev/null || ! grep -q "women_change:" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about men_change/women_change yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block:
    import menChange from "./men_change.json";
    import womenChange from "./women_change.json";

  In the SERIES_DATA map:
    men_change: menChange as DataRow[],
    women_change: womenChange as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering gender-jobs-stacked.json ───────────────────────────────────"
./make.sh specs/jobs-day/gender-jobs-stacked.json

echo
echo "Done. Vintage-check the print above before recording."
