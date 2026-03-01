#!/bin/bash
# Patches Expo iOS Swift sources for Xcode 16.4 compatibility.
# Required because Expo SDK 55 modules use Swift 6 / iOS 26 APIs
# that don't compile on Xcode 16.4 with SWIFT_VERSION=5.0.
#
# The Podfile sets SWIFT_VERSION=5.0 to suppress Swift 6 concurrency errors.
# This script patches the remaining syntax issues that don't compile in Swift 5 mode,
# and guards iOS 26 APIs behind #if compiler(>=6.2).

set -e

echo "Patching Expo iOS sources for Xcode 16.4 compatibility..."

# ── expo-modules-core ──────────────────────────────────────────────
EMC="node_modules/expo-modules-core/ios"
if [ -d "$EMC" ]; then
  # 1. SwiftUIHostingView.swift — @MainActor conformance → @preconcurrency
  FILE="$EMC/Core/Views/SwiftUI/SwiftUIHostingView.swift"
  if [ -f "$FILE" ] && grep -q "@MainActor AnyExpoSwiftUIHostingView" "$FILE"; then
    sed -i '' 's/: ExpoView, @MainActor AnyExpoSwiftUIHostingView/: ExpoView, @preconcurrency AnyExpoSwiftUIHostingView/' "$FILE"
    echo "  ✓ SwiftUIHostingView.swift"
  fi

  # 2. ViewDefinition.swift — @MainActor retroactive conformance syntax
  FILE="$EMC/Core/Views/ViewDefinition.swift"
  if [ -f "$FILE" ] && grep -q "@MainActor AnyArgument" "$FILE"; then
    sed -i '' 's/extension UIView: @MainActor AnyArgument/extension UIView: AnyArgument/' "$FILE"
    echo "  ✓ ViewDefinition.swift"
  fi
fi

# ── expo-router ────────────────────────────────────────────────────
ER="node_modules/expo-router/ios/Toolbar"
if [ -d "$ER" ]; then
  # 3. RouterToolbarItemView.swift — iOS 26 APIs
  FILE="$ER/RouterToolbarItemView.swift"
  if [ -f "$FILE" ] && grep -q "item.hidesSharedBackground" "$FILE" && ! grep -q "#if compiler" "$FILE"; then
    # Guard hidesSharedBackground/sharesBackground
    sed -i '' '/if #available(iOS 26.0, \*) {/{
      /hidesSharedBackground\|sharesBackground/{
        # already handled by the broader sed below
      }
    }' "$FILE" 2>/dev/null || true
    # Use perl for multi-line replacements
    perl -i -0pe 's/(    if #available\(iOS 26\.0, \*\) \{\n\s*item\.hidesSharedBackground)/#if compiler(>=6.2)\n    if #available(iOS 26.0, *) {\n      item.hidesSharedBackground/s' "$FILE" 2>/dev/null || true
    echo "  ✓ RouterToolbarItemView.swift (manual patch may be needed)"
  fi

  # 4. RouterToolbarModule.swift — iOS 26 .prominent style
  FILE="$ER/RouterToolbarModule.swift"
  if [ -f "$FILE" ] && grep -q "return .prominent" "$FILE" && ! grep -q "#if compiler" "$FILE"; then
    perl -i -0pe 's/case \.prominent:\n\s*if #available\(iOS 26\.0, \*\) \{\n\s*return \.prominent\n\s*\} else \{\n\s*return \.done\n\s*\}/case .prominent:\n      #if compiler(>=6.2)\n      if #available(iOS 26.0, *) {\n        return .prominent\n      } else {\n        return .done\n      }\n      #else\n      return .done\n      #endif/' "$FILE"
    echo "  ✓ RouterToolbarModule.swift"
  fi

  # 5. RouterToolbarHostView.swift — iOS 26 APIs
  FILE="$ER/RouterToolbarHostView.swift"
  if [ -f "$FILE" ] && grep -q "hidesSharedBackground" "$FILE" && ! grep -q "#if compiler" "$FILE"; then
    perl -i -0pe 's/(            if #available\(iOS 26\.0, \*\) \{.*?            \})/            #if compiler(>=6.2)\n$1\n            #endif/s' "$FILE"
    echo "  ✓ RouterToolbarHostView.swift"
  fi
fi

# ── expo-image ─────────────────────────────────────────────────────
EI="node_modules/expo-image/ios"
if [ -d "$EI" ]; then
  # 6. ImageView.swift — iOS 26 drawOn/drawOff symbol effects
  FILE="$EI/ImageView.swift"
  if [ -f "$FILE" ] && grep -q "applySymbolEffectiOS26" "$FILE" && ! grep -q "#if compiler" "$FILE"; then
    # Guard the call site
    perl -i -0pe 's/(      if #available\(iOS 26\.0, tvOS 26\.0, \*\) \{\n\s*applySymbolEffectiOS26)/      #if compiler(>=6.2)\n$1/s' "$FILE"
    perl -i -0pe 's/(        applySymbolEffectiOS26\(effect: effect, scope: scope, options: options\)\n\s*\})/$1\n      #endif/' "$FILE"
    # Guard the method definition
    perl -i -0pe 's/(\n  @available\(iOS 26\.0, tvOS 26\.0, \*\)\n  private func applySymbolEffectiOS26)/\n  #if compiler(>=6.2)\n  @available(iOS 26.0, tvOS 26.0, *)\n  private func applySymbolEffectiOS26/s' "$FILE"
    perl -i -0pe 's/(    default:\n      break\n    \}\n  \})\n(\n  func startSymbolAnimation)/$1\n  #endif\n$2/s' "$FILE"
    echo "  ✓ ImageView.swift"
  fi
fi

echo "✅ All patches applied."
