#!/usr/bin/env bash
# The one entry point for turning a JSON file into a video.
#
#   ./make.sh <spec.json>                render one LineVideo spec, or a
#                                         `"type": "sequence"` spec that
#                                         stitches several clips into one
#   ./make.sh <cards.json> <out-prefix>  render every rip-card / list-reveal
#                                         step in a cards file (unchanged
#                                         from Phase 4 -- render-cards.sh and
#                                         render-list-cards.sh both folded
#                                         into this)
#
# The spec path validates the spec (scripts/validate-spec.mjs), prints each
# referenced series' fetch vintage and warns if any are more than 7 days old
# (data/fetch.R's own staleness threshold), then renders to
# out/YYYY-MM-DD-<id>.mp4 -- the date is when this ran, not a data date, so
# re-rendering the same spec next month after a fetch --refresh produces a
# new dated file instead of silently overwriting the one you might have
# already posted. A spec living in a release subfolder of specs/ (e.g.
# specs/jobs-day/foo.json) renders into the matching out/ subfolder instead
# (out/jobs-day/YYYY-MM-DD-foo.mp4) -- see dated_out_path. A top-level spec
# (specs/foo.json) still renders flat into out/, unchanged.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# ── series freshness ──────────────────────────────────────────────────────

# Every series ref a spec touches -- its own series[], plus "recessions" if
# the annotations shorthand is used, plus (for a sequence) every step's own
# spec file. Cards steps (inline ListReveal/RipCardReveal props) have no
# series ref of their own and are skipped.
spec_refs() {
  local f="$1"
  jq -r '.series[]?.ref // empty' "$f"
  jq -r '.categories[]?.ref // empty' "$f"
  if jq -e '(.annotations // []) | index("recessions")' "$f" >/dev/null 2>&1; then
    echo "recessions"
  fi
}

all_spec_refs() {
  local f="$1"
  if [[ "$(jq -r '.type // empty' "$f")" == "sequence" ]]; then
    local dir
    dir="$(dirname "$f")"
    local n
    n=$(jq '.steps | length' "$f")
    for ((i = 0; i < n; i++)); do
      local stepspec
      stepspec=$(jq -r ".steps[$i].spec // empty" "$f")
      [[ -n "$stepspec" ]] && spec_refs "$dir/$stepspec"
    done
  else
    spec_refs "$f"
  fi
}

# Prints the vintage line for one series and warns (does not fail) past 7
# days old -- matches data/fetch.R's own staleness window, so "is this
# stale" means the same thing whether you're fetching or rendering.
check_freshness() {
  local ref="$1"
  local meta="src/data/${ref}.meta.json"
  if [[ ! -f "$meta" ]]; then
    echo "  WARN ${ref}: no ${meta} -- has it been fetched? (Rscript data/fetch.R ${ref})" >&2
    return
  fi
  local fetched_at last_date fetched_epoch now_epoch age_days
  fetched_at=$(jq -r '.fetched_at' "$meta")
  last_date=$(jq -r '.last_date' "$meta")
  fetched_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$fetched_at" "+%s" 2>/dev/null) \
    || fetched_epoch=$(date -d "$fetched_at" "+%s" 2>/dev/null) \
    || fetched_epoch=0
  now_epoch=$(date "+%s")
  age_days=$(((now_epoch - fetched_epoch) / 86400))
  echo "  ${ref}: fetched ${fetched_at} (${age_days}d ago), data through ${last_date}"
  if ((age_days > 7)); then
    echo "  WARN ${ref}: ${age_days} days old -- consider: Rscript data/fetch.R --refresh ${ref}" >&2
  fi
}

# ── single-spec / sequence rendering ──────────────────────────────────────

