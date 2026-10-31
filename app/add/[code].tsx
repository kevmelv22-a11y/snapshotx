import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {Redirect,Stack,router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {GalaxyScreen} from '../../components/GalaxyScreen';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {useSession} from '../../hooks/useSession';
import {friendlyError} from '../../lib/db-errors';
import {parseCodeSegment,requestResultText} from '../../lib/friend-code';
import {setPendingAdd} from '../../lib/pending-add';
import {supabase} from '../../lib/supabase';

type Found={id:string;username:string|null;display_name:string|null;relation:'self'|'friends'|'incoming'|'outgoing'|'none';request_id:string|null};
/** snapshot-x.nl/add/<username|id> and snapshotx://add/<code>: opened by a scanned Snapcode/QR or a shared link. */
export default function AddFriend(){
 const {code:raw}=useLocalSearchParams<{code:string|string[]}>(),seg=Array.isArray(raw)?raw[0]:raw??'',code=parseCodeSegment(seg);
 const {session,ready}=useSession(),uid=session?.user.id;
 const [p,setP]=useState<Found|null>(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{if(!uid||!code)return;setLoading(true);setPendingAdd(null);
  const {data,error}=await supabase.rpc('sx_lookup_friend_code',code.kind==='id'?{p_user_id:code.value}:{p_username:code.value});
  const row=(Array.isArray(data)?data[0]:data) as Found|undefined;
  if(error)setNotice(friendlyError(error,'Code'));else if(!row)setNotice('Deze gebruiker is niet gevonden.');
  setP(row??null);setLoading(false)},[uid,code?.kind,code?.value]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{const t=setTimeout(()=>void load(),0);return()=>clearTimeout(t)},[load]);
 if(ready&&!session&&code){setPendingAdd(seg);return <Redirect href="/(auth)/login"/>}
 const name=p?.display_name||p?.username||'deze gebruiker';
 async function add(){if(!p)return;setBusy(true);setNotice('');const {data,error}=await supabase.rpc('sx_request_friend',{p_user_id:p.id});setBusy(false);
  if(error){setNotice(friendlyError(error,'Toevoegen'));return}setNotice(requestResultText(data as string,name));await load()}
 const r=p?.relation;
 return <GalaxyScreen><Stack.Screen options={{title:'Vriend toevoegen'}}/>
  <View style={s.wrap} testID="add-friend">
   {!code?<Text style={s.text}>Dit is geen geldige SnapShot X-code.</Text>:loading&&!p&&!notice?<ActivityIndicator color="white"/>:p?<>
    <View style={s.ring}><FriendAvatar id={p.id} outfit={null} size={110} name={name}/></View>
    <Text style={s.name}>{name}</Text>{!!p.username&&<Text style={s.handle}>@{p.username}</Text>}
    {r==='self'&&<Text style={s.text}>Dit is je eigen code. Laat een vriend hem scannen om jou toe te voegen.</Text>}
    {(r==='none'||r==='incoming')&&<Pressable testID="add-friend-button" disabled={busy} onPress={()=>void add()} style={[s.btn,busy&&{opacity:.6}]}><Ionicons name={r==='incoming'?'checkmark':'person-add'} size={20} color="#111"/><Text style={s.btnText}>{r==='incoming'?'Accepteren':'Toevoegen'}</Text></Pressable>}
    {r==='incoming'&&<Text style={s.text}>{name} heeft jou al toegevoegd.</Text>}
    {r==='outgoing'&&<View style={[s.btn,s.btnMuted]}><Ionicons name="time-outline" size={20} color="white"/><Text style={[s.btnText,{color:'white'}]}>Verzoek verstuurd</Text></View>}
    {r==='friends'&&<Pressable testID="open-friend" onPress={()=>router.replace({pathname:'/friend/[id]',params:{id:p.id}})} style={s.btn}><Ionicons name="person" size={20} color="#111"/><Text style={s.btnText}>Bekijk vriendschap</Text></Pressable>}
   </>:null}
   {!!notice&&<Text style={s.notice} testID="add-friend-notice">{notice}</Text>}
   <Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)')} style={s.link}><Text style={s.linkText}>Terug</Text></Pressable>
  </View></GalaxyScreen>;
}
const s=StyleSheet.create({wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:12},ring:{borderWidth:3,borderColor:'#FFFC00',borderRadius:70,padding:6},
 name:{color:'white',fontSize:26,fontWeight:'800',textAlign:'center'},handle:{color:'#CFC8E0',fontSize:16},text:{color:'#E8E2F5',textAlign:'center',fontSize:15,maxWidth:320},
 btn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFFC00',paddingHorizontal:28,paddingVertical:14,borderRadius:26,marginTop:8},btnMuted:{backgroundColor:'#3A2F55'},
 btnText:{color:'#111',fontWeight:'800',fontSize:16},notice:{color:'white',backgroundColor:'#ffffff1f',padding:12,borderRadius:14,textAlign:'center',maxWidth:340},link:{padding:12},linkText:{color:'#CFC8E0',fontWeight:'700'}});
