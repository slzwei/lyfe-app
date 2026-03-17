/**
 * Expo config plugin that forces SWIFT_VERSION = 5 on all CocoaPods targets
 * to disable Swift 6 strict concurrency errors in third-party pods.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withSwiftConcurrency(config) {
    return withDangerousMod(config, [
        'ios',
        (cfg) => {
            const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
            let podfile = fs.readFileSync(podfilePath, 'utf8');

            const snippet = `
    # [withSwiftConcurrency] Force Swift 5 mode on all pods to suppress
    # Swift 6 strict-concurrency errors (sending closures, Sendable, etc.)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['SWIFT_VERSION'] = '5.0'
        bc.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
      end
    end`;

            if (!podfile.includes('[withSwiftConcurrency]')) {
                // Insert before the final two 'end' statements (post_install + target)
                podfile = podfile.replace(/(react_native_post_install\([\s\S]*?\n\s*\))/, `$1\n${snippet}`);
                fs.writeFileSync(podfilePath, podfile, 'utf8');
            }

            return cfg;
        },
    ]);
}

module.exports = withSwiftConcurrency;
