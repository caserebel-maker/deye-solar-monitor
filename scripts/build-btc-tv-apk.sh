#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/android-btc-tv/app"
OUT="$ROOT/android-btc-tv/build"
DIST="$ROOT/android-btc-tv/dist"
KEYSTORE_DIR="$ROOT/android-btc-tv/keystore"
KEYSTORE="$KEYSTORE_DIR/btc-tv.keystore"
SDK_ROOT="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
BUILD_TOOLS="$SDK_ROOT/build-tools/35.0.0"
ANDROID_JAR="$SDK_ROOT/platforms/android-35/android.jar"
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$BUILD_TOOLS:$SDK_ROOT/platform-tools:$PATH"

rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$DIST" "$KEYSTORE_DIR"

"$BUILD_TOOLS/aapt2" compile --dir "$APP/src/main/res" -o "$OUT/compiled/res.zip"
"$BUILD_TOOLS/aapt2" link \
  -I "$ANDROID_JAR" \
  --manifest "$APP/src/main/AndroidManifest.xml" \
  --java "$OUT/gen" \
  --min-sdk-version 23 \
  --target-sdk-version 35 \
  -o "$OUT/resources.apk" \
  "$OUT/compiled/res.zip"

find "$APP/src/main/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
"$JAVA_HOME/bin/javac" \
  --release 8 \
  -classpath "$ANDROID_JAR" \
  -d "$OUT/classes" \
  @"$OUT/sources.txt"

"$BUILD_TOOLS/d8" \
  --min-api 23 \
  --lib "$ANDROID_JAR" \
  --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

cp "$OUT/resources.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -r "$OUT/unsigned.apk" classes.dex)

if [ ! -f "$KEYSTORE" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=BTC Chart TV, OU=Codex, O=Case Rebel, L=Bangkok, S=Bangkok, C=TH" >/dev/null
fi

"$BUILD_TOOLS/zipalign" -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$DIST/btc-chart-tv.apk" \
  "$OUT/aligned.apk"

"$BUILD_TOOLS/apksigner" verify "$DIST/btc-chart-tv.apk"
echo "$DIST/btc-chart-tv.apk"