# Nests under out/<release>/ when spec_file lives in a release subfolder of
# specs/ (specs/jobs-day/foo.json -> out/jobs-day/...), so each data-release
# day's videos land grouped together instead of flat alongside every other
# spec's output; a top-level spec (specs/foo.json) stays flat in out/,
# unchanged. Derived from the spec's own path, not a per-spec setting, so a
# new specs/<release>/ folder gets this for free.
dated_out_path() {
  local id="$1"
  local spec_file="$2"
  local rel_dir
  rel_dir="$(dirname "$spec_file")"
  if [[ "$rel_dir" == specs/* ]]; then
    echo "out/${rel_dir#specs/}/$(date +%Y-%m-%d)-${id}.mp4"
  else
    echo "out/$(date +%Y-%m-%d)-${id}.mp4"
  fi
}

render_spec() {
  local spec_file="$1"
  local id out composition
  id=$(jq -r '.id' "$spec_file")
  out=$(dated_out_path "$id" "$spec_file")
  local spec_type
  spec_type=$(jq -r '.type // empty' "$spec_file")
  if [[ "$spec_type" == "bar" ]]; then
    composition="BarVideo"
  elif [[ "$spec_type" == "category-bar" ]]; then
    composition="CategoryBarVideo"
  else
    composition="LineVideo"
  fi
  mkdir -p "$(dirname "$out")"
  echo "Rendering ${id} (${composition}) -> ${out}"
  npx remotion render src/index.ts "$composition" "$out" --props="$spec_file"
}

render_sequence() {
  local seq_file="$1"
  local id dir tmp concat_list n out
  id=$(jq -r '.id' "$seq_file")
  dir=$(dirname "$seq_file")
  tmp=$(mktemp -d)
  concat_list="$tmp/concat.txt"
  : >"$concat_list"

  n=$(jq '.steps | length' "$seq_file")
  for ((i = 0; i < n; i++)); do
    local step composition clip
    step=$(jq -c ".steps[$i]" "$seq_file")
    composition=$(jq -r '.composition' <<<"$step")
    clip="$tmp/step-$i.mp4"
    if jq -e '.spec' <<<"$step" >/dev/null 2>&1; then
      local stepspec
      stepspec=$(jq -r '.spec' <<<"$step")
      echo "Rendering sequence step $i (${composition}, ${stepspec}) -> ${clip}"
      npx remotion render src/index.ts "$composition" "$clip" --props="$dir/$stepspec"
    else
      local props
      props=$(jq -c '.props' <<<"$step")
      echo "Rendering sequence step $i (${composition}, inline props) -> ${clip}"
      npx remotion render src/index.ts "$composition" "$clip" --props="$props"
    fi
    echo "file '$clip'" >>"$concat_list"
  done

  out=$(dated_out_path "$id" "$seq_file")
  mkdir -p "$(dirname "$out")"
  echo "Stitching ${n} clips -> ${out}"
  ffmpeg -y -v error -f concat -safe 0 -i "$concat_list" -c copy "$out"
  rm -rf "$tmp"
  echo "Wrote ${out}"
}

make_spec() {
  local spec_file="$1"

  echo "Validating ${spec_file}..."
  node scripts/validate-spec.mjs "$spec_file"

  echo "Checking data freshness..."
  local refs
  refs=$(all_spec_refs "$spec_file" | sort -u)
  if [[ -z "$refs" ]]; then
    echo "  (no series refs -- nothing to check)"
  else
    while IFS= read -r ref; do check_freshness "$ref"; done <<<"$refs"
  fi

  if [[ "$(jq -r '.type // empty' "$spec_file")" == "sequence" ]]; then
    render_sequence "$spec_file"
  else
    render_spec "$spec_file"
  fi
}

# ── cards (Phase 4, unchanged) ────────────────────────────────────────────

make_cards() {
  local data_file="$1"
  local out_prefix="$2"
  mkdir -p "$(dirname "$out_prefix")"

  jq -c '.[]' "$data_file" | while IFS= read -r card; do
    if jq -e 'has("items")' <<<"$card" >/dev/null; then
      local active text slug out
      active=$(jq -r '.activeIndex' <<<"$card")
      text=$(jq -r '.items[.activeIndex]' <<<"$card")
      slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
      out="${out_prefix}-$((active + 1))-${slug}.mp4"
      echo "Rendering list step $((active + 1)) ('$text') -> $out"
      npx remotion render src/index.ts ListReveal "$out" --props="$card"
    else
      local text slug out
      text=$(jq -r '.text' <<<"$card")
      slug=$(tr '[:upper:]' '[:lower:]' <<<"$text" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
      out="${out_prefix}-${slug}.mp4"
      echo "Rendering rip-card '$text' -> $out"
      npx remotion render src/index.ts RipCardReveal "$out" --props="$card"
    fi
  done
}

main() {
  if [[ $# -eq 2 ]]; then
    make_cards "$1" "$2"
  elif [[ $# -eq 1 ]]; then
    make_spec "$1"
  else
    cat >&2 <<'USAGE'
Usage:
  ./make.sh <spec.json>                render one LineVideo spec or a sequence
  ./make.sh <cards.json> <out-prefix>  render every rip-card / list-reveal step
USAGE
    exit 1
  fi
}

main "$@"
