#!/usr/bin/env bash
# Creates the debug and release signing keys used by local builds.
# Both live in android/keystore/ and are gitignored.
#
# WARNING: regenerating release.jks changes the app's signing identity.
# Existing installs then need an uninstall before updating, and the release
# SHA-1 in Firebase changes. Only run this again if the keys are lost.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p android/keystore

if [ ! -f android/keystore/debug.keystore ]; then
  keytool -genkeypair -v \
    -keystore android/keystore/debug.keystore \
    -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US"
fi

if [ ! -f android/keystore/release.jks ]; then
  password="$(openssl rand -hex 24)"
  keytool -genkeypair -v \
    -keystore android/keystore/release.jks \
    -storepass "$password" -keypass "$password" \
    -alias decisionjournal -keyalg RSA -keysize 4096 -validity 10000 \
    -dname "CN=Decision Journal,O=Personal,C=DE"

  {
    echo "storeFile=keystore/release.jks"
    echo "storePassword=$password"
    echo "keyAlias=decisionjournal"
    echo "keyPassword=$password"
  } > android/keystore.properties
  chmod 600 android/keystore.properties
fi

printf 'debug   '
keytool -list -v -keystore android/keystore/debug.keystore \
  -alias androiddebugkey -storepass android 2>/dev/null | grep -m1 'SHA1:'

printf 'release '
keytool -list -v -keystore android/keystore/release.jks \
  -alias decisionjournal \
  -storepass "$(grep '^storePassword=' android/keystore.properties | cut -d= -f2-)" \
  2>/dev/null | grep -m1 'SHA1:'

echo
echo "Register both fingerprints (as SHA-1) in Firebase console → Project settings →"
echo "Your apps → Android com.modi.decisionjournal → Add fingerprint."
