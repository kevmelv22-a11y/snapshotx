import React,{useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,router} from 'expo-router';
import {C} from '../lib/theme';
import {FREE_STORAGE,entitlementLabel,featuresFor,formatPrice,getPlan,isEntitlementActive,periodLabel,tierInfo,type Entitlement} from '../lib/plus';
import {useNow} from '../hooks/useNow';
import {usePlusStore} from '../stores/plus';
import {TierWordmark} from '../components/plus/TierBrand';
import {isBrandTier} from '../lib/tier-brand';

/** Manage / cancel screen for Snapshot X subscriptions (mock provider). Cancelling turns off auto-renew; access stays until the end date. */
export default function PlusManage(){
  const st=usePlusStore();const now=useNow();const [confirm,setConfirm]=useState<string|null>(null);const [notice,setNotice]=useState<string|null>(null);
  const live=st.entitlements.filter(e=>isEntitlementActive(e,now));
  return <ScrollView contentContainerStyle={s.c}><Stack.Screen options={{title:'Abonnement beheren'}}/>
    {live.length===0&&<View style={s.card}><Text style={s.h}>Geen actief abonnement</Text><Text style={s.m}>Gratis: {FREE_STORAGE} opslag voor Herinneringen.</Text>
      <Pressable style={s.btn} onPress={()=>router.push('/plus')}><Text style={s.btnT}>Bekijk abonnementen</Text></Pressable></View>}
    {live.map(e=><Sub key={e.productId??e.tier} e={e} now={now} confirming={confirm===e.productId} onAsk={()=>setConfirm(e.productId)} onKeep={()=>setConfirm(null)}
      onCancel={async()=>{await st.cancel(e.productId!);setConfirm(null);setNotice(e.status==='trial'?'Proefperiode opgezegd. Er wordt niets afgeschreven.':'Opgezegd. Je houdt toegang tot de einddatum.')}}
      onResume={async()=>{await st.resume(e.productId!);setNotice('Automatisch verlengen staat weer aan.')}}
      onChange={()=>router.push({pathname:'/plus',params:{tier:e.tier}})}/>)}
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    {live.length>0&&<Pressable onPress={()=>router.push('/plus-settings')}><Text style={s.link}>Snapshot X+-instellingen (app-icoon, achtergronden)</Text></Pressable>}
    <Text style={s.fine}>Testversie: aankopen en opzeggingen zijn gesimuleerd. In de echte app beheer je je abonnement via de App Store of Google Play.</Text>
  </ScrollView>;
}
function Sub({e,now,confirming,onAsk,onKeep,onCancel,onResume,onChange}:{e:Entitlement;now:number;confirming:boolean;onAsk:()=>void;onKeep:()=>void;onCancel:()=>void;onResume:()=>void;onChange:()=>void}){
  const t=tierInfo(e.tier),p=e.productId?getPlan(e.productId):undefined,lose=e.tier==='storage'?[]:featuresFor(e.tier);
  return <View style={s.card}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'}}>{isBrandTier(e.tier)?<TierWordmark tier={e.tier} height={44} style={{marginLeft:-6,marginVertical:-6}}/>:<Text style={s.h}>{t.name}</Text>}{e.status==='trial'&&<Text style={s.tag}>Proefperiode</Text>}</View>
    {p&&<Text style={s.m}>{p.title} · {formatPrice(p.priceCents)} {periodLabel(p)}</Text>}
    <Text style={s.status}>{entitlementLabel(e,now)}</Text>
    <Text style={s.m}>Opslag Herinneringen: {t.storage}{t.seats>1?` · ${t.seats} personen`:''}</Text>
    {e.tier!=='storage'&&<Pressable style={s.btn2} onPress={onChange}><Text style={s.btnT2}>Abonnement wijzigen</Text></Pressable>}
    {e.willRenew===false?<Pressable style={s.btn} onPress={onResume}><Text style={s.btnT}>Abonnement hervatten</Text></Pressable>
      :!confirming?<Pressable onPress={onAsk}><Text style={s.danger}>{e.status==='trial'?'Proefperiode opzeggen':'Abonnement opzeggen'}</Text></Pressable>
      :<View style={s.confirm}><Text style={s.h2}>Weet je het zeker?</Text>
        <Text style={s.m}>Na {entitlementLabel(e,now).replace(/^.* op |^Gratis tot /,'').replace(/, daarna betaald$/,'')} verlies je:</Text>
        {lose.map(f=><View key={f.id} style={s.row}><Ionicons name="close-circle" size={16} color={C.pink}/><Text style={s.w}>{f.title}</Text></View>)}
        <View style={s.row}><Ionicons name="close-circle" size={16} color={C.pink}/><Text style={s.w}>Opslag terug naar {FREE_STORAGE}</Text></View>
        <Pressable style={s.btn} onPress={onKeep}><Text style={s.btnT}>Houd {t.name}</Text></Pressable>
        <Pressable onPress={onCancel}><Text style={s.danger}>Toch opzeggen</Text></Pressable></View>}
  </View>;
}
const s=StyleSheet.create({c:{padding:18,gap:12},card:{backgroundColor:'#0B0B10',borderWidth:1,borderColor:'#2B2B38',borderRadius:16,padding:16,gap:8},h:{color:C.text,fontSize:18,fontWeight:'900'},h2:{color:C.text,fontSize:16,fontWeight:'800'},
  m:{color:C.muted,fontSize:13},w:{color:C.text,fontSize:14},status:{color:C.yellow,fontWeight:'800'},tag:{color:C.bg,backgroundColor:C.yellow,borderRadius:8,paddingHorizontal:6,fontSize:11,fontWeight:'800',overflow:'hidden'},
  btn:{backgroundColor:C.yellow,borderRadius:22,paddingVertical:12,alignItems:'center',marginTop:6},btnT:{color:C.bg,fontWeight:'900'},btn2:{borderWidth:1,borderColor:C.border,borderRadius:22,paddingVertical:11,alignItems:'center',marginTop:6},btnT2:{color:C.text,fontWeight:'800'},
  danger:{color:C.pink,fontWeight:'800',textAlign:'center',paddingVertical:10},confirm:{gap:6,borderTopWidth:1,borderTopColor:C.border,paddingTop:10},row:{flexDirection:'row',gap:6,alignItems:'center'},
  notice:{color:C.yellow,textAlign:'center'},link:{color:C.blue,textAlign:'center',fontWeight:'600'},fine:{color:C.muted,fontSize:11,textAlign:'center'}});
