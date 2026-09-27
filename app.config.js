module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier:
      process.env.SNAPSHOTX_IOS_ADHOC_BUNDLE_ID || config.ios.bundleIdentifier,
  },
});
