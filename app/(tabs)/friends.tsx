import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {GalaxyScreen} from '../../components/GalaxyScreen';
import {Avatar} from '../../components/UI';
import {useSession} from '../../hooks/useSession';
import {supabase} from '../../lib/supabase';
import type {Profile} from '../../lib/types';

const purple='#AE16C7';
type Request={id:string;sender_id:string};
export default function Friends(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets();
 const [query,setQuery]=useState(''),[results,setResults]=useState<Profile[]>([]),[friends,setFriends]=useState<Profile[]>([]),[suggestions,setSuggestions]=useState<Profile[]>([]),[requests,setRequests]=useState<Request[]>([]),[senders,setSenders]=useState<Record<string,Profile>>({});
 const [dismissed,setDismissed]=useState<string[]>([]),[pending,setPending]=useState<string[]>([]),[notice,setNotice]=useState(''),[ownUsername,setOwnUsername]=useState(''),[qrOpen,setQrOpen]=useState(false),[scanOpen,setScanOpen]=useState(false),[permission,askPermission]=useCameraPermissions();
 const load=useCallback(async()=>{
  if(!uid)return;
  const [f,r,own,b,rec,outgoing]=await Promise.all([
   supabase.from('sx_friends').select('friend_id').eq('user_id',uid),
   supabase.from('sx_friend_requests').select('id,sender_id').eq('recipient_id',uid).eq('status','pending'),
   supabase.from('profiles').select('username').eq('id',uid).single(),
   supabase.from('sx_blocks').select('blocked_id').eq('blocker_id',uid),
   supabase.from('profiles').select('id,username,display_name,avatar_path,activity_score').order('activity_score',{ascending:false}).limit(30),
   supabase.from('sx_friend_requests').select('recipient_id').eq('sender_id',uid).eq('status','pending'),
  ]);
  const problem=[f.error,r.error,own.error,b.error,rec.error,outgoing.error].find(Boolean);
  if(problem){setNotice(problem.message);return}
  const blocked=new Set((b.data||[]).map(x=>x.blocked_id));
  const ids=(f.data||[]).map(x=>x.friend_id).filter(id=>!blocked.has(id));
  const people=ids.length?await supabase.from('profiles').select('id,username,display_name,avatar_path,activity_score').in('id',ids):null;
  if(people?.error){setNotice(people.error.message);return}
  setFriends(people?.data||[]);setRequests(r.data||[]);setPending((outgoing.data||[]).map(x=>x.recipient_id));setOwnUsername(own.data?.username||'');
  const senderIds=(r.data||[]).map(x=>x.sender_id);
  if(senderIds.length){const p=await supabase.from('profiles').select('id,username,display_name,avatar_path,activity_score').in('id',senderIds);setSenders(Object.fromEntries((p.data||[]).map(x=>[x.id,x])))}else setSenders({});
  setSuggestions((rec.data||[]).filter(p=>p.id!==uid&&!ids.includes(p.id)&&!blocked.has(p.id)&&!senderIds.includes(p.id)));
 },[uid]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{
  const term=query.trim().replace(/[%_]/g,'');if(term.length<3){setResults([]);return}
  const {data,error}=await supabase.from('profiles').select('id,username,display_name,avatar_path,activity_score').ilike('username',`%${term}%`).limit(20);
  if(cancelled)return;if(error)setNotice(error.message);else setResults((data||[]).filter(p=>p.id!==uid));
 },300);return()=>{cancelled=true;clearTimeout(timer)}},[query,uid]);
 const friendIds=useMemo(()=>new Set(friends.map(p=>p.id)),[friends]);
 async function invite(id:string){if(!uid||pending.includes(id))return;const {error}=await supabase.from('sx_friend_requests').insert({sender_id:uid,recipient_id:id});if(error)setNotice(error.message);else{setPending(v=>[...v,id]);setNotice('Vriendschapsverzoek verstuurd')}}
 async function accept(id:string){const {error}=await supabase.rpc('sx_accept_friend',{request_id:id});if(error)setNotice(error.message);else await load()}
 async function chat(id:string){const {data,error}=await supabase.rpc('sx_open_thread',{participants:[id],group_title:null});if(error)setNotice(error.message);else router.push({pathname:'/chat/[id]',params:{id:data}})}
 function scan(data:string){const match=/^snapshotx:\/\/friends\?u=([a-z0-9_]{3,24})$/.exec(data);if(!match){setNotice('Dit is geen SnapShot X-code.');return}setScanOpen(false);setQuery(match[1])}
 function person(p:Profile,kind:'request'|'suggestion'|'result',requestId?:string){const isFriend=friendIds.has(p.id),isPending=pending.includes(p.id);return <View style={s.row} key={`${kind}-${p.id}`}><Avatar name={p.display_name} size={52}/><View style={s.identity}><Text style={s.name} numberOfLines={1}>{p.display_name}</Text><Text style={s.meta} numberOfLines={1}>@{p.username}</Text></View><Pressable style={s.action} onPress={()=>kind==='request'?void accept(requestId!):isFriend?void chat(p.id):void invite(p.id)} accessibilityLabel={kind==='request'?`${p.display_name} accepteren`:isFriend?`Chat met ${p.display_name}`:`${p.display_name} toevoegen`}><Ionicons name={kind==='request'?'person-add':isFriend?'chatbubble':'person-add'} size={16} color="white"/><Text style={s.actionText}>{kind==='request'?'Accepteren':isFriend?'Chat':isPending?'Verstuurd':'Toevoegen'}</Text></Pressable>{kind!=='result'&&<Pressable onPress={()=>setDismissed(v=>[...v,p.id])} accessibilityLabel={`${p.display_name} verbergen`} hitSlop={12}><Ionicons name="close" color="#C6C0CC" size={22}/></Pressable>}</View>}
 const list=query.trim().length>=3?results:suggestions.filter(p=>!dismissed.includes(p.id));
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-down" color="white" size={32}/></Pressable><Text style={s.title}>Vrienden toevoegen</Text><Pressable onPress={()=>setQrOpen(true)} accessibilityLabel="Mijn code"><Ionicons name="ellipsis-horizontal" color="white" size={28}/></Pressable></View>
  <View style={s.search}><Ionicons name="search" color="white" size={23}/><TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Zoeken..." placeholderTextColor="#BBB6C8" autoCapitalize="none" returnKeyType="search"/><Pressable onPress={async()=>{if(!permission?.granted){const p=await askPermission();if(!p.granted){setNotice('Cameratoegang nodig om een code te scannen.');return}}setScanOpen(true)}} accessibilityLabel="QR-code scannen"><Ionicons name="qr-code-outline" size={24} color="white"/></Pressable></View>
  <FlatList data={list} keyExtractor={x=>x.id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" ListHeaderComponent={<><Pressable style={s.invite} onPress={()=>setQrOpen(true)}><Ionicons name="qr-code-outline" size={22} color="white"/><Text style={s.inviteText}>Deel je SnapShot X-code</Text><Ionicons name="chevron-forward" size={18} color="white"/></Pressable>{!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}{requests.some(r=>!dismissed.includes(r.sender_id))&&<><Text style={s.section}>Hebben mij toegevoegd</Text>{requests.filter(r=>!dismissed.includes(r.sender_id)).map(r=>senders[r.sender_id]?person(senders[r.sender_id],'request',r.id):null)}</>}<View style={s.sectionRow}><Text style={s.section}>{query.trim().length>=3?'Zoekresultaten':'Vrienden zoeken'}</Text>{!query&&<Text style={s.subtle}>Suggesties</Text>}</View></>} renderItem={({item})=>person(item,query.trim().length>=3?'result':'suggestion')} ListEmptyComponent={<Text style={s.empty}>{query.trim().length>=3?'Geen gebruikers gevonden.':'Geen suggesties. Zoek op gebruikersnaam.'}</Text>} ListFooterComponent={<><Text style={s.section}>Mijn vrienden · {friends.length}</Text>{friends.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friends}>{friends.map(p=><Pressable key={p.id} onPress={()=>void chat(p.id)} style={s.friend}><Avatar name={p.display_name} size={56}/><Text style={s.friendName} numberOfLines={1}>{p.display_name}</Text></Pressable>)}</ScrollView>:<Text style={s.empty}>Voeg iemand toe om samen te chatten.</Text>}</>}/>
  <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={()=>setQrOpen(false)}><View style={s.modal}><Text style={s.title}>Mijn SnapShot X-code</Text>{!!ownUsername&&<View style={s.qr}><QRCode value={`snapshotx://friends?u=${ownUsername}`} size={210}/></View>}<Text style={s.meta}>@{ownUsername}</Text><Pressable onPress={()=>setQrOpen(false)} style={s.action}><Text style={s.actionText}>Sluiten</Text></Pressable></View></Modal>
  <Modal visible={scanOpen} animationType="slide" onRequestClose={()=>setScanOpen(false)}><View style={s.modal}><Text style={s.title}>Code scannen</Text>{scanOpen&&<CameraView style={s.scanner} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>scan(data)}/>}<Pressable onPress={()=>setScanOpen(false)} style={s.action}><Text style={s.actionText}>Sluiten</Text></Pressable></View></Modal>
 </GalaxyScreen>
}
const s=StyleSheet.create({header:{height:57,marginTop:45,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},search:{height:54,marginHorizontal:17,marginTop:8,borderRadius:29,backgroundColor:'#2B2938CC',flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16},input:{flex:1,color:'white',fontSize:17},list:{paddingHorizontal:16,paddingBottom:28},invite:{height:49,borderRadius:24,backgroundColor:'#30236F',marginVertical:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},inviteText:{color:'white',fontSize:16,fontWeight:'800'},section:{fontSize:21,color:'white',fontWeight:'800',marginTop:15,marginBottom:11},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},subtle:{color:'#C4C0CB'},row:{minHeight:75,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:4},identity:{flex:1,minWidth:0},name:{color:'white',fontSize:18,fontWeight:'700'},meta:{color:'#C7C0CD',fontSize:13,marginTop:3},action:{backgroundColor:purple,borderRadius:28,minHeight:38,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},actionText:{color:'white',fontSize:14,fontWeight:'800'},notice:{backgroundColor:'#332346',borderRadius:12,padding:12},noticeText:{color:'white'},empty:{color:'#C7C0CD',fontSize:15,marginVertical:12},friends:{gap:14,paddingVertical:8},friend:{width:75,alignItems:'center'},friendName:{color:'white',fontSize:12,marginTop:6},modal:{flex:1,backgroundColor:'#100C1D',alignItems:'center',justifyContent:'center',padding:25,gap:20},qr:{backgroundColor:'white',padding:16,borderRadius:20},scanner:{width:'100%',height:400}});
