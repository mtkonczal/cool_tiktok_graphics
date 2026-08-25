#!/usr/bin/env bash
# Render one RipCardReveal video per entry in a cards JSON file.
#
# This is the whole framework for a new topic's set of rip-card labels: write
# a JSON array of {text, eyebrow?, holdSeconds?} objects, run this script,
# get one .mp4 per entry. No new component or Composition needed.
#
# Usage:
#   ./render-cards.sh src/data/cards_full_employment_reasons.json out/full_employment
#
# Produces out/full_employment-25-54-epop.mp4, out/full_employment-unrate.mp4,
# out/full_employment-v-u.mp4, etc.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <cards.json> <out-prefix>" >&2
  exit 1
fi

DATA_FILE="$1"
OUT_PREFIX="$2"

mkdir -p "$(dirname "$OUT_PREFIX")"

jq -c '.[]' "$DATA_FILE" | while IFS= read -r card; do
  text=$(jq -r '.text' <<<"$card")
  slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
  out="${OUT_PREFIX}-${slug}.mp4"
  echo "Rendering '$text' -> $out"
  npx remotion render src/index.ts RipCardReveal "$out" --props="$card"
done
