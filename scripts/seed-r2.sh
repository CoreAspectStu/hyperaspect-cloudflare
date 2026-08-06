#!/usr/bin/env bash
# Seed the hyperaspect-templates R2 bucket from the local templates/ dir.
# Uploads templates/<id>/{template.json,index.html} → R2 key templates/<id>/<file>,
# mirroring the on-disk layout the FsTemplateStore reads in dev.
#
# Usage:
#   ./scripts/seed-r2.sh            # seed PROD (remote) R2  (--remote)
#   ./scripts/seed-r2.sh --local    # seed the local wrangler-dev (Miniflare) R2
#
# Note: wrangler 4.x defaults `r2 object put` to LOCAL, so prod explicitly passes --remote.
set -euo pipefail

LOC="--remote"
if [ "${1:-}" = "--local" ]; then
  LOC="--local"
  echo "Seeding LOCAL (wrangler dev) R2…"
else
  echo "Seeding PROD (remote) R2…"
fi

BUCKET="hyperaspect-templates"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for dir in "$ROOT"/templates/*/; do
  [ -d "$dir" ] || continue
  id="$(basename "$dir")"
  for fname in template.json index.html; do
    f="$dir$fname"
    [ -f "$f" ] || continue
    key="templates/$id/$fname"
    echo "→ $BUCKET/$key  ($f)"
    wrangler r2 object put "$BUCKET/$key" --file "$f" $LOC
  done
done

echo "Done."
