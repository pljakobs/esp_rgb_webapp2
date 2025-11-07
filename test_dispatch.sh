#!/bin/bash

# You need to provide your token as an environment variable
# Usage: TOKEN=ghp_your_token_here ./test_dispatch.sh
# Or: export TOKEN=ghp_your_token_here && ./test_dispatch.sh

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN environment variable not set"
  echo "Usage: TOKEN=ghp_your_token_here ./test_dispatch.sh"
  echo ""
  echo "To get your token:"
  echo "1. Go to https://github.com/settings/tokens"
  echo "2. Click on 'webapp build token'"
  echo "3. Copy the token value (or regenerate if needed)"
  echo "4. Run: TOKEN=your_token_here ./test_dispatch.sh"
  exit 1
fi

echo "Testing repository_dispatch API call..."
echo ""

curl -v -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/pljakobs/esp_rgbww_firmware/dispatches \
  -d '{"event_type":"frontend-build-completed","client_payload":{"branch":"develop","webapp_branch":"devel","run_id":"test123"}}'

echo ""
echo "Exit code: $?"
