#!/usr/bin/env bash
# Convenience wrapper: runs the entire jobs-day suite, back to back.
#
#   ./jobs-day/run_jobs_day.sh
#
# This is just the six standalone scripts below, called in sequence --
# each one also runs fine completely on its own (its own fetch, its own
# registry.ts check, its own render), for whenever you only want one of
# the six:
#
#   ./jobs-day/run_unemployment_rate.sh    -- unemployment rate (LineVideo)
#   ./jobs-day/run_payrolls_revisions.sh   -- 1st/2nd/3rd estimate bars (BarVideo)
#   ./jobs-day/run_total_employment.sh     -- total employment, current change
#                                            (LineVideo + a BarVideo of the
#                                            same series, both from one fetch)
#   ./jobs-day/run_prime_age.sh            -- prime-age employment zoomout +
#                                            employment-vs-participation
#                                            (two LineVideos, one FRED fetch)
#   ./jobs-day/run_manufacturing.sh        -- manufacturing employment, level
#                                            zoomout + monthly-change bar
#                                            (LineVideo + BarVideo, one fetch)
#   ./jobs-day/run_gender_split.sh         -- men/women monthly change,
#                                            stacked (one BarVideo)
#
# Needs BLS_KEY in the environment (for every script except run_prime_age.sh)
# and an already-working R FRED setup (for run_prime_age.sh), plus python3
# with pandas/requests installed (curl_cffi recommended, only for
# run_payrolls_revisions.sh) -- see jobs-day/README.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "═══ 1/6: unemployment rate ═══════════════════════════════════════════"
./jobs-day/run_unemployment_rate.sh

echo
echo "═══ 2/6: payrolls revisions ════════════════════════════════════"
./jobs-day/run_payrolls_revisions.sh

echo
echo "═══ 3/6: total employment ═══════════════════════════════════════════"
./jobs-day/run_total_employment.sh

echo
echo "═══ 4/6: prime-age employment & participation ═════════════════════════"
./jobs-day/run_prime_age.sh

echo
echo "═══ 5/6: manufacturing employment ═════════════════════════════════════"
./jobs-day/run_manufacturing.sh

echo
echo "═══ 6/6: men/women monthly change (stacked) ════════════════════════════"
./jobs-day/run_gender_split.sh

echo
echo "All six done. Vintage-check every print above before recording."
