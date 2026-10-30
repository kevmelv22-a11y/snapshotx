import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import type {CustomerInfo,PurchasesOffering,PurchasesPackage} from 'react-native-purchases';
import {useSession} from './useSession';
import {usePlusStore,useIsPlus} from '../stores/plus';
import {RC_ENABLED,configureRevenueCat,hasProEntitlement,rcAddListener,rcCustomerInfo,rcLogIn,rcLogOut,rcOfferings,rcPresentCustomerCenter,rcPresentPaywallIfNeeded,rcPurchase,rcRestore,rcToEntitlements,type PlanKey,type RcResult} from '../lib/revenuecat';

type Ctx={enabled:boolean;customerInfo:CustomerInfo|null;isPro:boolean;offering:PurchasesOffering|null;packages:Partial<Record<PlanKey,PurchasesPackage>>;error:string|null;
  refreshOfferings:()=>Promise<void>;purchase:(p:PurchasesPackage)=>Promise<RcResult>;restore:()=>Promise<RcResult>;presentPaywallIfNeeded:()=>Promise<boolean>;presentCustomerCenter:()=>Promise<boolean>};
const SubscriptionContext=createContext<Ctx|null>(null);
// Configure once at app start (module load of the root layout).
configureRevenueCat();

export function SubscriptionProvider({children}:{children:React.ReactNode}){
  const {session}=useSession(),uid=session?.user.id??null;
  const [customerInfo,setInfo]=useState<CustomerInfo|null>(null),[offering,setOffering]=useState<PurchasesOffering|null>(null);
  const [packages,setPackages]=useState<Partial<Record<PlanKey,PurchasesPackage>>>({}),[error,setError]=useState<string|null>(null);
  const apply=useCallback((i:CustomerInfo|null)=>{setInfo(i);if(RC_ENABLED&&i)usePlusStore.getState().setEntitlements(rcToEntitlements(i))},[]);
  useEffect(()=>RC_ENABLED?rcAddListener(apply):undefined,[apply]);
  useEffect(()=>{if(!RC_ENABLED)return;let on=true;void (async()=>{try{const i=uid?await rcLogIn(uid):(await rcLogOut())??await rcCustomerInfo();if(on)apply(i)}catch(e){console.warn('[revenuecat] identify',e)}})();return()=>{on=false}},[uid,apply]);
  const refreshOfferings=useCallback(async()=>{if(!RC_ENABLED)return;try{const o=await rcOfferings();setOffering(o.current);setPackages(o.packages);setError(null)}catch{setError('Abonnementen konden niet worden geladen. Controleer je verbinding.')}},[]);
  const purchase=useCallback(async(p:PurchasesPackage)=>{const r=await rcPurchase(p);if(r.ok)apply(r.info);else setError(r.message);return r},[apply]);
  const restore=useCallback(async()=>{const r=await rcRestore();if(r.ok)apply(r.info);else setError(r.message);return r},[apply]);
  const value=useMemo<Ctx>(()=>({enabled:RC_ENABLED,customerInfo,isPro:hasProEntitlement(customerInfo),offering,packages,error,refreshOfferings,purchase,restore,
    presentPaywallIfNeeded:rcPresentPaywallIfNeeded,presentCustomerCenter:rcPresentCustomerCenter}),[customerInfo,offering,packages,error,refreshOfferings,purchase,restore]);
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
/** Subscription state. On web / demo mode `enabled` is false and isPro mirrors the mock X+ store. */
export function useSubscription():Ctx{
  const c=useContext(SubscriptionContext),mockPlus=useIsPlus();
  if(!c)throw new Error('useSubscription must be used inside SubscriptionProvider');
  return c.enabled?c:{...c,isPro:mockPlus};
}
