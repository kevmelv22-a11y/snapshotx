import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {router, useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {GalaxyScreen} from '../../components/GalaxyScreen';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {friendOutfitCache,useFriendOutfits} from '../../hooks/useFriendOutfits';
import {useSession} from '../../hooks/useSession';
import {useOwnProfile} from '../../hooks/useOwnProfile';
import {friendlyError,isUnavailable} from '../../lib/db-errors';
import {isUuid} from '../../lib/chat-ids';
import {parseFriendCode} from '../../lib/own-profile';
import {hideSuggestion, type SuggestedFriend} from '../../lib/friends/suggest';
import {supabase} from '../../lib/supabase';
import type {Profile} from '../../lib/types';

const purple='#AE16C7';
type Request={id:string;sender_id:string};
type SuggestedProfile=Profile & {mutuals:number};
// '*' (not a column list) so the optional profiles.gender (migration may not be applied on live) never breaks the query;
// it only picks the default character art for people whose kast outfit we can't see (requests, suggestions).
const PROFILE_COLS='*';
const genderOf=(p:object)=>{const g=(p as {gender?:unknown}).gender;return g==='female'||g==='male'?g:undefined};

export default function Friends(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets();
 const [query,setQuery]=useState(''),[results,setResults]=useState<Profile[]>([]),[friends,setFriends]=useState<Profile[]>([]),[suggestions,setSuggestions]=useState<SuggestedProfile[]>([]),[suggestionsUnavailable,setSuggestionsUnavailable]=useState(false),[requests,setRequests]=useState<Request[]>([]),[senders,setSenders]=useState<Record<string,Profile>>({});
 const [dismissed,setDismissed]=useState<string[]>([]),[pending,setPending]=useState<string[]>([]),[notice,setNotice]=useState(''),[qrOpen,setQrOpen]=useState(false),[scanOpen,setScanOpen]=useState(false),[permission,askPermission]=useCameraPermissions();
 const {profile:own,loading:ownLoading}=useOwnProfile();
 const load=useCallback(async()=>{
  if(!uid)return;
  // Each part loads on its own: one unavailable table (e.g. sx_friends without GRANT on live) must not blank the rest.
  const [f,r,b,outgoing]=await Promise.all([
   supabase.from('sx_friends').select('friend_id').eq('user_id',uid),
   supabase.from('sx_friend_requests').select('id,sender_id').eq('recipient_id',uid).eq('status','pending'),
   supabase.from('sx_blocks').select('blocked_id').eq('blocker_id',uid),
   supabase.from('sx_friend_requests').select('recipient_id').eq('sender_id',uid).eq('status','pending'),
  ]);
  const problems:string[]=[];
  if(f.error)problems.push(friendlyError(f.error,'Je vrienden'));
  if(r.error||outgoing.error)problems.push(friendlyError(r.error||outgoing.error,'Vriendschapsverzoeken'));
  if(b.error&&!isUnavailable(b.error))problems.push(friendlyError(b.error,'Geblokkeerde gebruikers'));
  const blocked=new Set((b.data||[]).map(x=>x.blocked_id));
  const ids=(f.data||[]).map(x=>x.friend_id).filter(id=>!blocked.has(id));
  if(!f.error)friendOutfitCache.prune(ids); // unfriended/blocked people: drop their cached outfit (memory + device storage)
  const people=ids.length?await supabase.from('profiles').select(PROFILE_COLS).in('id',ids):null;
  if(people?.error)problems.push(friendlyError(people.error,'Profielen van vrienden'));
  setFriends(people?.data||[]);setRequests(r.data||[]);setPending((outgoing.data||[]).map(x=>x.recipient_id));
  const senderIds=(r.data||[]).map(x=>x.sender_id);
  if(senderIds.length){const p=await supabase.from('profiles').select(PROFILE_COLS).in('id',senderIds);setSenders(Object.fromEntries((p.data||[]).map(x=>[x.id,x])))}else setSenders({});
  const {data:recommendations,error:suggestionError}=await supabase.rpc('sx_suggest_friends',{p_limit:30});
  if(suggestionError){setSuggestions([]);setSuggestionsUnavailable(isUnavailable(suggestionError));if(!isUnavailable(suggestionError))problems.push(friendlyError(suggestionError,'Vriendensuggesties'))}
  else{
   setSuggestionsUnavailable(false);
   setSuggestions(((recommendations||[]) as SuggestedFriend[]).filter(p=>p.user_id!==uid&&!ids.includes(p.user_id)&&!blocked.has(p.user_id)&&!senderIds.includes(p.user_id)).map(p=>({id:p.user_id,username:p.username,display_name:p.display_name,avatar_path:null,activity_score:0,mutuals:p.mutuals})));
  }
  setNotice([...new Set(problems)].join('\n'));
 },[uid]);
 useFocusEffect(useCallback(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]));
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{
  const term=query.trim().replace(/[%_]/g,'');if(term.length<3){setResults([]);return}
  const {data,error}=await supabase.from('profiles').select(PROFILE_COLS).ilike('username',`%${term}%`).limit(20);
  if(cancelled)return;if(error)setNotice(friendlyError(error,'Zoeken'));else setResults((data||[]).filter(p=>p.id!==uid));
 },300);return()=>{cancelled=true;clearTimeout(timer)}},[query,uid]);
 const friendIds=useMemo(()=>new Set(friends.map(p=>p.id)),[friends]);
 // Only accepted friends can have their saved outfit read (RPC checks friendship); others keep the initial.
 const friendOutfits=useFriendOutfits(useMemo(()=>friends.map(p=>p.id),[friends]),{live:true});
 async function invite(id:string){if(!uid||pending.includes(id))return;const {error}=await supabase.from('sx_friend_requests').insert({sender_id:uid,recipient_id:id});if(error)setNotice(friendlyError(error));else{setPending(v=>[...v,id]);setNotice('Vriendschapsverzoek verstuurd')}}
 async function accept(id:string){const {error}=await supabase.rpc('sx_accept_friend',{request_id:id});if(error)setNotice(friendlyError(error));else await load()}
 async function chat(id:string){if(!isUuid(id)){setNotice('Chat openen: deze vriend is (nog) geen echt account.');return}const {data,error}=await supabase.rpc('sx_open_thread',{participants:[id],group_title:null});if(error)setNotice(friendlyError(error,'Chat openen'));else router.push({pathname:'/chat/[id]',params:{id:data}})}
 async function scan(data:string){const code=parseFriendCode(data);if(!code){setNotice('Dit is geen SnapShot X-code.');return}setScanOpen(false);
  if(code.kind==='username'){setQuery(code.value);return}
  // Code of someone without a username yet: look the account up by id.
  const {data:p,error}=await supabase.from('profiles').select(PROFILE_COLS).eq('id',code.value).maybeSingle();
  if(error){setNotice(friendlyError(error,'Code'));return}if(!p){setNotice('Deze gebruiker is niet gevonden.');return}
  if(p.id===uid){setNotice('Dit is je eigen code.');return}
  if(p.username)setQuery(p.username);else setResults([p])}
 async function dismissPerson(p:Profile,kind:'request'|'suggestion'){
  if(kind==='suggestion'){try{await hideSuggestion(p.id)}catch(e){setNotice(friendlyError(e,'Suggestie verbergen'));return}}
  setDismissed(v=>v.includes(p.id)?v:[...v,p.id]);
 }
 function person(p:Profile & {mutuals?:number},kind:'request'|'suggestion'|'result',requestId?:string){
  const isFriend=friendIds.has(p.id),isPending=pending.includes(p.id);
  const meta=kind==='suggestion'&&p.mutuals?`@${p.username} · ${p.mutuals} ${p.mutuals===1?'gedeelde vriend':'gedeelde vrienden'}`:`@${p.username}`;
  return <View style={s.row} key={`${kind}-${p.id}`}><Pressable disabled={!isFriend} onPress={()=>router.push({pathname:'/friend/[id]',params:{id:p.id}})} accessibilityLabel={isFriend?`Vriendschapsprofiel van ${p.display_name}`:undefined} style={s.who}><View style={s.avatarRing}><FriendAvatar id={p.id} outfit={isFriend?friendOutfits.get(p.id):null} size={52} name={p.display_name} gender={genderOf(p)}/></View><View style={s.identity}><Text style={s.name} numberOfLines={1}>{p.display_name}</Text><Text style={s.meta} numberOfLines={1}>{meta}</Text></View></Pressable><Pressable style={[s.action,isPending&&{opacity:.55}]} disabled={isPending&&kind!=='request'} onPress={()=>kind==='request'?void accept(requestId!):isFriend?void chat(p.id):void invite(p.id)} accessibilityLabel={kind==='request'?`${p.display_name} accepteren`:isFriend?`Chat met ${p.display_name}`:`${p.display_name} toevoegen`}><Ionicons name={kind==='request'?'person-add':isFriend?'chatbubble':'person-add'} size={16} color="white"/><Text style={s.actionText}>{kind==='request'?'Accepteren':isFriend?'Chat':isPending?'Verstuurd':'Toevoegen'}</Text></Pressable>{kind!=='result'&&<Pressable onPress={()=>void dismissPerson(p,kind)} accessibilityLabel={`${p.display_name} verbergen`} hitSlop={12}><Ionicons name="close" color="#C6C0CC" size={22}/></Pressable>}</View>
 }
 const list=query.trim().length>=3?results:suggestions.filter(p=>!dismissed.includes(p.id));
 const emptyMessage=query.trim().length>=3?'Geen gebruikers gevonden.':suggestionsUnavailable?'Vriendensuggesties worden nog ingesteld. Je kunt wel op gebruikersnaam zoeken.':'Geen suggesties. Zoek op gebruikersnaam.';
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-down" color="white" size={32}/></Pressable><Text style={s.title}>Vrienden toevoegen</Text><Pressable onPress={()=>setQrOpen(true)} accessibilityLabel="Mijn code"><Ionicons name="ellipsis-horizontal" color="white" size={28}/></Pressable></View>
  <View style={s.search}><Ionicons name="search" color="white" size={23}/><TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Zoeken..." placeholderTextColor="#BBB6C8" autoCapitalize="none" returnKeyType="search"/><Pressable onPress={async()=>{if(!permission?.granted){const p=await askPermission();if(!p.granted){setNotice('Cameratoegang nodig om een code te scannen.');return}}setScanOpen(true)}} accessibilityLabel="QR-code scannen"><Ionicons name="qr-code-outline" size={24} color="white"/></Pressable></View>
  <FlatList data={list} keyExtractor={x=>x.id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled" ListHeaderComponent={<><Pressable style={s.invite} onPress={()=>setQrOpen(true)}><Ionicons name="qr-code-outline" size={22} color="white"/><Text style={s.inviteText}>Deel je SnapShot X-code</Text><Ionicons name="chevron-forward" size={18} color="white"/></Pressable>{!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}{requests.some(r=>!dismissed.includes(r.sender_id))&&<><Text style={s.section}>Hebben mij toegevoegd</Text>{requests.filter(r=>!dismissed.includes(r.sender_id)).map(r=>senders[r.sender_id]?person(senders[r.sender_id],'request',r.id):null)}</>}<View style={s.sectionRow}><Text style={s.section}>{query.trim().length>=3?'Zoekresultaten':'Vrienden zoeken'}</Text>{!query&&<Text style={s.subtle}>{list.length} suggesties</Text>}</View></>} renderItem={({item})=>person(item,query.trim().length>=3?'result':'suggestion')} ListEmptyComponent={<Text style={s.empty}>{emptyMessage}</Text>} ListFooterComponent={<><Text style={s.section}>Mijn vrienden · {friends.length}</Text>{friends.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friends}>{friends.map(p=><Pressable key={p.id} onPress={()=>router.push({pathname:'/friend/[id]',params:{id:p.id}})} onLongPress={()=>void chat(p.id)} accessibilityLabel={`Vriendschapsprofiel van ${p.display_name}`} accessibilityHint="Lang indrukken om meteen te chatten" style={s.friend}><FriendAvatar id={p.id} outfit={friendOutfits.get(p.id)} size={56} name={p.display_name}/><Text style={s.friendName} numberOfLines={1}>{p.display_name}</Text></Pressable>)}</ScrollView>:<Text style={s.empty}>Voeg iemand toe om samen te chatten.</Text>}</>}/>
  <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={()=>setQrOpen(false)}><View style={s.modal}><Text style={s.title}>Mijn SnapShot X-code</Text>{own?<View style={s.qr} testID="own-qr"><QRCode value={own.qrValue} size={210}/></View>:<View style={[s.qr,s.qrLoading]}><ActivityIndicator color={purple}/></View>}<Text style={s.codeName} numberOfLines={1}>{own?.displayName||'Je profiel'}</Text><Text style={s.meta} testID="own-handle">{own?`@${own.handle}`:'Code laden…'}</Text>{ownLoading&&!!own&&<Text style={s.subtle}>Profiel bijwerken…</Text>}{!ownLoading&&!!own&&!own.hasUsername&&<Text style={s.codeHint}>Je gebruikersnaam is nog niet opgeslagen op de server. Vrienden kunnen deze code wel scannen.</Text>}{!!own?.notice&&<Text style={s.codeHint}>{own.notice}</Text>}<Pressable onPress={()=>setQrOpen(false)} style={s.action}><Text style={s.actionText}>Sluiten</Text></Pressable></View></Modal>
  <Modal visible={scanOpen} animationType="slide" onRequestClose={()=>setScanOpen(false)}><View style={s.modal}><Text style={s.title}>Code scannen</Text>{scanOpen&&<CameraView style={s.scanner} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>scan(data)}/>}<Pressable onPress={()=>setScanOpen(false)} style={s.action}><Text style={s.actionText}>Sluiten</Text></Pressable></View></Modal>
 </GalaxyScreen>
}
const s=StyleSheet.create({header:{height:57,marginTop:45,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},search:{height:54,marginHorizontal:17,marginTop:8,borderRadius:29,backgroundColor:'#2B2938CC',flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16},input:{flex:1,color:'white',fontSize:17},list:{paddingHorizontal:16,paddingBottom:28},invite:{height:49,borderRadius:24,backgroundColor:'#30236F',marginVertical:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},inviteText:{color:'white',fontSize:16,fontWeight:'800'},section:{fontSize:21,color:'white',fontWeight:'800',marginTop:15,marginBottom:11},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},subtle:{color:'#C4C0CB'},avatarRing:{padding:3,borderWidth:2,borderColor:purple,borderRadius:32},row:{minHeight:75,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:4},identity:{flex:1,minWidth:0},who:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:10},name:{color:'white',fontSize:18,fontWeight:'700'},meta:{color:'#C7C0CD',fontSize:13,marginTop:3},action:{backgroundColor:purple,borderRadius:28,minHeight:38,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},actionText:{color:'white',fontSize:14,fontWeight:'800'},notice:{backgroundColor:'#332346',borderRadius:12,padding:12},noticeText:{color:'white'},empty:{color:'#C7C0CD',fontSize:15,marginVertical:12},friends:{gap:14,paddingVertical:8},friend:{width:75,alignItems:'center'},friendName:{color:'white',fontSize:12,marginTop:6},modal:{flex:1,backgroundColor:'#100C1D',alignItems:'center',justifyContent:'center',padding:25,gap:20},qr:{backgroundColor:'white',padding:16,borderRadius:20},qrLoading:{width:242,height:242,alignItems:'center',justifyContent:'center'},codeName:{color:'white',fontSize:18,fontWeight:'800',marginBottom:-14},codeHint:{color:'#C7C0CD',fontSize:13,textAlign:'center',maxWidth:300},scanner:{width:'100%',height:400}});
