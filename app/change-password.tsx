import React,{useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {passwordChangeError,passwordStrength,reauthCredentials,validatePasswordChange,MAX_PASSWORD_LENGTH} from '../lib/password-change';
const purple='#AE16C7';
type Field='current'|'next'|'repeat';

function PasswordField({label,value,onChange,error,autoComplete,testID}:{label:string;value:string;onChange:(v:string)=>void;error?:string;autoComplete:'current-password'|'new-password';testID:string}){
 const [show,setShow]=useState(false);
 return <View style={s.fieldWrap}><Text style={s.label}>{label}</Text><View style={[s.field,!!error&&s.fieldError]}><TextInput value={value} onChangeText={onChange} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete={autoComplete} textContentType={autoComplete==='current-password'?'password':'newPassword'} maxLength={MAX_PASSWORD_LENGTH+1} style={s.input} placeholder={label} placeholderTextColor="#8E879E" accessibilityLabel={label} testID={testID}/><Pressable onPress={()=>setShow(v=>!v)} accessibilityLabel={show?'Wachtwoord verbergen':'Wachtwoord tonen'} hitSlop={10}><Ionicons name={show?'eye-off-outline':'eye-outline'} size={21} color="#CFC6DA"/></Pressable></View>{!!error&&<Text style={s.error} testID={`${testID}-error`}>{error}</Text>}</View>;
}

/** Snapchat "Wachtwoord": re-check the current password, choose a new one (strength meter), log out other devices. */
export default function ChangePassword(){
 const {session}=useSession(),insets=useSafeAreaInsets(),user=session?.user;
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[repeat,setRepeat]=useState(''),[others,setOthers]=useState(true);
 const [errors,setErrors]=useState<Partial<Record<Field,string>>>({}),[notice,setNotice]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
 const strength=passwordStrength(next);
 const edit=(f:Field,set:(v:string)=>void)=>(v:string)=>{set(v);setErrors(e=>({...e,[f]:undefined}));setNotice('');setDone('')};
 async function save(){
  if(busy)return;const v=validatePasswordChange({current,next,repeat});
  if(!v.ok){setErrors({[v.field]:v.error});return}
  const creds=reauthCredentials(user,current);
  if(!creds){setNotice('Je account heeft geen e-mailadres of telefoonnummer om je wachtwoord mee te controleren.');return}
  setBusy(true);setErrors({});setNotice('');setDone('');
  try{
   const re=await supabase.auth.signInWithPassword(creds as {email:string;password:string});
   if(re.error){const msg=passwordChangeError(re.error,'reauth');if(msg.includes('klopt niet'))setErrors({current:msg});else setNotice(msg);return}
   const up=await supabase.auth.updateUser({password:next});
   if(up.error){setNotice(passwordChangeError(up.error,'update'));return}
   let signedOut=false;
   if(others){const so=await supabase.auth.signOut({scope:'others'});signedOut=!so.error}
   setCurrent('');setNext('');setRepeat('');
   setDone(`Je wachtwoord is gewijzigd.${others?(signedOut?' Je bent uitgelogd op je andere toestellen.':' Uitloggen op andere toestellen lukte niet; probeer het later via deze pagina opnieuw.'):''}`);
  }catch(e){setNotice(passwordChangeError(e,'update'))}finally{setBusy(false)}
 }
 const canSave=!busy&&!!current&&!!next&&!!repeat;
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Wachtwoord</Text><View style={{width:27}}/></View>
 <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <View style={s.intro}><Ionicons name="lock-closed" size={24} color="#E7C8F2"/><Text style={s.introText}>Kies een sterk wachtwoord dat je nergens anders gebruikt. Snapshot X vraagt je nooit om je wachtwoord via chat of e-mail.</Text></View>
  <PasswordField label="Huidig wachtwoord" value={current} onChange={edit('current',setCurrent)} error={errors.current} autoComplete="current-password" testID="pw-current"/>
  <Text style={[s.forgot,s.forgotText]}>Wachtwoord vergeten? Log uit en kies „Wachtwoord vergeten” op het inlogscherm.</Text>
  <PasswordField label="Nieuw wachtwoord" value={next} onChange={edit('next',setNext)} error={errors.next} autoComplete="new-password" testID="pw-next"/>
  {!!next&&<View style={s.meter} testID="pw-strength"><View style={s.bars}>{[1,2,3,4].map(i=><View key={i} style={[s.bar,{backgroundColor:strength.score>=i?strength.color:'#3A3248'}]}/>)}</View><Text style={[s.meterText,{color:strength.color}]}>{strength.label}</Text></View>}
  <Text style={s.tip}>Minimaal 8 tekens. Tip: combineer hoofdletters, cijfers en tekens, of gebruik 12+ tekens.</Text>
  <PasswordField label="Herhaal nieuw wachtwoord" value={repeat} onChange={edit('repeat',setRepeat)} error={errors.repeat} autoComplete="new-password" testID="pw-repeat"/>
  <View style={s.row}><Ionicons name="phone-portrait-outline" size={20} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>Uitloggen op andere toestellen</Text><Text style={s.description}>Aanbevolen als je denkt dat iemand anders je wachtwoord kent</Text></View><Switch value={others} onValueChange={setOthers} trackColor={{true:purple}} accessibilityLabel="Uitloggen op andere toestellen" testID="pw-others"/></View>
  {!!notice&&<Text style={s.notice} testID="pw-notice">{notice}</Text>}
  {!!done&&<View style={s.done} testID="pw-done"><Ionicons name="checkmark-circle" size={22} color="#38E0A5"/><Text style={s.doneText}>{done}</Text></View>}
  <Pressable onPress={()=>void save()} disabled={!canSave} style={[s.save,!canSave&&{opacity:.5}]} accessibilityRole="button" testID="pw-save">{busy?<ActivityIndicator color="white"/>:<Text style={s.saveText}>Wachtwoord wijzigen</Text>}</Pressable>
 </ScrollView></KeyboardAvoidingView></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:60},intro:{flexDirection:'row',gap:12,alignItems:'center',backgroundColor:'#2B253CB8',borderRadius:18,padding:15,marginBottom:10},introText:{flex:1,color:'#DCD4E6',fontSize:14,lineHeight:19},fieldWrap:{marginTop:14},label:{color:'white',fontSize:15,fontWeight:'700',marginBottom:7},field:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#1A142599',borderRadius:14,paddingHorizontal:14,borderWidth:1,borderColor:'#3A3248'},fieldError:{borderColor:'#FF8A8A'},input:{flex:1,color:'white',fontSize:16,paddingVertical:14},error:{color:'#FF8A8A',fontSize:13,marginTop:6},forgot:{marginTop:8},forgotText:{color:'#A99FBA',fontSize:12.5},meter:{flexDirection:'row',alignItems:'center',gap:10,marginTop:9},bars:{flex:1,flexDirection:'row',gap:5},bar:{flex:1,height:5,borderRadius:3},meterText:{fontSize:13,fontWeight:'800',minWidth:62,textAlign:'right'},tip:{color:'#8E879E',fontSize:12.5,marginTop:7},row:{minHeight:68,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:14,backgroundColor:'#1A142599',borderRadius:14,marginTop:20},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:16},description:{color:'#AAA6B5',fontSize:13,marginTop:4},notice:{color:'#FF8A8A',marginTop:14},done:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#16352C',borderRadius:14,padding:14,marginTop:14},doneText:{flex:1,color:'#D8F5EA',fontSize:14},save:{backgroundColor:purple,borderRadius:26,paddingVertical:16,alignItems:'center',marginTop:22},saveText:{color:'white',fontSize:17,fontWeight:'800'}});
