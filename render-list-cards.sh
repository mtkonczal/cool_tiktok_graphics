#!/usr/bin/env bash
# Render one ListReveal video per entry in a cards JSON file. Each entry is
# a title, the FULL items array, and which index this render wipes in --
# earlier items render already on screen, later ones stay blank until their
# turn. Fixed 1.5s per card.
#
# Usage:
#   ./render-list-cards.sh src/data/cards_full_employment_reasons.json out/full_employment
#
# Produces out/full_employment-1-25-54-employment-rate.mp4,
# out/full_employment-2-unemployment-rate.mp4, etc.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <cards.json> <out-prefix>" >&2
  exit 1
fi

DATA_FILE="$1"
OUT_PREFIX="$2"

mkdir -p "$(dirname "$OUT_PREFIX")"

jq -c '.[]' "$DATA_FILE" | while IFS= read -r card; do
  active=$(jq -r '.activeIndex' <<<"$card")
  text=$(jq -r '.items[.activeIndex]' <<<"$card")
  slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
  out="${OUT_PREFIX}-$((active + 1))-${slug}.mp4"
  echo "Rendering step $((active + 1)) ('$text') -> $out"
  npx remotion render src/index.ts ListReveal "$out" --props="$card"
done
