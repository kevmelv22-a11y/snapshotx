import React,{useState} from 'react';
import {ScrollView,StyleSheet,Text,TextInput} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '../lib/supabase';
import {Button,Hint,Page,Title} from '../components/UI';
import {C} from '../lib/theme';
import {useConfirmDialog} from '../components/ConfirmDialog';

import {friendlyError} from '../lib/db-errors';
export default function DeleteAccount(){
 const dialog=useConfirmDialog();
 const [confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function erase(){setBusy(true);setNotice('');try{
  const {data,error}=await supabase.functions.invoke('delete-account',{body:{confirmation:'VERWIJDER'}});
  if(error||!(data as {deleted?:boolean}|null)?.deleted)throw new Error('Verwijderen is niet afgerond. Probeer het opnieuw.');
  await supabase.auth.signOut({scope:'local'});
  router.replace('/(auth)/login');
 }catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 function confirm(){dialog.ask({title:'Account definitief verwijderen?',message:'Je profiel, berichten, verhalen en opgeslagen media worden verwijderd. Dit kan niet ongedaan worden gemaakt.',confirmLabel:'Definitief verwijderen',destructive:true},async()=>{await erase();return null})}
 return <Page><ScrollView><Title>Account verwijderen</Title><Hint>Je account en persoonlijke inhoud worden definitief verwijderd. Berichten en verhalen die je hebt gemaakt verdwijnen ook voor anderen. Dit kan niet ongedaan worden gemaakt.</Hint><Text style={s.label}>Typ VERWIJDER om door te gaan</Text><TextInput style={s.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="VERWIJDER" placeholderTextColor={C.muted}/>{!!notice&&<Text style={s.error}>{notice}</Text>}<Button disabled={busy||confirmation.trim()!=='VERWIJDER'} onPress={confirm}>Mijn account definitief verwijderen</Button><Button secondary onPress={()=>router.back()}>Annuleren</Button></ScrollView>{dialog.dialog}</Page>
}
const s=StyleSheet.create({label:{color:C.text,fontSize:16,fontWeight:'700',marginTop:24},input:{backgroundColor:C.surface,color:C.text,padding:16,borderRadius:16,marginVertical:12},error:{color:C.danger,marginVertical:12}});
