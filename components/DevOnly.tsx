import React from 'react';
import { Redirect } from 'expo-router';
import { DEMO_MODE } from '../lib/supabase';
import { devToolsAllowed } from '../lib/release-guard';

/** Dev servers and local demo builds only; release builds (stores + snapshot-x.nl) never show test tools. */
export const DEV_TOOLS = devToolsAllowed({ dev: typeof __DEV__ !== 'undefined' && __DEV__, demo: DEMO_MODE });

/** Wraps a dev/test route: in a production build it redirects home before the harness (and its mocks) mounts. */
export function devOnly<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  function DevOnlyRoute(props: P) {
    if (!DEV_TOOLS) return <Redirect href="/" />;
    return <Screen {...props} />;
  }
  DevOnlyRoute.displayName = `DevOnly(${Screen.displayName || Screen.name || 'Screen'})`;
  return DevOnlyRoute;
}
