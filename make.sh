#!/usr/bin/env bash
# Render every card in a cards JSON file. Detects each entry's shape --
# a rip-card ({text, eyebrow?, holdSeconds?}) or a list-reveal step
# ({title, items, activeIndex}) -- and dispatches to the matching
# composition. Replaces render-cards.sh and render-list-cards.sh, which did
# the same job for exactly one shape each; a cards file only ever has one
# shape throughout, so this still produces exactly what either script did.
#
# Usage:
#   ./make.sh src/data/cards_full_employment_reasons.json out/full_employment
#
# Produces out/full_employment-1-25-54-employment-rate.mp4,
# out/full_employment-2-unemployment-rate.mp4, etc. for list-reveal entries,
# or out/full_employment-<slug>.mp4 for rip-card entries.
#
# Phase 5 folds this into the full make.sh (spec-driven renders too, data
# freshness checks, schema validation, dated output names) -- this is the
# card-only piece of that, per PLAN.md Phase 4.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <cards.json> <out-prefix>" >&2
  exit 1
fi

DATA_FILE="$1"
OUT_PREFIX="$2"

mkdir -p "$(dirname "$OUT_PREFIX")"

jq -c '.[]' "$DATA_FILE" | while IFS= read -r card; do
  if jq -e 'has("items")' <<<"$card" >/dev/null; then
    active=$(jq -r '.activeIndex' <<<"$card")
    text=$(jq -r '.items[.activeIndex]' <<<"$card")
    slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
    out="${OUT_PREFIX}-$((active + 1))-${slug}.mp4"
    echo "Rendering list step $((active + 1)) ('$text') -> $out"
    npx remotion render src/index.ts ListReveal "$out" --props="$card"
  else
    text=$(jq -r '.text' <<<"$card")
    slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
    out="${OUT_PREFIX}-${slug}.mp4"
    echo "Rendering rip-card '$text' -> $out"
    npx remotion render src/index.ts RipCardReveal "$out" --props="$card"
  fi
done
