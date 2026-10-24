import React,{useState} from 'react';
import {Linking,ScrollView} from 'react-native';
import {Stack,router} from 'expo-router';
import {Paywall} from '../components/plus/PlusParts';
import {usePlusStore} from '../stores/plus';
import type {PlanId} from '../lib/plus';

/** Snapshot X+ paywall. Uses the mock purchase provider (no real IAP yet). */
export const TERMS_URL='https://snapshotx.example/voorwaarden', PRIVACY_URL='https://snapshotx.example/privacy';
export default function PlusScreen(){
  const [plan,setPlan]=useState<PlanId>('sx_plus_yearly');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState<string|null>(null);
  const buy=usePlusStore(s=>s.buy),restore=usePlusStore(s=>s.restore);
  return <ScrollView><Stack.Screen options={{title:'Snapshot X+'}}/><Paywall selected={plan} onSelect={setPlan} busy={busy} notice={notice}
    onBuy={async()=>{setBusy(true);const err=await buy(plan);setBusy(false);if(err)setNotice(err);else router.replace('/plus-settings')}}
    onRestore={async()=>setNotice(await restore())} onTerms={()=>void Linking.openURL(TERMS_URL)} onPrivacy={()=>void Linking.openURL(PRIVACY_URL)}/></ScrollView>;
}
