import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,router} from 'expo-router';
import {C} from '../lib/theme';
import {entitlementLabel} from '../lib/plus';
import {AppIconPicker,Locked} from '../components/plus/PlusParts';
import {useNow} from '../hooks/useNow';
import {usePlusStore,useIsPlus} from '../stores/plus';

/** X+ perks overview. Changing the real home-screen icon needs a native alternate-icons config plugin (dev build); here the choice is stored only. */
export default function PlusSettings(){
  const plus=useIsPlus();const now=useNow();const st=usePlusStore();
  return <ScrollView contentContainerStyle={s.c}><Stack.Screen options={{title:'Snapshot X+-instellingen'}}/>
    <Text style={s.status}>{entitlementLabel(st.entitlements[0],now)}</Text>
    {!plus&&<Locked onUpgrade={()=>router.push('/plus')}/>}
    <Pressable onPress={()=>router.push('/plus-manage')}><Text style={s.link}>Abonnement beheren of opzeggen</Text></Pressable>
    <Text style={s.h}>App-icoon</Text><AppIconPicker value={st.appIcon} plus={plus} onChange={st.setAppIcon}/>
    <Text style={s.note}>Het icoon op je beginscherm verandert pas in de volgende app-versie.</Text>
    <Text style={s.h}>Chat-achtergronden</Text><Text style={s.note}>Kies een achtergrond via het menu in een chat.</Text>
    <Text style={s.h}>Vaste #1 beste vriend</Text><Text style={s.note}>{st.bffPinId?'Je hebt een vriend vastgepind.':'Pin een vriend vanuit je vriendenlijst.'}</Text>
    <View style={{height:30}}/></ScrollView>;
}
const s=StyleSheet.create({c:{padding:18,gap:10},status:{color:C.yellow,fontWeight:'800',fontSize:16},h:{color:C.text,fontWeight:'800',fontSize:17,marginTop:12},note:{color:C.muted,fontSize:13},link:{color:C.blue,fontWeight:'700'}});
