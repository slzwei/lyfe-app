#!/bin/bash
# Patches RCTTurboModule.mm to prevent crash-on-launch on iOS 26.
#
# React Native 0.81's performVoidMethodInvocation throws a C++ jsi::JSError
# when an ObjC TurboModule raises an NSException. For async void methods
# dispatched on a background queue, nothing catches the C++ exception and
# the process calls abort().  iOS 26 release-mode optimisations surface
# exceptions that were previously silent on iOS 18.
#
# This patch replaces the `throw` with NSLog so the error is reported
# without crashing the app.
#
# Upstream tracking:
#   https://github.com/facebook/react-native/issues/54859
#   https://github.com/facebook/react-native/issues/53960
#   https://github.com/reactwg/react-native-new-architecture/discussions/276
#
# Safe to remove once React Native is upgraded to 0.83+.

set -e

FILE="node_modules/react-native/ReactCommon/react/nativemodule/core/platform/ios/ReactCommon/RCTTurboModule.mm"

if [ ! -f "$FILE" ]; then
  echo "⚠️  RCTTurboModule.mm not found — skipping patch"
  exit 0
fi

# Check if already patched
if grep -q "iOS 26 TurboModule crash fix" "$FILE"; then
  echo "  ✓ RCTTurboModule.mm — already patched"
  exit 0
fi

# The original code in performVoidMethodInvocation:
#   @try {
#     [inv invokeWithTarget:strongModule];
#   } @catch (NSException *exception) {
#     throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
#   } @finally {
#     [retainedObjectsForInvocation removeAllObjects];
#   }
#
# Replace the throw with NSLog to prevent the unhandled C++ exception on
# background dispatch queues.

python3 - "$FILE" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r') as f:
    src = f.read()

old = '''    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      throw convertNSExceptionToJSError(runtime, exception, std::string{moduleName}, methodNameStr);
    } @finally {
      [retainedObjectsForInvocation removeAllObjects];
    }'''

new = '''    @try {
      [inv invokeWithTarget:strongModule];
    } @catch (NSException *exception) {
      // iOS 26 TurboModule crash fix (RN#54859)
      // Throwing a C++ jsi::JSError from an async void method dispatched on a
      // background queue has no catch handler and calls abort().  Log instead.
      NSLog(@"[RCTTurboModule] Exception in void method %s.%s: %@",
            moduleName, methodNameStr.c_str(), exception);
    } @finally {
      [retainedObjectsForInvocation removeAllObjects];
    }'''

# Only patch inside performVoidMethodInvocation (not performMethodInvocation)
# Find the function boundary
fn_match = re.search(r'void ObjCTurboModule::performVoidMethodInvocation\(', src)
if not fn_match:
    print("⚠️  Could not find performVoidMethodInvocation — skipping patch")
    sys.exit(0)

fn_start = fn_match.start()

# Find the old pattern after the function start
idx = src.find(old, fn_start)
if idx == -1:
    print("⚠️  Could not find target code block in performVoidMethodInvocation — skipping patch")
    sys.exit(0)

patched = src[:idx] + new + src[idx + len(old):]

with open(path, 'w') as f:
    f.write(patched)

print("  ✓ RCTTurboModule.mm — patched performVoidMethodInvocation (iOS 26 crash fix)")
PYEOF
