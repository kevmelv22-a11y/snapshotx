import React,{useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Linking,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {ageOn} from '../lib/auth-form';
import {MAX_BIRTHDATE_CHANGES,birthdayCountdownLabel,formatBirthdateNl,isBirthdayToday,readBirthdayMeta,localDay,toInputValue,validateBirthdateChange,zodiacOf,birthdateSaveError} from '../lib/birthday';
import {SUPPORT_MAILTO} from '../lib/legal';
const purple='#AE16C7';

/** Snapchat "Verjaardag": birthdate, age, star sign, countdown, Verjaardagsfeest switch and a limited change. */
export default function Birthday(){
 const {session}=useSession(),insets=useSafeAreaInsets(),meta=(session?.user.user_metadata??{}) as Record<string,unknown>;
 const state=readBirthdayMeta(meta),used=Math.max(0,Math.floor(Number(meta.birthdate_changes)||0));
 const [editing,setEditing]=useState(false),[value,setValue]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
 const [party,setParty]=useState<boolean|null>(null),partyOn=party??state.party;
 async function toggleParty(v:boolean){setParty(v);setNotice('');const {error:e}=await supabase.auth.updateUser({data:{birthday_party:v}});if(e){setParty(!v);setNotice('Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.')}}
 async function save(){
  if(busy)return;const v=validateBirthdateChange(value,state,used);
  if(!v.ok){setError(v.error);return}
  setBusy(true);setError('');setNotice('');
  try{const {error:e}=await supabase.auth.updateUser({data:v.patch});if(e){setNotice(birthdateSaveError(e));return}
   setEditing(false);setValue('');setDone('Je geboortedatum is bijgewerkt.')}
  catch{setNotice('Opslaan lukte niet. Controleer je verbinding en probeer het opnieuw.')}finally{setBusy(false)}
 }
 const b=state.birth,today=b?isBirthdayToday(b):false,z=b?zodiacOf(b):null;
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Verjaardag</Text><View style={{width:27}}/></View>
 <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  {b?<View style={[s.card,today&&s.cardToday]} testID="bd-card"><Text style={s.cake}>{today?'🎉':'🎂'}</Text><Text style={s.date}>{formatBirthdateNl(b)}</Text><Text style={s.meta}>{ageOn(b,localDay())} jaar · {z!.emoji} {z!.name}</Text><View style={s.countdown}><Ionicons name="time-outline" size={16} color="#E7C8F2"/><Text style={s.countdownText} testID="bd-countdown">{birthdayCountdownLabel(b)}</Text></View></View>
   :<View style={s.card} testID="bd-empty"><Text style={s.cake}>🎂</Text><Text style={s.date}>Geen geboortedatum</Text><Text style={s.meta}>Vul je geboortedatum in zodat vrienden je kunnen feliciteren.</Text></View>}
  <View style={s.row}><Ionicons name="balloon-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Verjaardagsfeest</Text><Text style={s.description}>Op je verjaardag staat er een 🎂 naast je naam. Je leeftijd en geboortejaar blijven verborgen.</Text></View><Switch value={partyOn} onValueChange={v=>void toggleParty(v)} trackColor={{true:purple}} accessibilityLabel="Verjaardagsfeest" testID="bd-party"/></View>
  <Text style={s.section}>Geboortedatum</Text>
  {editing?<View><View style={[s.field,!!error&&s.fieldError]}><TextInput value={value} onChangeText={t=>{setValue(t);setError('');setDone('')}} placeholder="DD-MM-JJJJ" placeholderTextColor="#8E879E" keyboardType="numbers-and-punctuation" maxLength={10} autoComplete="birthdate-full" style={s.input} accessibilityLabel="Nieuwe geboortedatum" testID="bd-input" autoFocus/></View>{!!error&&<Text style={s.error} testID="bd-error">{error}</Text>}
   <Text style={s.tip}>Je kunt je geboortedatum nog {state.changesLeft} van de {MAX_BIRTHDATE_CHANGES} keer wijzigen. Je moet minimaal 13 jaar zijn.</Text>
   <View style={s.buttons}><Pressable onPress={()=>{setEditing(false);setValue('');setError('')}} style={[s.btn,s.btnGhost]} accessibilityRole="button"><Text style={s.btnText}>Annuleren</Text></Pressable><Pressable onPress={()=>void save()} disabled={busy||!value} style={[s.btn,{backgroundColor:purple},(busy||!value)&&{opacity:.5}]} accessibilityRole="button" testID="bd-save">{busy?<ActivityIndicator color="white"/>:<Text style={s.btnText}>Opslaan</Text>}</Pressable></View></View>
  :state.changesLeft>0?<Pressable onPress={()=>{setEditing(true);setValue(b?toInputValue(b):'');setDone('')}} style={s.row} accessibilityRole="button" testID="bd-edit"><Ionicons name="calendar-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Geboortedatum wijzigen</Text><Text style={s.description}>Nog {state.changesLeft} van de {MAX_BIRTHDATE_CHANGES} keer mogelijk</Text></View><Ionicons name="chevron-forward" color="#AAA4B4" size={19}/></Pressable>
  :<Pressable onPress={()=>void Linking.openURL(SUPPORT_MAILTO)} style={s.row} accessibilityRole="link"><Ionicons name="mail-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Geboortedatum klopt niet?</Text><Text style={s.description}>Je kunt hem niet meer zelf wijzigen. Neem contact op met support.</Text></View></Pressable>}
  {!!done&&<View style={s.done} testID="bd-done"><Ionicons name="checkmark-circle" size={22} color="#38E0A5"/><Text style={s.doneText}>{done}</Text></View>}
  {!!notice&&<Text style={s.error}>{notice}</Text>}
  <Text style={s.foot}>Je geboortedatum gebruiken we om te controleren of je oud genoeg bent en om accounts van 13–17 jaar extra te beschermen. Anderen zien hem nooit.</Text>
 </ScrollView></KeyboardAvoidingView></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:60},card:{alignItems:'center',backgroundColor:'#2B253CB8',borderRadius:22,paddingVertical:22,paddingHorizontal:16},cardToday:{borderWidth:2,borderColor:'#FFD54A'},cake:{fontSize:46},date:{color:'white',fontSize:22,fontWeight:'800',marginTop:6},meta:{color:'#CFC6DB',fontSize:15,marginTop:5,textAlign:'center'},countdown:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#1A142599',borderRadius:16,paddingVertical:8,paddingHorizontal:12,marginTop:14},countdownText:{color:'#E7C8F2',fontSize:14,fontWeight:'700'},section:{color:'#C9BFD8',fontSize:14,fontWeight:'800',marginTop:22,marginBottom:2,textTransform:'uppercase',letterSpacing:.6},row:{minHeight:68,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:14,backgroundColor:'#1A142599',borderRadius:14,marginTop:12},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:16},description:{color:'#AAA6B5',fontSize:13,marginTop:4},field:{marginTop:12,backgroundColor:'#1A142599',borderRadius:14,paddingHorizontal:14,borderWidth:1,borderColor:'#3A3248'},fieldError:{borderColor:'#FF8A8A'},input:{color:'white',fontSize:17,paddingVertical:14},error:{color:'#FF8A8A',fontSize:13,marginTop:8},tip:{color:'#8E879E',fontSize:12.5,marginTop:8},buttons:{flexDirection:'row',gap:10,marginTop:14},btn:{flex:1,borderRadius:24,paddingVertical:14,alignItems:'center'},btnGhost:{backgroundColor:'#2B253C'},btnText:{color:'white',fontSize:16,fontWeight:'800'},done:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#16352C',borderRadius:14,padding:14,marginTop:14},doneText:{flex:1,color:'#D8F5EA',fontSize:14},foot:{color:'#8E879E',fontSize:12.5,lineHeight:18,marginTop:22}});
