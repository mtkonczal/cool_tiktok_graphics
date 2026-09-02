#!/usr/bin/env bash
# Standalone: the two prime-age employment/participation videos, nothing
# else.
#
#   ./jobs-day/run_prime_age.sh
#
# Does, in order:
#   1. Force-refresh prime_epop and prime_lfpr from FRED (data/fetch.R
#      --refresh) -> src/data/prime_epop.json, src/data/prime_lfpr.json
#   2. Render specs/jobs-day/prime-epop-zoomout.json (LineVideo, single
#      series) -> out/jobs-day/YYYY-MM-DD-prime-epop-zoomout.mp4
#   3. Render specs/jobs-day/prime-epop-participation-2025.json (LineVideo,
#      2-series comparison) ->
#      out/jobs-day/YYYY-MM-DD-prime-epop-participation-2025.mp4
#
# Both specs render with "theme": "butter_on_espresso", matching the rest
# of the jobs-day suite. These two series are FRED-sourced (LNS12300060/
# LNS11300060), not BLS-API-sourced like the other jobs-day series -- FRED
# carries the CPS-derived prime-age EPOP/LFPR series from the same monthly
# Employment Situation release, just not via the direct BLS API path the
# other three scripts use. No scrape step. Needs FRED_API_KEY/an R FRED
# setup already working (see data/fetch.R) -- no BLS_KEY needed here.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── refreshing prime_epop, prime_lfpr from FRED ─────────────────────────"
Rscript data/fetch.R --refresh prime_epop prime_lfpr

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3). Both series are already
# registered as of this writing -- this only bites if registry.ts is ever
# reverted.
if ! grep -q "prime_epop:" src/data/registry.ts 2>/dev/null || ! grep -q "prime_lfpr:" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about prime_epop/prime_lfpr yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block:
    import primeEpop from "./prime_epop.json";
    import primeLfpr from "./prime_lfpr.json";

  In the SERIES_DATA map:
    prime_epop: primeEpop as DataRow[],
    prime_lfpr: primeLfpr as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering prime-epop-zoomout.json ───────────────────────────────────"
./make.sh specs/jobs-day/prime-epop-zoomout.json

echo
echo "── rendering prime-epop-participation-2025.json ────────────────────────"
./make.sh specs/jobs-day/prime-epop-participation-2025.json

echo
echo "Done. Vintage-check the print above before recording."
