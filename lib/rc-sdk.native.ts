/** Native only: lazily load the RevenueCat SDKs (never bundled on web; see rc-sdk.ts). */
import type {RcSdk} from './rc-sdk';
let cached:RcSdk|null|undefined;
export function loadRcSdk():RcSdk|null{
  if(cached!==undefined)return cached;
  try{cached={Purchases:require('react-native-purchases').default,RevenueCatUI:require('react-native-purchases-ui').default}}catch{cached=null}
  return cached;
}
