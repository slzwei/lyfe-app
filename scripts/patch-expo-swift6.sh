#!/bin/bash
# Patches Expo iOS Swift sources for strict concurrency compatibility.
# Run as postinstall so the patched sources are picked up by expo prebuild / pod install.

set -e

echo "Patching Expo iOS sources for Swift concurrency compatibility..."

# ── expo-image: ContentPosition.swift ──────────────────────────────
# Fix: "static property 'center' is not concurrency-safe because
#       non-'Sendable' type 'ContentPosition' may have shared mutable state"
FILE="node_modules/expo-image/ios/ContentPosition.swift"
if [ -f "$FILE" ] && grep -q "static let center" "$FILE" && ! grep -q "nonisolated" "$FILE"; then
  sed -i.bak 's/static let center/nonisolated(unsafe) static let center/' "$FILE" && rm -f "$FILE.bak"
  echo "  ✓ ContentPosition.swift — added nonisolated(unsafe)"
fi

# ── expo-image: ImageLoadTask.swift ────────────────────────────────
# Fix: "passing closure as a 'sending' parameter risks causing data races"
# Xcode 26 compiles with Swift 6 strict concurrency; mark closure @Sendable
FILE="node_modules/expo-image/ios/ImageLoadTask.swift"
if [ -f "$FILE" ] && grep -q "Task { \[source, options\]" "$FILE" && ! grep -q "@Sendable" "$FILE"; then
  sed -i.bak 's/Task { \[source, options\]/Task { @Sendable [source, options]/' "$FILE" && rm -f "$FILE.bak"
  echo "  ✓ ImageLoadTask.swift — added @Sendable to closure"
fi

echo "✅ All patches applied."
