/** RevenueCat service. Active only on iOS/Android dev/EAS builds outside EXPO_PUBLIC_DEMO_MODE; web and demo keep the mock provider. */
import {Platform} from 'react-native';
import type {CustomerInfo,PurchasesOffering,PurchasesPackage} from 'react-native-purchases';
import {DEMO_MODE} from './supabase';
import {loadRcSdk} from './rc-sdk';
import {RC_ENTITLEMENT,mapPackages,purchaseErrorMessage,rcApiKey} from './revenuecat-logic';
export * from './revenuecat-logic';

export const RC_ENABLED=Platform.OS!=='web'&&!DEMO_MODE;
const sdk=()=>RC_ENABLED?loadRcSdk():null;
let configured=false;
/** Call once at app start. */
export function configureRevenueCat():boolean{
  const s=sdk();if(!s)return false;if(configured)return true;
  try{
    if(__DEV__)void s.Purchases.setLogLevel(s.Purchases.LOG_LEVEL.DEBUG);
    s.Purchases.configure({apiKey:rcApiKey(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY)});
    configured=true;
  }catch(e){console.warn('[revenuecat] configure failed',e)}
  return configured;
}
export async function rcLogIn(uid:string){const s=sdk();if(!s||!configured)return null;return (await s.Purchases.logIn(uid)).customerInfo}
export async function rcLogOut(){const s=sdk();if(!s||!configured)return null;
  try{if(await s.Purchases.isAnonymous())return null;return await s.Purchases.logOut()}catch{return null}}
export async function rcCustomerInfo(){const s=sdk();if(!s||!configured)return null;return s.Purchases.getCustomerInfo()}
export function rcAddListener(fn:(i:CustomerInfo)=>void):()=>void{const s=sdk();if(!s||!configured)return()=>{};
  s.Purchases.addCustomerInfoUpdateListener(fn);return()=>{s.Purchases.removeCustomerInfoUpdateListener(fn)}}
export async function rcOfferings():Promise<{current:PurchasesOffering|null;packages:ReturnType<typeof mapPackages<PurchasesPackage>>}>{
  const s=sdk();if(!s||!configured)return{current:null,packages:{}};
  const o=await s.Purchases.getOfferings();return{current:o.current,packages:mapPackages(o.current)};
}
export type RcResult={ok:true;info:CustomerInfo|null}|{ok:false;message:string|null};
const fail=(e:unknown):RcResult=>({ok:false,message:purchaseErrorMessage(e as never)});
export async function rcPurchase(pkg:PurchasesPackage):Promise<RcResult>{const s=sdk();if(!s||!configured)return{ok:false,message:'Aankopen werkt alleen in de app.'};
  try{return{ok:true,info:(await s.Purchases.purchasePackage(pkg)).customerInfo}}catch(e){return fail(e)}}
export async function rcRestore():Promise<RcResult>{const s=sdk();if(!s||!configured)return{ok:false,message:'Herstellen werkt alleen in de app.'};
  try{return{ok:true,info:await s.Purchases.restorePurchases()}}catch(e){return fail(e)}}
/** Shows the dashboard paywall only when `snapshot_x` is not active. Returns true when a purchase/restore happened. */
export async function rcPresentPaywallIfNeeded():Promise<boolean>{const s=sdk();if(!s||!configured)return false;
  try{const r=await s.RevenueCatUI.presentPaywallIfNeeded({requiredEntitlementIdentifier:RC_ENTITLEMENT});return r==='PURCHASED'||r==='RESTORED'}catch(e){console.warn('[revenuecat] paywall',e);return false}}
export async function rcPresentCustomerCenter():Promise<boolean>{const s=sdk();if(!s||!configured)return false;
  try{await s.RevenueCatUI.presentCustomerCenter();return true}catch(e){console.warn('[revenuecat] customer center',e);return false}}
export const rcPaywallComponent=()=>sdk()?.RevenueCatUI.Paywall??null;
