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
  sed -i '' 's/static let center/nonisolated(unsafe) static let center/' "$FILE"
  echo "  ✓ ContentPosition.swift — added nonisolated(unsafe)"
fi

echo "✅ All patches applied."
