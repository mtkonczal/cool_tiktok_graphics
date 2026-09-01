#!/usr/bin/env bash
# Convenience wrapper: runs the entire jobs-day suite, back to back.
#
#   ./jobs-day/run_jobs_day.sh
#
# This is just the three standalone scripts below, called in sequence --
# each one also runs fine completely on its own (its own fetch, its own
# registry.ts check, its own render), for whenever you only want one of
# the three videos:
#
#   ./jobs-day/run_unemployment_rate.sh    -- unemployment rate (LineVideo)
#   ./jobs-day/run_payrolls_revisions.sh   -- 1st/2nd/3rd estimate bars (BarVideo)
#   ./jobs-day/run_total_employment.sh     -- total employment, current change (LineVideo)
#
# Needs BLS_KEY in the environment and python3 with pandas/requests
# installed (curl_cffi recommended) -- see jobs-day/README.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "═══ 1/3: unemployment rate ═════════════════════════════════════════════"
./jobs-day/run_unemployment_rate.sh

echo
echo "═══ 2/3: payrolls revisions ═══════════════════════════════════════════"
./jobs-day/run_payrolls_revisions.sh

echo
echo "═══ 3/3: total employment ═══════════════════════════════════════════"
./jobs-day/run_total_employment.sh

echo
echo "All three done. Vintage-check every print above before recording."
