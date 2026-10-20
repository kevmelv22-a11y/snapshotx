import React,{useState} from 'react';
import {StyleSheet,TextInput} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import {C} from '../lib/theme';
import {Button,Hint,Page,Title} from '../components/UI';

import {friendlyError} from '../lib/db-errors';
export default function ReportScreen(){
 const {message_id,story_id}=useLocalSearchParams<{message_id?:string;story_id?:string}>();
 const {session}=useSession();
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function submit(){
  if(!session||(!message_id&&!story_id))return;
  if(reason.trim().length<10)return setNotice('Beschrijf in minstens 10 tekens waarom je dit meldt.');
  setBusy(true);
  const {error}=await supabase.from('sx_reports').insert({reporter_id:session.user.id,
   message_id:message_id||null,story_id:story_id||null,reason:reason.trim()});
  setBusy(false);
  if(error)setNotice(friendlyError(error));else {setNotice('Melding ontvangen.');router.back()}
 }
 return <Page><Title>Meld inhoud</Title><Hint>Een moderator ziet je reden en welke story of welk bericht je meldt; privégesprekken worden niet volledig geopend.</Hint>
  <TextInput style={s.input} multiline value={reason} onChangeText={setReason} maxLength={1000}
   placeholder="Waarom meld je dit?" placeholderTextColor={C.muted}/>
  <Button disabled={busy||!session} onPress={()=>void submit()}>Melding versturen</Button>
  {!!notice&&<Hint>{notice}</Hint>}
 </Page>;
}
const s=StyleSheet.create({input:{backgroundColor:C.surface,color:C.text,borderRadius:14,padding:16,minHeight:130,textAlignVertical:'top',marginVertical:18}});
