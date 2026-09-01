#!/usr/bin/env bash
# Standalone: the unemployment-rate video, nothing else.
#
#   ./jobs-day/run_unemployment_rate.sh
#
# Does, in order:
#   1. Force-refresh unrate_bls from the BLS API (data/fetch.R --refresh)
#      -> src/data/unrate_bls.json
#   2. Render specs/jobs-day/unemployment-rate.json -> out/jobs-day/YYYY-MM-DD-jobs-day-unrate.mp4
#
# No scrape step -- unrate_bls comes straight from the BLS API (see
# data/series.json's "bls" source), not the CES revisions table. Needs
# BLS_KEY in the environment (R picks it up from ~/.Renviron).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── refreshing unrate_bls from BLS ──────────────────────────────────────"
Rscript data/fetch.R --refresh unrate_bls

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3 -- Remotion's bundler needs
# a literal import graph, so this can't be automated away).
if ! grep -q "unrate_bls" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about unrate_bls yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block, after `import recessions from "./recessions.json";`:
    import unrateBls from "./unrate_bls.json";

  In the SERIES_DATA map, after `recessions: recessions as DataRow[],`:
    unrate_bls: unrateBls as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering unemployment-rate.json ────────────────────────────────────"
./make.sh specs/jobs-day/unemployment-rate.json

echo
echo "Done. Vintage-check the print above before recording."
