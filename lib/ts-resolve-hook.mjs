// Test-only Node resolve hook: lets `node --test` load app TS modules that import siblings without
// an extension (`import { x } from './geometry'`, as Metro allows) by retrying with `.ts`.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw error;
  }
}
