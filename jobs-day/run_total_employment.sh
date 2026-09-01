#!/usr/bin/env bash
# Standalone: the total-employment-change video, nothing else.
#
#   ./jobs-day/run_total_employment.sh
#
# Does, in order:
#   1. Force-refresh payrolls_change from the BLS API (data/fetch.R --refresh)
#      -> src/data/payrolls_change.json
#   2. Render specs/jobs-day/total-employment-change.json ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-total-employment.mp4
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
echo "Done. Vintage-check the print above before recording."
