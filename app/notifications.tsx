import React,{useState} from 'react';
import {ActivityIndicator,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {useNotifyPrefs} from '../hooks/useNotifyPrefs';
import {supabase} from '../lib/supabase';
import {friendlyError} from '../lib/db-errors';
import {NOTIFY_SECTIONS,notifySummary} from '../lib/notification-prefs';
const purple='#AE16C7';

/** Ask iOS/Android for permission and save this device's Expo push token (same flow as before in Instellingen). */
async function registerDevice(uid:string):Promise<string>{
 if(Platform.OS==='web')return 'Pushmeldingen werken in de Snapshot X-app op je telefoon. Je keuzes hier gelden daar ook.';
 const p=await Notifications.requestPermissionsAsync();
 if(p.status!=='granted')throw new Error('Meldingen zijn niet toegestaan op dit toestel. Zet ze aan via Instellingen › Snapshot X › Meldingen op je iPhone.');
 const projectId=Constants.expoConfig?.extra?.eas?.projectId;if(!projectId)throw new Error('EAS projectId ontbreekt.');
 const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});
 const {error}=await supabase.from('sx_push_tokens').upsert({user_id:uid,token});if(error)throw error;
 return 'Dit toestel is geregistreerd voor meldingen.';
}

/** Snapchat "Meldingen": master switch, per-kind switches, device registration. */
export default function NotificationSettings(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets();
 const {prefs,loading,serverReady,error,update}=useNotifyPrefs(uid);
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function register(){if(!uid||busy)return;setBusy(true);setNotice('');try{setNotice(await registerDevice(uid))}catch(e){setNotice(friendlyError(e,'Meldingen'))}finally{setBusy(false)}}
 async function master(v:boolean){await update('enabled',v);if(v)void register()}
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Meldingen</Text><View style={{width:27}}/></View>
 <ScrollView contentContainerStyle={s.content}>
  <View style={s.master}><Ionicons name={prefs.enabled?'notifications':'notifications-off-outline'} size={24} color="#E7C8F2"/><View style={s.rowBody}><Text style={s.masterText}>Meldingen inschakelen</Text><Text style={s.description} testID="notify-summary">{loading?'Laden…':notifySummary(prefs)}</Text></View><Switch value={prefs.enabled} onValueChange={v=>void master(v)} trackColor={{true:purple}} accessibilityLabel="Meldingen inschakelen" testID="notify-enabled"/></View>
  {NOTIFY_SECTIONS.map(sec=><View key={sec.title}><Text style={s.section}>{sec.title}</Text>{sec.options.map(o=><View key={o.key} style={[s.row,!prefs.enabled&&s.off]}><View style={s.rowBody}><Text style={s.rowText}>{o.label}</Text><Text style={s.description}>{o.description}</Text></View><Switch value={prefs.enabled&&prefs[o.key]} disabled={!prefs.enabled} onValueChange={v=>void update(o.key,v)} trackColor={{true:purple}} accessibilityLabel={o.label} testID={`notify-${o.key}`}/></View>)}</View>)}
  <Pressable style={s.row} onPress={()=>void register()} disabled={busy} testID="notify-register"><Ionicons name="phone-portrait-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Toestel registreren</Text><Text style={s.description}>Zorg dat meldingen op deze telefoon binnenkomen</Text></View>{busy?<ActivityIndicator color="white"/>:<Ionicons name="chevron-forward" color="#AAA4B4" size={19}/>}</Pressable>
  {!!error&&<Text style={s.error}>{error}</Text>}
  {!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}
  <Text style={s.foot}>{serverReady?'Je keuzes gelden voor al je toestellen. ':'Je keuzes worden voorlopig op dit toestel bewaard. '}Een melding laat nooit de inhoud van je chats of snaps zien, alleen wie je iets stuurde. Een chat dempen doe je in de chat zelf.</Text>
 </ScrollView></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:55},master:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#2B253CB8',borderRadius:18,padding:15},masterText:{color:'white',fontSize:18,fontWeight:'800'},section:{color:'white',fontSize:18,fontWeight:'800',marginTop:20,marginBottom:8},row:{minHeight:68,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:14,backgroundColor:'#1A142599',borderRadius:14,marginBottom:4},off:{opacity:0.5},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:17},description:{color:'#AAA6B5',fontSize:13,marginTop:4},error:{color:'#FF8A8A',marginTop:12},notice:{backgroundColor:'#322641',borderRadius:14,padding:14,marginTop:16},noticeText:{color:'white'},foot:{color:'#8E879E',fontSize:13,lineHeight:18,marginTop:22}});
