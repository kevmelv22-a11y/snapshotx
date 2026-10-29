import React,{useEffect,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Switch,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {usePrivacyPrefs} from '../hooks/usePrivacyPrefs';
import {supabase} from '../lib/supabase';
import {friendlyError,isUnavailable} from '../lib/db-errors';
import {privacyFromRow,sharingSummary} from '../lib/map-privacy';
import {CONTACT_CHOICES,STORY_AUDIENCE_CHOICES,type WhoCanChoice} from '../lib/privacy-prefs';
const purple='#AE16C7';

/** Snapchat "Wie kan…": contact, story audience, location and Snel toevoegen in one place. */
export default function WhoCan(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets();
 const {prefs,loading,serverReady,error,update}=usePrivacyPrefs(uid);
 const [findMe,setFindMe]=useState(true),[findMeReady,setFindMeReady]=useState(true),[location,setLocation]=useState<string|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!uid)return;let active=true;void (async()=>{
  const pref=await supabase.from('sx_preferences').select('find_me').eq('user_id',uid).maybeSingle();
  if(!active)return;if(pref.error){setFindMeReady(false);if(!isUnavailable(pref.error))setNotice(friendlyError(pref.error,'Snel toevoegen'))}else setFindMe(pref.data?.find_me??true);
  const loc=await supabase.from('sx_locations').select('sharing,share_audience,ghost_until,ghost_forever').eq('user_id',uid).maybeSingle();
  if(!active)return;if(!loc.error)setLocation(loc.data?sharingSummary(privacyFromRow(loc.data),Date.now()):'Je locatie is verborgen');
 })();return()=>{active=false}},[uid]);
 async function quickAdd(value:boolean){if(!uid||!findMeReady||busy)return;const previous=findMe;setFindMe(value);setBusy(true);const {error:e}=await supabase.from('sx_preferences').upsert({user_id:uid,find_me:value});if(e){setFindMe(previous);setNotice(friendlyError(e,'Snel toevoegen'))}else setNotice(value?'Je kunt weer in Snel toevoegen verschijnen.':'Je verschijnt niet meer in Snel toevoegen.');setBusy(false)}
 const choices=<T extends string>(title:string,key:string,list:WhoCanChoice<T>[],value:T,onPick?:(v:T)=>void)=><View key={key}><Text style={s.section}>{title}</Text><View style={s.card}>{list.map((c,i)=>{const on=c.value===value;return <Pressable key={c.value} onPress={()=>onPick?.(c.value)} disabled={!onPick} style={[s.choice,i>0&&s.divider]} role="radio" aria-checked={on} accessibilityLabel={`${title}: ${c.label}`} testID={`whocan-${key}-${c.value}`}><View style={s.rowBody}><Text style={s.rowText}>{c.label}</Text><Text style={s.description}>{c.description}</Text></View><Ionicons name={on?'checkmark-circle':'ellipse-outline'} size={24} color={on?purple:'#6F6880'}/></Pressable>})}</View></View>;
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Wie kan…</Text><View style={{width:27}}/></View>
 <ScrollView contentContainerStyle={s.content}>
  {choices('Contact met mij opnemen','contact',CONTACT_CHOICES,'friends')}
  <Text style={s.hint}>Alleen vrienden kunnen je chatten, snaps sturen en bellen. Iemand die je niet kent kan je alleen een vriendschapsverzoek sturen.</Text>
  {choices('Mijn verhaal bekijken','story',STORY_AUDIENCE_CHOICES,prefs.story,v=>{void update({story:v});setNotice(v==='everyone'?'Nieuwe verhalen zijn voor iedereen zichtbaar.':'Nieuwe verhalen zijn alleen voor je vrienden.')})}
  <Text style={s.hint}>Geldt voor verhalen die je vanaf nu plaatst. Verhalen die al online staan houden hun publiek.</Text>
  <Text style={s.section}>Mijn locatie zien</Text>
  <Pressable style={s.card} onPress={()=>router.push('/map')} accessibilityLabel="Mijn locatie zien, open de Map" testID="whocan-location"><View style={s.choice}><Ionicons name="location-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Locatie en Ghost mode</Text><Text style={s.description} testID="whocan-location-summary">{location??'Instellen op de Map'}</Text></View><Ionicons name="chevron-forward" color="#AAA4B4" size={19}/></View></Pressable>
  <Text style={s.section}>Mij zien in Snel toevoegen</Text>
  <View style={s.card}><View style={s.choice}><Ionicons name="person-add-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Toon mij in Snel toevoegen</Text><Text style={s.description}>{findMeReady?'Mensen met gemeenschappelijke vrienden kunnen je als suggestie zien.':'Deze privacyinstelling wordt nog klaargezet.'}</Text></View><Switch value={findMe} disabled={!findMeReady||busy} onValueChange={v=>void quickAdd(v)} trackColor={{true:purple}} accessibilityLabel="Toon mij in Snel toevoegen" testID="whocan-quickadd"/></View></View>
  {!!error&&<Text style={s.error}>{error}</Text>}
  {!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText} testID="whocan-notice">{notice}  ×</Text></Pressable>}
  <Text style={s.foot}>{loading?'Laden… ':serverReady?'Je keuzes gelden voor al je toestellen. ':'Je keuzes worden voorlopig op dit toestel bewaard. '}Geblokkeerde accounts kunnen je nooit bereiken of je verhaal zien.</Text>
 </ScrollView></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:55},section:{color:'white',fontSize:18,fontWeight:'800',marginTop:20,marginBottom:8},card:{backgroundColor:'#1A142599',borderRadius:14,overflow:'hidden'},choice:{minHeight:64,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:14},divider:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#4A4258'},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:17},description:{color:'#AAA6B5',fontSize:13,marginTop:4},hint:{color:'#8E879E',fontSize:13,lineHeight:18,marginTop:8},error:{color:'#FF8A8A',marginTop:12},notice:{backgroundColor:'#322641',borderRadius:14,padding:14,marginTop:16},noticeText:{color:'white'},foot:{color:'#8E879E',fontSize:13,lineHeight:18,marginTop:22}});
