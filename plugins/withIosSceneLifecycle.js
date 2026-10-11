// Opt the iOS app into the UIScene life cycle.
//
// Why: iOS 27 traps at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) when an app has no
// UIApplicationSceneManifest. Expo SDK 57 already ships the scene delegate
// (EXExpoAppSceneDelegate in expo/ios/AppDelegates/ExpoAppSceneDelegate.swift), but the
// prebuild template doesn't enable it. This plugin:
//   1. registers EXExpoAppSceneDelegate in Info.plist (single scene), and
//   2. makes AppDelegate conform to ExpoReactNativeFactoryProvider and stops it from creating
//      its own window / starting React Native, because the scene delegate now does both.
// UIScene exists since iOS 13, so this is safe for the configured deployment target (16.4).
// Both mods are idempotent: running prebuild again (with or without --clean) is a no-op.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';
const SCENE_ROLE = 'UIWindowSceneSessionRoleApplication';
const PROVIDER_PROTOCOL = 'ExpoReactNativeFactoryProvider';
const SCENE_COMMENT =
  '// iOS 27 scene life cycle: EXExpoAppSceneDelegate creates the window and starts React Native.';

// The window/startReactNative block from Expo's SDK 57 AppDelegate.swift template.
const WINDOW_BLOCK =
  /^[ \t]*#if os\(iOS\) \|\| os\(tvOS\)\s*\n[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n[ \t]*factory\.startReactNative\([\s\S]*?\)\s*\n[ \t]*#endif[ \t]*$/m;
const CLASS_DECL = /^(\s*class AppDelegate:\s*ExpoAppDelegate)([^{]*)\{/m;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const manifest = plist.UIApplicationSceneManifest ?? {};
    if (manifest.UIApplicationSupportsMultipleScenes === undefined) {
      manifest.UIApplicationSupportsMultipleScenes = false;
    }
    const configurations = manifest.UISceneConfigurations ?? {};
    const roleConfigs = Array.isArray(configurations[SCENE_ROLE]) ? configurations[SCENE_ROLE] : [];
    const existing = roleConfigs.find((c) => c && c.UISceneDelegateClassName === SCENE_DELEGATE_CLASS);
    if (!existing) {
      roleConfigs.unshift({
        UISceneConfigurationName: 'Default Configuration',
        UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
      });
    }
    configurations[SCENE_ROLE] = roleConfigs;
    manifest.UISceneConfigurations = configurations;
    plist.UIApplicationSceneManifest = manifest;
    return cfg;
  });
}

function patchAppDelegate(contents) {
  let out = contents;

  // 1. Conform to ExpoReactNativeFactoryProvider (the scene delegate reads the factory from it).
  const decl = out.match(CLASS_DECL);
  if (!decl) {
    throw new Error('[withIosSceneLifecycle] Could not find `class AppDelegate: ExpoAppDelegate` in AppDelegate.swift.');
  }
  if (!decl[2].includes(PROVIDER_PROTOCOL)) {
    out = out.replace(CLASS_DECL, (_m, head, rest) => `${head}, ${PROVIDER_PROTOCOL}${rest}{`);
  }

  // 2. Drop the app delegate's own window + startReactNative; otherwise React Native would be
  //    started twice (once here, once in the scene delegate).
  if (!out.includes(SCENE_COMMENT)) {
    if (!WINDOW_BLOCK.test(out)) {
      throw new Error(
        '[withIosSceneLifecycle] Could not find the window/startReactNative block in AppDelegate.swift; ' +
          'the Expo template changed, update plugins/withIosSceneLifecycle.js.'
      );
    }
    out = out.replace(WINDOW_BLOCK, `    ${SCENE_COMMENT}`);
  }
  return out;
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('[withIosSceneLifecycle] Only a Swift AppDelegate is supported.');
    }
    cfg.modResults.contents = patchAppDelegate(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
module.exports.patchAppDelegate = patchAppDelegate;
