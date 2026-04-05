#!/usr/bin/env bash
# sync-schemas.sh — pull firmware .cfgdb schemas and update the lock file
# Usage:
#   ./scripts/sync-schemas.sh                   # use current develop HEAD
#   ./scripts/sync-schemas.sh V5.0-648-develop  # use a specific tag or SHA
set -euo pipefail

REPO="pljakobs/esp_rgbww_firmware"
REF="${1:-develop}"
DEST="src/schemas/firmware"
FILES=("app-data.cfgdb" "app-config.cfgdb" "defs.cfgdb")

echo "Fetching schemas from ${REPO}@${REF} ..."

for f in "${FILES[@]}"; do
  url="https://raw.githubusercontent.com/${REPO}/${REF}/${f}"
  echo "  ← ${f}"
  curl -fsSL "${url}" -o "${DEST}/${f}"
done

# Resolve REF to a full SHA
SHA=$(curl -fsSL \
  "https://api.github.com/repos/${REPO}/commits/${REF}" \
  -H "Accept: application/vnd.github+json" \
  | grep '"sha"' | head -1 | sed 's/.*"sha": *"\([^"]*\)".*/\1/')

cat > "${DEST}/schemas.lock.json" <<EOF
{
  "firmware_repo": "${REPO}",
  "firmware_ref": "${REF}",
  "firmware_sha": "${SHA}",
  "synced_at": "$(date -u +%Y-%m-%d)",
  "files": ["app-data.cfgdb", "app-config.cfgdb", "defs.cfgdb"]
}
EOF

echo "✅ Synced from ${REF} (${SHA})"
echo "   Review the diff, then commit:"
echo "   git add ${DEST}/ && git commit -m \"chore: sync firmware schemas to ${REF}\""
