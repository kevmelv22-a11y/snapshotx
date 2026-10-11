/**
 * EAS internal iOS builds can use a dedicated bundle ID whose ad hoc
 * provisioning profile includes the registered test devices. All other
 * profiles keep the public app.json bundle ID.
 */
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    bundleIdentifier:
      process.env.SNAPSHOTX_IOS_ADHOC_BUNDLE_ID || config.ios?.bundleIdentifier,
  },
});
