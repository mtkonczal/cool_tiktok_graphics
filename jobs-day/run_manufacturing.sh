#!/usr/bin/env bash
# Standalone: the two manufacturing-employment videos, nothing else.
#
#   ./jobs-day/run_manufacturing.sh
#
# Does, in order:
#   1. Force-refresh manufacturing, manufacturing_change from the BLS API
#      (data/fetch.R --refresh) -> src/data/manufacturing.json,
#      src/data/manufacturing_change.json
#   2. Render specs/jobs-day/manufacturing-employment-level.json (LineVideo,
#      single series, drawn recent-then-zoomed-out to 1990) ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-manufacturing-level.mp4
#   3. Render specs/jobs-day/manufacturing-employment-change.json (BarVideo,
#      single series, colored by sign) ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-manufacturing-bar.mp4
#
# Both series are CES3000000001 (All Employees, Manufacturing) via the
# direct BLS API -- same source type as payrolls_change, see
# data/series.json's notes on `manufacturing`/`manufacturing_change`. Needs
# BLS_KEY in the environment, same as run_total_employment.sh. No scrape
# step.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── refreshing manufacturing, manufacturing_change from BLS ─────────────"
Rscript data/fetch.R --refresh manufacturing manufacturing_change

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3 -- Remotion's bundler needs
# a literal import graph, so this can't be automated away).
if ! grep -q "manufacturing:" src/data/registry.ts 2>/dev/null || ! grep -q "manufacturing_change:" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about manufacturing/manufacturing_change yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block:
    import manufacturing from "./manufacturing.json";
    import manufacturingChange from "./manufacturing_change.json";

  In the SERIES_DATA map:
    manufacturing: manufacturing as DataRow[],
    manufacturing_change: manufacturingChange as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering manufacturing-employment-level.json ───────────────────────"
./make.sh specs/jobs-day/manufacturing-employment-level.json

echo
echo "── rendering manufacturing-employment-change.json ──────────────────────"
./make.sh specs/jobs-day/manufacturing-employment-change.json

echo
echo "Done. Vintage-check the print above before recording."
