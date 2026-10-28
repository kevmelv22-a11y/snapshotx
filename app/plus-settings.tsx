import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,router} from 'expo-router';
import {C} from '../lib/theme';
import {appIconInfo,entitlementLabel} from '../lib/plus';
import {AppIconBadge,AppIconPicker,Locked} from '../components/plus/PlusParts';
import {useNow} from '../hooks/useNow';
import {useEffectiveAppIcon,usePlusStore,useIsPlus} from '../stores/plus';

/** X+ perks overview. App icon: web favicon swaps at once; iOS/Android via expo-alternate-app-icons (needs a build with the plugin). */
export default function PlusSettings(){
  const plus=useIsPlus();const now=useNow();const st=usePlusStore();const icon=useEffectiveAppIcon();
  return <ScrollView contentContainerStyle={s.c}><Stack.Screen options={{title:'Snapshot X+-instellingen'}}/>
    <Text style={s.status}>{entitlementLabel(st.entitlements[0],now)}</Text>
    {!plus&&<Locked onUpgrade={()=>router.push('/plus')}/>}
    <Pressable onPress={()=>router.push('/plus-manage')}><Text style={s.link}>Abonnement beheren of opzeggen</Text></Pressable>
    <Text style={s.h}>App-icoon</Text>
    <View style={s.cur} testID="app-icon-current"><AppIconBadge id={icon} size={56}/><View style={{flex:1}}><Text style={s.curLabel}>{appIconInfo(icon).label}</Text><Text style={s.note}>{plus?'Huidig icoon':'Standaard is gratis. Andere iconen zijn voor Snapshot X+.'}</Text></View></View>
    <AppIconPicker value={icon} plus={plus} onChange={st.setAppIcon}/>
    <Text style={s.note}>In de web-app verandert het icoon (tabblad en beginscherm-snelkoppeling) meteen. Op iPhone verandert het icoon op je beginscherm vanaf de volgende app-versie.</Text>
    <Text style={s.h}>Chat-achtergronden</Text><Text style={s.note}>Houd een chat in je chatfeed ingedrukt → Chat-achtergrond (of Groepsinfo in een groep). Iedereen in die chat ziet de achtergrond, ook zonder Snapshot X+.</Text>
    <Text style={s.h}>Vaste #1 beste vriend</Text><Text style={s.note}>{st.bffPinId?'Je hebt een vriend vastgepind.':'Pin een vriend vanuit je vriendenlijst.'}</Text>
    <View style={{height:30}}/></ScrollView>;
}
const s=StyleSheet.create({c:{padding:18,gap:10},status:{color:C.yellow,fontWeight:'800',fontSize:16},h:{color:C.text,fontWeight:'800',fontSize:17,marginTop:12},note:{color:C.muted,fontSize:13},link:{color:C.blue,fontWeight:'700'},cur:{flexDirection:'row',gap:12,alignItems:'center',backgroundColor:C.cardBg,borderRadius:14,padding:12},curLabel:{color:C.text,fontWeight:'800',fontSize:16}});
