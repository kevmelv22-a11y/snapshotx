import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Redirect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MapScreen from '../map';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {useStaffRoles,type StaffRole} from '../../hooks/useStaffRoles';
import {C} from '../../lib/theme';
import {Button,Hint,Page,Title} from '../../components/UI';

type Report={id:string;reporter_id:string;message_id:string|null;story_id:string|null;reason:string;status:string;created_at:string;review_note:string|null};
type Audit={id:string;action:string;entity_type:string|null;entity_id:string|null;created_at:string};
export default function StaffPanel(){
 const insets=useSafeAreaInsets();
 const {session,ready}=useSession();
 const {roles,loading,isStaff,isAdmin,isOwner,refresh}=useStaffRoles();
 const [reports,setReports]=useState<Report[]>([]),[audit,setAudit]=useState<Audit[]>([]),[notice,setNotice]=useState(''),
 [notes,setNotes]=useState<Record<string,string>>({}),[username,setUsername]=useState(''),[busy,setBusy]=useState(false),[panelOpen,setPanelOpen]=useState(false);
 const load=useCallback(async()=>{
  const {data,error}=await supabase.from('sx_reports').select('id,reporter_id,message_id,story_id,reason,status,created_at,review_note').order('created_at',{ascending:false}).limit(100);
  if(error)setNotice(error.message);else setReports(data||[]);
 },[]);
 useEffect(()=>{if(!isStaff)return;const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[isStaff,load]);
 useEffect(()=>{if(!isAdmin)return;const timer=setTimeout(()=>{
  void supabase.from('audit_logs').select('id,action,entity_type,entity_id,created_at')
   .order('created_at',{ascending:false}).limit(30).then(({data,error})=>{
    if(error)setNotice(error.message);else setAudit(data||[]);
   });
 },0);return()=>clearTimeout(timer)},[isAdmin]);
 async function review(id:string,status:'reviewing'|'resolved'|'dismissed'){
  setBusy(true);
  const {error}=await supabase.rpc('sx_review_report',{p_report_id:id,p_status:status,p_note:notes[id]?.trim()||null});
  setBusy(false);setNotice(error?.message||'Beslissing opgeslagen en gelogd.');
  if(!error){setNotes(previous=>{const next={...previous};delete next[id];return next});await load()}
 }
 async function manage(role:StaffRole,grant:boolean){
  if(!username.trim())return setNotice('Vul eerst een exacte gebruikersnaam in.');
  const {data:person,error:lookupError}=await supabase.from('profiles').select('id,username').eq('username',username.trim()).maybeSingle();
  if(lookupError||!person)return setNotice(lookupError?.message||'Gebruiker niet gevonden.');
  Alert.alert('Bevestig rolwijziging',`${grant?'Geef':'Verwijder'} ${role} voor @${person.username}?`,[
   {text:'Annuleren',style:'cancel'},
   {text:'Bevestig',onPress:async()=>{
    setBusy(true);
    const {error}=await supabase.rpc('sx_manage_staff_role',{p_user_id:person.id,p_role:role,p_grant:grant});
    setBusy(false);setNotice(error?.message||'Rolwijziging gelogd.');
   }}
  ]);
 }
 if(ready&&!session)return <Redirect href="/(auth)/login"/>;
 if(loading)return <Page><Hint>Rollen controleren…</Hint></Page>;
 if(!isStaff)return <Page><Title>Geen toegang</Title><Hint>Alleen aangewezen staffleden kunnen dit paneel openen.</Hint><Button onPress={()=>void refresh()} secondary>Opnieuw controleren</Button></Page>;
 return <View style={s.shell}>
  <MapScreen/>
  <Pressable style={[s.panelLaunch,{top:insets.top+105}]} onPress={()=>setPanelOpen(true)} accessibilityLabel="Snaplion staffpaneel openen"><Ionicons name="shield-checkmark-outline" color={C.yellow} size={22}/><Text style={s.panelLaunchText}>SNAPLION · STAFF</Text><Ionicons name="chevron-up" color="#fff" size={18}/></Pressable>
  <Modal visible={panelOpen} transparent animationType="slide" onRequestClose={()=>setPanelOpen(false)}>
   <View style={s.shade}><View style={[s.sheet,{paddingBottom:Math.max(insets.bottom,18)}]}>
    <View style={s.sheetHeader}><View><Text style={s.panelTitle}>SNAPLION</Text><Text style={s.panelSubtitle}>Intern staffpaneel · {roles.join(', ')}</Text></View><Pressable onPress={()=>setPanelOpen(false)} accessibilityLabel="Staffpaneel sluiten" style={s.close}><Ionicons name="close" color="#fff" size={25}/></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}><Title>Meldingen en beheer</Title>
  <Hint>Jouw rollen: {roles.join(', ')}. Alleen gemelde inhoud; geen algemene toegang tot privéchats.</Hint>
  <Button onPress={()=>void load()} secondary>Ververs meldingen</Button>
  {!!notice&&<Text style={s.notice}>{notice}</Text>}
  <Text style={s.heading}>Moderatie · meldingen</Text>
  {reports.length===0?<Hint>Geen meldingen zichtbaar.</Hint>:reports.map(r=><View key={r.id} style={s.card}>
   <Text style={s.title}>{r.story_id?'Story':'Chatbericht'} · {r.status}</Text>
   <Text style={s.muted}>{new Date(r.created_at).toLocaleString()} · #{r.id.slice(0,8)}</Text>
   <Text style={s.body}>{r.reason}</Text>
   <Text style={s.muted}>Melder: {r.reporter_id.slice(0,8)} · Inhoud-ID: {(r.message_id||r.story_id)?.slice(0,8)}</Text>
   {r.review_note&&<Text style={s.muted}>Notitie: {r.review_note}</Text>}
   {(r.status==='open'||r.status==='reviewing')&&<View>
    <TextInput value={notes[r.id]||''} onChangeText={value=>setNotes(previous=>({...previous,[r.id]:value}))} maxLength={1000} placeholder="Interne notitie (optioneel)" placeholderTextColor={C.muted} style={s.input}/>
    {r.status==='open'&&<Button disabled={busy} onPress={()=>void review(r.id,'reviewing')} secondary>In behandeling</Button>}
    <Button disabled={busy} onPress={()=>void review(r.id,'resolved')}>Afhandelen</Button>
    <Button disabled={busy} onPress={()=>void review(r.id,'dismissed')} secondary>Afwijzen</Button>
   </View>}
  </View>)}
  {isAdmin&&<View style={s.admin}><Text style={s.heading}>Admin · rollenbeheer</Text>
   <Hint>OWNER kan moderator, senior moderator en admin toekennen. ADMIN kan alleen moderator toekennen. Niemand kan zichzelf promoveren.</Hint>
   <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Exacte gebruikersnaam" placeholderTextColor={C.muted} style={s.input}/>
   <Button disabled={busy} onPress={()=>void manage('MODERATOR',true)}>Moderator toevoegen</Button>
   <Button disabled={busy} onPress={()=>void manage('MODERATOR',false)} secondary>Moderator verwijderen</Button>
   {isOwner&&<><Button disabled={busy} onPress={()=>void manage('SENIOR MODERATOR',true)}>Senior moderator toevoegen</Button>
    <Button disabled={busy} onPress={()=>void manage('ADMIN',true)}>Admin toevoegen</Button></>}
   <Text style={s.heading}>Auditlog</Text>
   {audit.length===0?<Hint>Geen auditacties zichtbaar.</Hint>:audit.map(entry=><Text key={entry.id} style={s.muted}>
    {new Date(entry.created_at).toLocaleString()} · {entry.action} · {entry.entity_type||'systeem'} #{entry.entity_id?.slice(0,8)||'–'}
   </Text>)}
  </View>}
  <Hint>Een ban-knop wordt niet getoond zolang een ban niet server-side alle app-toegang afdwingt. Zo ontstaat geen schijnveiligheid.</Hint>
    </ScrollView>
   </View></View>
  </Modal>
 </View>;
}
const s=StyleSheet.create({shell:{flex:1,backgroundColor:C.bg},panelLaunch:{position:'absolute',right:15,borderRadius:22,backgroundColor:'#13141DF2',paddingHorizontal:14,height:44,flexDirection:'row',gap:8,alignItems:'center',borderWidth:1,borderColor:'#FFE43677'},panelLaunchText:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:0.4},shade:{flex:1,justifyContent:'flex-end',backgroundColor:'#0009'},sheet:{height:'82%',backgroundColor:'#15151E',borderTopLeftRadius:24,borderTopRightRadius:24,borderWidth:1,borderColor:'#FFFFFF22',paddingHorizontal:18},sheetHeader:{height:76,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#FFFFFF22'},panelTitle:{color:C.yellow,fontWeight:'900',fontSize:21,letterSpacing:1},panelSubtitle:{color:C.muted,fontSize:12,marginTop:3},close:{width:42,height:42,borderRadius:21,backgroundColor:'#30303E',alignItems:'center',justifyContent:'center'},sheetContent:{paddingBottom:25},heading:{color:C.yellow,fontSize:21,fontWeight:'800',marginTop:22},card:{backgroundColor:C.surface,padding:15,borderRadius:16,marginTop:12,borderWidth:1,borderColor:C.border},title:{color:C.text,fontSize:17,fontWeight:'800'},body:{color:C.text,fontSize:16,marginVertical:9},muted:{color:C.muted,fontSize:12,marginTop:5},notice:{color:C.yellow,marginVertical:10},input:{backgroundColor:C.elevated,color:C.text,padding:12,borderRadius:12,marginTop:12},admin:{marginTop:15}});
