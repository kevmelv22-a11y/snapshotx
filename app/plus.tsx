import React,{useState} from 'react';
import {Linking,ScrollView,Text,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {Paywall} from '../components/plus/PlusParts';
import {usePlusStore} from '../stores/plus';
import {plansFor,type PlanId,type Tier} from '../lib/plus';
import {RC_ENABLED,purchaseErrorMessage,rcPaywallComponent} from '../lib/revenuecat';
import {useSubscription} from '../hooks/useSubscription';

/** Snapshot X subscriptions paywall (X+, Lens+, Platinum, Gezin, Herinneringen). Uses the mock purchase provider (no real IAP yet). */
export const TERMS_URL='https://snapshotx.example/voorwaarden', PRIVACY_URL='https://snapshotx.example/privacy';
const TIERS:Tier[]=['plus','lens','platinum','family','storage'];
const defaultPlan=(t:Tier):PlanId=>{const p=plansFor(t);return (p.find(x=>x.period==='year')??p[0]).id};
/** Native dev/EAS build: the RevenueCat dashboard paywall (offering 'default'). Web/demo: the mock paywall below. */
const RcPaywall=RC_ENABLED?rcPaywallComponent():null;
export default function PlusScreen(){return RC_ENABLED&&RcPaywall?<RevenueCatPaywallScreen/>:<MockPlusScreen/>}
function RevenueCatPaywallScreen(){
  const sub=useSubscription();const [err,setErr]=useState<string|null>(null);
  const done=()=>router.replace('/plus-manage');
  return <View style={{flex:1}}><Stack.Screen options={{headerShown:false}}/>
    {RcPaywall&&<RcPaywall style={{flex:1}} options={{displayCloseButton:true}} onPurchaseCompleted={done} onRestoreCompleted={({customerInfo})=>{if(customerInfo.entitlements.active.snapshot_x)done();else setErr('Geen eerdere aankopen gevonden')}}
      onPurchaseError={({error})=>setErr(purchaseErrorMessage(error))} onRestoreError={({error})=>setErr(purchaseErrorMessage(error))}
      onDismiss={()=>{if(router.canGoBack())router.back();else router.replace('/settings')}}/>}
    {!!(err??sub.error)&&<Text style={{color:'#FFD400',textAlign:'center',padding:12}}>{err??sub.error}</Text>}</View>;
}
function MockPlusScreen(){
  const q=useLocalSearchParams<{tier?:string}>();const init=(TIERS.includes(q.tier as Tier)?q.tier:'plus') as Tier;
  const [tier,setTier]=useState<Tier>(init);const [plan,setPlan]=useState<PlanId>(defaultPlan(init));const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<string|null>(null);
  const buy=usePlusStore(s=>s.buy),restore=usePlusStore(s=>s.restore),ents=usePlusStore(s=>s.entitlements);
  const current=ents.find(e=>(e.tier==='storage')===(tier==='storage')&&e.status!=='expired')?.productId??null;
  const trial=ents.length===0;
  return <ScrollView><Stack.Screen options={{title:tier==='storage'?'Herinneringen-opslag':'Abonnementen'}}/><Paywall tier={tier} onTier={t=>{setTier(t);setPlan(defaultPlan(t));setNotice(null)}} selected={plan} onSelect={setPlan} busy={busy} notice={notice} trial={trial} current={current}
    onStorage={()=>{setTier('storage');setPlan(defaultPlan('storage'))}}
    onBuy={async()=>{setBusy(true);const err=await buy(plan);setBusy(false);if(err)setNotice(err);else router.replace('/plus-manage')}}
    onRestore={async()=>setNotice(await restore())} onTerms={()=>void Linking.openURL(TERMS_URL)} onPrivacy={()=>void Linking.openURL(PRIVACY_URL)}/></ScrollView>;
}
