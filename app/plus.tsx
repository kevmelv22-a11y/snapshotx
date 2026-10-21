import React,{useState} from 'react';
import {Linking,ScrollView} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {Paywall} from '../components/plus/PlusParts';
import {usePlusStore} from '../stores/plus';
import {plansFor,type PlanId,type Tier} from '../lib/plus';

/** Snapshot X subscriptions paywall (X+, Lens+, Platinum, Gezin, Herinneringen). Uses the mock purchase provider (no real IAP yet). */
export const TERMS_URL='https://snapshotx.example/voorwaarden', PRIVACY_URL='https://snapshotx.example/privacy';
const TIERS:Tier[]=['plus','lens','platinum','family','storage'];
const defaultPlan=(t:Tier):PlanId=>{const p=plansFor(t);return (p.find(x=>x.period==='year')??p[0]).id};
export default function PlusScreen(){
  const q=useLocalSearchParams<{tier?:string}>();const init=(TIERS.includes(q.tier as Tier)?q.tier:'plus') as Tier;
  const [tier,setTier]=useState<Tier>(init);const [plan,setPlan]=useState<PlanId>(defaultPlan(init));const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<string|null>(null);
  const buy=usePlusStore(s=>s.buy),restore=usePlusStore(s=>s.restore),ents=usePlusStore(s=>s.entitlements);
  const current=ents.find(e=>(e.tier==='storage')===(tier==='storage')&&e.status!=='expired')?.productId??null;
  const trial=ents.length===0;
  return <ScrollView><Stack.Screen options={{title:tier==='storage'?'Herinneringen-opslag':'Snapshot X+'}}/><Paywall tier={tier} onTier={t=>{setTier(t);setPlan(defaultPlan(t));setNotice(null)}} selected={plan} onSelect={setPlan} busy={busy} notice={notice} trial={trial} current={current}
    onStorage={()=>{setTier('storage');setPlan(defaultPlan('storage'))}}
    onBuy={async()=>{setBusy(true);const err=await buy(plan);setBusy(false);if(err)setNotice(err);else router.replace('/plus-manage')}}
    onRestore={async()=>setNotice(await restore())} onTerms={()=>void Linking.openURL(TERMS_URL)} onPrivacy={()=>void Linking.openURL(PRIVACY_URL)}/></ScrollView>;
}
