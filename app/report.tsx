import React,{useMemo,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import {C} from '../lib/theme';
import {Button,Hint,Page} from '../components/UI';
import {dbErrorKind,friendlyError} from '../lib/db-errors';
import {ACCOUNT_REPORT_UNAVAILABLE,MAX_DETAIL,reasonsFor,reportError,reportTitle,SELF_HARM_HELP,submitReport,targetFromParams,type ReportReasonId} from '../lib/report-reasons';

/** Snapchat-style report: pick a reason, optional detail, then offer to block the person too. */
export default function ReportScreen(){
 const params=useLocalSearchParams<{message_id?:string;story_id?:string;user_id?:string;name?:string}>();
 const target=useMemo(()=>targetFromParams(params),[params]);
 const blockId=(Array.isArray(params.user_id)?params.user_id[0]:params.user_id)||'';
 const name=(Array.isArray(params.name)?params.name[0]:params.name)||'';
 const {session}=useSession(),me=session?.user.id??'';
 const [reason,setReason]=useState<ReportReasonId|null>(null),[detail,setDetail]=useState('');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[sent,setSent]=useState(false),[blocked,setBlocked]=useState(false);
 const title=reportTitle(target?.kind??'message');
 if(!target)return <Page><Stack.Screen options={{title:'Melden'}}/><Hint>Er is niets om te melden.</Hint></Page>;
 const reasons=reasonsFor(target.kind);
 async function submit(){
  if(!me||!target)return;
  const err=reportError(reason,detail);if(err)return setNotice(err);
  setBusy(true);setNotice('');
  const {error}=await submitReport(row=>supabase.from('sx_reports').insert(row),me,target,reason!,detail);
  setBusy(false);
  if(error)return setNotice((error as {code?:string}).code==='SX_ACCOUNT_REPORT'?ACCOUNT_REPORT_UNAVAILABLE:friendlyError(error,'Melding versturen'));
  setSent(true);
 }
 async function block(){
  if(!me||!blockId||blockId===me)return;
  setBusy(true);
  const {error}=await supabase.from('sx_blocks').insert({blocker_id:me,blocked_id:blockId});
  setBusy(false);
  if(error&&dbErrorKind(error)!=='duplicate')return setNotice(friendlyError(error,'Blokkeren'));
  setBlocked(true);
 }
 if(sent)return <Page><Stack.Screen options={{title}}/><ScrollView contentContainerStyle={s.done} testID="report-sent">
  <View style={s.doneIcon}><Ionicons name="checkmark" size={40} color="#fff"/></View>
  <Text style={s.doneTitle}>Bedankt voor je melding</Text>
  <Text style={s.doneText}>Ons moderatieteam bekijkt dit zo snel mogelijk. Degene die je meldt, ziet niet dat jij het was.</Text>
  {reason==='self_harm'&&<Text style={s.help}>{SELF_HARM_HELP}</Text>}
  {!!blockId&&blockId!==me&&(blocked
   ?<Text style={s.doneText} testID="report-blocked">{name||'Deze gebruiker'} is geblokkeerd. Jullie kunnen elkaar geen berichten of snaps meer sturen.</Text>
   :<Button disabled={busy} onPress={()=>void block()}>{`${name||'Gebruiker'} ook blokkeren`}</Button>)}
  {!!notice&&<Hint>{notice}</Hint>}
  <Button secondary onPress={()=>router.back()}>Klaar</Button>
 </ScrollView></Page>;
 return <Page><Stack.Screen options={{title}}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:40}}>
  <Text style={s.question}>{target.kind==='account'?`Waarom meld je ${name||'dit account'}?`:'Waarom meld je dit?'}</Text>
  <Hint>Je melding is anoniem. Een moderator ziet de reden en {target.kind==='account'?'het account':target.kind==='story'?'de story':'het bericht'} dat je meldt; de rest van je gesprekken blijft privé.</Hint>
  <View style={s.list} accessibilityRole="radiogroup">{reasons.map(r=>{const on=reason===r.id;return <Pressable key={r.id} onPress={()=>{setReason(r.id);setNotice('')}} style={[s.reason,on&&s.reasonOn]} accessibilityRole="radio" accessibilityState={{checked:on}} testID={`report-reason-${r.id}`}>
   <View style={{flex:1}}><Text style={s.reasonText}>{r.label}</Text>{on&&<Text style={s.reasonHint}>{r.hint}</Text>}</View>
   <Ionicons name={on?'radio-button-on':'radio-button-off'} size={22} color={on?C.purpleLight:C.muted}/></Pressable>})}</View>
  {reason==='self_harm'&&<Text style={s.help}>{SELF_HARM_HELP}</Text>}
  {!!reason&&<TextInput style={s.input} multiline value={detail} onChangeText={setDetail} maxLength={MAX_DETAIL} testID="report-detail"
   placeholder={reason==='other'?'Wat is er aan de hand? (verplicht)':'Toelichting (optioneel)'} placeholderTextColor={C.muted}/>}
  {!!notice&&<Text style={s.error}>{notice}</Text>}
  <Button disabled={busy||!session||!reason} onPress={()=>void submit()}>Melding versturen</Button>
 </ScrollView></Page>;
}
const s=StyleSheet.create({
 question:{color:C.text,fontSize:22,fontWeight:'900',marginTop:6,marginBottom:4},
 list:{marginVertical:14,borderRadius:16,overflow:'hidden',backgroundColor:C.surface},
 reason:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,paddingHorizontal:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
 reasonOn:{backgroundColor:'#2A1736'},
 reasonText:{color:C.text,fontSize:16,fontWeight:'700'},
 reasonHint:{color:C.muted,fontSize:13,marginTop:3},
 input:{backgroundColor:C.surface,color:C.text,borderRadius:14,padding:16,minHeight:100,textAlignVertical:'top',marginBottom:14},
 error:{color:C.danger,marginBottom:10},
 help:{color:'#FFE9A8',backgroundColor:'#3A2E10',borderRadius:12,padding:12,marginBottom:14,lineHeight:20},
 done:{alignItems:'stretch',paddingTop:30,gap:14},
 doneIcon:{alignSelf:'center',width:76,height:76,borderRadius:38,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},
 doneTitle:{color:C.text,fontSize:22,fontWeight:'900',textAlign:'center'},
 doneText:{color:C.muted,fontSize:15,textAlign:'center',lineHeight:21},
});
