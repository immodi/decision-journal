#!/usr/bin/env bash
# Publishes a signed Android release with GitHub Actions.
#
#   1. uploads the signing secrets, if they are not set yet
#   2. pushes the current main branch
#   3. runs the Android release workflow for the given version and watches it
#
# Usage: ./scripts/publish-release.sh [version]
# Needs the GitHub CLI once: gh auth login
set -euo pipefail

cd "$(dirname "$0")/.."

command -v gh >/dev/null 2>&1 || {
  echo "GitHub CLI is required: https://cli.github.com" >&2
  exit 1
}
gh auth status >/dev/null 2>&1 || {
  echo "Not signed in. Run: gh auth login" >&2
  exit 1
}

if ! gh secret list | grep -q '^ANDROID_KEYSTORE_BASE64'; then
  echo "Signing secrets are missing; uploading them now."
  ./scripts/ci-secrets.sh
fi

version="${1:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"
version="${version#v}"
if [ -z "$version" ]; then
  echo "Usage: ./scripts/publish-release.sh [version]" >&2
  exit 1
fi

git push origin main
gh workflow run android-release.yml --ref main -f "version=$version"

sleep 3
run_id="$(gh run list --workflow android-release.yml --limit 1 \
  --json databaseId --jq '.[0].databaseId')"
gh run watch "$run_id" --exit-status
