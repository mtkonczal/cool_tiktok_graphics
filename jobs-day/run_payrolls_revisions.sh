#!/usr/bin/env bash
# Standalone: the grouped-bar payrolls-revisions video, nothing else.
#
#   ./jobs-day/run_payrolls_revisions.sh
#
# Does, in order:
#   1. Re-scrape the BLS CES revisions table (jobs-day/scrape_revisions.py)
#      -> jobs-day/data/bls_ces_monthly_revisions.csv
#   2. Force-refresh payrolls_change_1st/_2nd/_3rd (data/fetch.R --refresh)
#      -> src/data/payrolls_change_{1st,2nd,3rd}.json
#   3. Render specs/jobs-day/monthly-job-growth.json (a BarVideo) ->
#      out/jobs-day/YYYY-MM-DD-jobs-day-payrolls.mp4
#
# Needs python3 with pandas/requests (curl_cffi recommended) for the scrape
# step -- see jobs-day/README.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "── scraping BLS CES revisions table ────────────────────────────────────"
python3 jobs-day/scrape_revisions.py

echo
echo "── refreshing payrolls_change_1st/_2nd/_3rd from the scrape ───────────"
Rscript data/fetch.R --refresh payrolls_change_1st payrolls_change_2nd payrolls_change_3rd

# One-time setup check: src/data/registry.ts needs a manual static-import
# line for each new series (CLAUDE.md Section 3 -- Remotion's bundler needs
# a literal import graph, so this can't be automated away).
if ! grep -q "payrolls_change_1st" src/data/registry.ts 2>/dev/null; then
  cat >&2 <<'MSG'

STOP: src/data/registry.ts doesn't know about payrolls_change_1st/_2nd/_3rd yet.
This is a one-time step (CLAUDE.md Section 3) -- add these lines by hand, then re-run:

  In the import block, after `import recessions from "./recessions.json";`:
    import payrollsChange1st from "./payrolls_change_1st.json";
    import payrollsChange2nd from "./payrolls_change_2nd.json";
    import payrollsChange3rd from "./payrolls_change_3rd.json";

  In the SERIES_DATA map, after `recessions: recessions as DataRow[],`:
    payrolls_change_1st: payrollsChange1st as DataRow[],
    payrolls_change_2nd: payrollsChange2nd as DataRow[],
    payrolls_change_3rd: payrollsChange3rd as DataRow[],
MSG
  exit 1
fi

echo
echo "── rendering monthly-job-growth.json ───────────────────────────────────"
./make.sh specs/jobs-day/monthly-job-growth.json

echo
echo "Done. Vintage-check the prints above before recording -- and if a new"
echo "month has printed, bump monthly-job-growth.json's window forward by one"
echo "month (CLAUDE.md Section 12 / jobs-day/README.md: 5 months is the max"
echo "that fits without crowding the value labels)."
