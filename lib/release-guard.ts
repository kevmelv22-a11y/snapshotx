/**
 * Production builds (App Store, Google Play, snapshot-x.nl) contain no test tools: dev harnesses (app/dev-*.tsx) and the
 * Face Lab diagnostics only open in a dev server (__DEV__) or a local demo build (EXPO_PUBLIC_DEMO_MODE=1). Everywhere else
 * the route redirects to the home screen before the harness mounts (so e.g. the staff mock is never activated).
 */
export type BuildFlags = { dev: boolean; demo: boolean };

export function devToolsAllowed(f: BuildFlags): boolean {
  return f.dev === true || f.demo === true;
}

const DEV_ONLY = /^\/(dev-[a-z0-9-]+|face-lab)(\/|$|\?)/i;

/** True for paths that must never open in a production build (/dev-staff, /dev-plus?scene=…, /face-lab). */
export function isDevOnlyPath(path: string | null | undefined): boolean {
  return typeof path === 'string' && DEV_ONLY.test(path.trim());
}

export type CallScreenMode = 'real' | 'demo' | 'unavailable';

/** Which call screen /call/[id] shows. Release builds never show the scripted demo call (it "answers" by itself):
 *  a real thread id starts a real WebRTC call, anything else is "Gesprek niet beschikbaar". The demo call only exists
 *  in demo builds and dev harnesses (a `state` param or id 'demo'). */
export function callScreenMode(o: { demo: boolean; devTools: boolean; realId: boolean; hasState: boolean }): CallScreenMode {
  if (o.demo) return 'demo';
  if (o.realId && (!o.hasState || !o.devTools)) return 'real';
  return o.devTools ? 'demo' : 'unavailable';
}
