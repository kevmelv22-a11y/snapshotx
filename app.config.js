/**
 * EAS internal iOS builds can use a dedicated bundle ID whose ad hoc
 * provisioning profile includes the registered test devices. All other
 * profiles keep the public app.json bundle ID.
 *
 * Universal links (snapshot-x.nl/add/<username> opens the app): mirrors lib/universal-links.ts.
 * - iOS associated domains ONLY when SNAPSHOTX_UNIVERSAL_LINKS=1 (eas.json production profile) and never for the
 *   ad hoc bundle: that provisioning profile has no Associated Domains entitlement, so adding it would break signing.
 * - Android verified intent filters for https://snapshot-x.nl/add/* (no signing impact).
 */
const LINK_HOSTS = ['snapshot-x.nl', 'www.snapshot-x.nl'];

module.exports = ({ config }) => {
  const adhoc = process.env.SNAPSHOTX_IOS_ADHOC_BUNDLE_ID;
  const ios = { ...config.ios, bundleIdentifier: adhoc || config.ios?.bundleIdentifier };
  if (!adhoc && process.env.SNAPSHOTX_UNIVERSAL_LINKS === '1') {
    ios.associatedDomains = LINK_HOSTS.map(h => `applinks:${h}`);
  }
  const android = {
    ...config.android,
    intentFilters: [
      ...(config.android?.intentFilters ?? []),
      { action: 'VIEW', autoVerify: true, data: LINK_HOSTS.map(host => ({ scheme: 'https', host, pathPrefix: '/add/' })), category: ['BROWSABLE', 'DEFAULT'] },
    ],
  };
  return { ...config, ios, android };
};
