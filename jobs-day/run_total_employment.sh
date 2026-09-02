#!/usr/bin/env bash
# Standalone: the total-employment-change videos, nothing else.
#
#   ./jobs-day/run_total_employment.sh
#
# Does, in order:
#   1. Force-refresh payrolls_change from the BLS API (data/fetch.R --refresh)
#      -> src/data/payrolls_change.json
#   2. Render specs/jobs-day/total-employment-change.json (LineVideo) ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-total-employment.mp4
#   3. Render specs/jobs-day/total-employment-change-bar.json (BarVideo) ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-total-employment-bar.mp4 -- same
#      series, same butter_on_espresso theme, as a single-series bar chart
#      instead of a line (bars colored by sign: butter yellow for a gain,
#      the theme's accent orange for a loss -- BarBody's `negativeColor`).
#      Its window is a short trailing span (currently 8 months), NOT the
#      line video's multi-year one -- a BarVideo window is literally what's
#      on screen (CLAUDE.md Section 12), and 8 one-bar-per-month groups is
#      the confirmed max that keeps value labels from crowding at this
#      frame width (checked by rendering). Bump the start date forward each
#      month the same way monthly-job-growth.json's window needs it.
#
# No scrape step -- payrolls_change is CES0000000001 differenced via the BLS
# API (see data/series.json's note on why this is a DIFFERENT number from
# payrolls_change_1st: current best-known change, not a frozen first print).
# Needs BLS_KEY in the environment.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── refreshing payrolls_change from BLS ─────────────────────────────────"
Rscript data/fetch.R --refresh payrolls_change

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3 -- Remotion's bundler needs
# a literal import graph, so this can't be automated away).
if ! grep -q "payrolls_change:" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about payrolls_change yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block, after `import recessions from "./recessions.json";`:
    import payrollsChange from "./payrolls_change.json";

  In the SERIES_DATA map, after `recessions: recessions as DataRow[],`:
    payrolls_change: payrollsChange as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering total-employment-change.json ──────────────────────────────"
./make.sh specs/jobs-day/total-employment-change.json

echo
echo "── rendering total-employment-change-bar.json ──────────────────────────"
./make.sh specs/jobs-day/total-employment-change-bar.json

echo
echo "Done. Vintage-check the print above before recording."
