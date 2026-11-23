#!/usr/bin/env bash
# Uploads the release signing material to GitHub Actions secrets.
# Requires an authenticated GitHub CLI (gh auth login) and the repo to exist.
set -euo pipefail

cd "$(dirname "$0")/.."

KEYSTORE=android/keystore/release.jks
PROPERTIES=android/keystore.properties

if [ ! -f "$KEYSTORE" ] || [ ! -f "$PROPERTIES" ]; then
  echo "Missing signing material. Run scripts/create-keystores.sh first." >&2
  exit 1
fi

store_password="$(grep '^storePassword=' "$PROPERTIES" | cut -d= -f2-)"
key_alias="$(grep '^keyAlias=' "$PROPERTIES" | cut -d= -f2-)"
key_password="$(grep '^keyPassword=' "$PROPERTIES" | cut -d= -f2-)"

base64 -w0 "$KEYSTORE" | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' "$store_password" | gh secret set ANDROID_KEYSTORE_PASSWORD
printf '%s' "$key_alias" | gh secret set ANDROID_KEY_ALIAS
printf '%s' "$key_password" | gh secret set ANDROID_KEY_PASSWORD

echo "Secrets uploaded: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD,"
echo "ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD."
