/** Web stub: the native RevenueCat SDK does not run on web, so it is never bundled there (rc-sdk.native.ts loads it). */
import type PurchasesT from 'react-native-purchases';
import type RevenueCatUIT from 'react-native-purchases-ui';
export type RcSdk={Purchases:typeof PurchasesT;RevenueCatUI:typeof RevenueCatUIT};
export function loadRcSdk():RcSdk|null{return null}
