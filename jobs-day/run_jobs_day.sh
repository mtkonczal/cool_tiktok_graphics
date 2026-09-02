#!/usr/bin/env bash
# Convenience wrapper: runs the entire jobs-day suite, back to back.
#
#   ./jobs-day/run_jobs_day.sh
#
# This is just the four standalone scripts below, called in sequence --
# each one also runs fine completely on its own (its own fetch, its own
# registry.ts check, its own render), for whenever you only want one of
# the four:
#
#   ./jobs-day/run_unemployment_rate.sh    -- unemployment rate (LineVideo)
#   ./jobs-day/run_payrolls_revisions.sh   -- 1st/2nd/3rd estimate bars (BarVideo)
#   ./jobs-day/run_total_employment.sh     -- total employment, current change
#                                            (LineVideo + a BarVideo of the
#                                            same series, both from one fetch)
#   ./jobs-day/run_prime_age.sh            -- prime-age employment zoomout +
#                                            employment-vs-participation
#                                            (two LineVideos, one FRED fetch)
#
# Needs BLS_KEY in the environment (for every script except run_prime_age.sh)
# and an already-working R FRED setup (for run_prime_age.sh), plus python3
# with pandas/requests installed (curl_cffi recommended, only for
# run_payrolls_revisions.sh) -- see jobs-day/README.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "═══ 1/4: unemployment rate ═══════════════════════════════════════════"
./jobs-day/run_unemployment_rate.sh

echo
echo "═══ 2/4: payrolls revisions ════════════════════════════════════"
./jobs-day/run_payrolls_revisions.sh

echo
echo "═══ 3/4: total employment ═══════════════════════════════════════════"
./jobs-day/run_total_employment.sh

echo
echo "═══ 4/4: prime-age employment & participation ═════════════════════════"
./jobs-day/run_prime_age.sh

echo
echo "All four done. Vintage-check every print above before recording."
