import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {friendlyError} from '../../lib/db-errors';
import {FriendAvatar} from '../avatar/FriendAvatar';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {loadChatRows} from '../../lib/chat-list';
import {isUuid} from '../../lib/chat-ids';
import {FORWARD_ERRORS,FORWARD_LABEL,filterTargets,forwardDoneText,forwardTargets,selectionSummary,toggleTarget,validateSelection,type ForwardTarget} from '../../lib/chat-forward';

type Props={me:string;myName:string|null;threadId:string;messageId:string;/** One-line preview of what is forwarded (quote excerpt). */excerpt:string;onClose:()=>void;/** Called with the toast text after a successful send. */onDone:(text:string)=>void};
const violet='#B629E2';

/** Snapchat-style "Doorsturen naar…" sheet: search, pick up to 10 chats/friends, ➤ Verzenden. Mount it only while open. */
export function ForwardSheet({me,myName,threadId,messageId,excerpt,onClose,onDone}:Props){
 const insets=useSafeAreaInsets();
 const [targets,setTargets]=useState<ForwardTarget[]|null>(null),[query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;void (async()=>{try{const [chats,fr]=await Promise.all([loadChatRows(me,myName),supabase.from('sx_friends').select('friend_id').eq('user_id',me)]);
   const ids=(fr.data||[]).map(x=>x.friend_id as string);const p=ids.length?await supabase.from('profiles').select('id,display_name').in('id',ids):null;
   if(alive)setTargets(forwardTargets(chats,(p?.data||[]) as {id:string;display_name:string|null}[],threadId))}catch(e){if(alive){setTargets([]);setNotice(friendlyError(e,'Je chats'))}}})();return()=>{alive=false}},[me,myName,threadId]);
 const shown=useMemo(()=>filterTargets(targets??[],query),[targets,query]);
 const outfits=useFriendOutfits(useMemo(()=>(targets??[]).filter(t=>t.kind!=='group').map(t=>t.peerIds[0]).filter(Boolean),[targets]));
 const sections:[string,ForwardTarget[]][]=[[FORWARD_LABEL.groups,shown.filter(t=>t.kind==='group')],[FORWARD_LABEL.recent,shown.filter(t=>t.kind==='chat')],[FORWARD_LABEL.friends,shown.filter(t=>t.kind==='friend')]];
 function tap(key:string){const r=toggleTarget(selected,key);setSelected(r.selected);setNotice(r.error??'')}
 async function send(){const err=validateSelection(selected);if(err){setNotice(err);return}if(busy||!targets)return;setBusy(true);setNotice('');
  try{const picked=selected.map(k=>targets.find(t=>t.key===k)).filter((t):t is ForwardTarget=>!!t);const threadIds:string[]=[];
   // Friends without a 1-op-1 chat yet: open (or find) that chat first, like Snapchat's Send To.
   for(const t of picked){if(t.threadId){threadIds.push(t.threadId);continue}const {data,error}=await supabase.rpc('sx_open_thread',{participants:[t.friendId],group_title:null});if(error)throw error;if(!isUuid(data))throw new Error(FORWARD_ERRORS.blocked);threadIds.push(data)}
   const {error}=await supabase.rpc('sx_forward_message',{p_message_id:messageId,p_thread_ids:[...new Set(threadIds)]});if(error)throw error;
   onDone(forwardDoneText(picked.map(t=>t.kind==='group'?t.title:t.title.split(/\s+/)[0])))}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 const row=(t:ForwardTarget)=>{const on=selected.includes(t.key);return <Pressable key={t.key} onPress={()=>tap(t.key)} style={s.row} testID={`forward-target-${t.kind}`} accessibilityRole="checkbox" accessibilityState={{checked:on}} accessibilityLabel={t.title}>
   {t.kind==='group'?<View style={s.groupIcon}><Ionicons name="people" size={20} color="white"/></View>:<FriendAvatar id={t.peerIds[0]} outfit={outfits.get(t.peerIds[0])} size={40} name={t.title}/>}
   <Text style={s.rowText} numberOfLines={1}>{t.title}</Text>
   <View style={[s.check,on&&s.checkOn]}>{on&&<Ionicons name="checkmark" size={16} color="white"/>}</View></Pressable>};
 return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={s.shade}><View style={[s.sheet,{paddingBottom:Math.max(insets.bottom,12)}]} testID="forward-sheet">
  <View style={s.top}><Pressable onPress={onClose} style={s.topBtn} accessibilityLabel="Sluiten"><Ionicons name="close" size={26} color={C.text}/></Pressable><Text style={s.topTitle}>{FORWARD_LABEL.title}</Text><View style={s.topBtn}/></View>
  <View style={s.preview}><Ionicons name="arrow-redo" size={15} color={C.muted}/><Text style={s.previewText} numberOfLines={2} testID="forward-preview">{excerpt}</Text></View>
  <View style={s.search}><Ionicons name="search" size={17} color={C.muted}/><TextInput value={query} onChangeText={setQuery} placeholder={FORWARD_LABEL.search} placeholderTextColor={C.muted} style={s.searchInput} testID="forward-search" autoCorrect={false}/></View>
  {targets===null?<ActivityIndicator color={C.text} style={{marginTop:30}}/>:<ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled">
   {sections.map(([label,list])=>list.length?<View key={label}><Text style={s.section}>{label}</Text><View style={s.card}>{list.map(row)}</View></View>:null)}
   {!shown.length&&<Text style={s.empty}>{FORWARD_LABEL.none}</Text>}</ScrollView>}
  {!!notice&&<Text style={s.notice} testID="forward-notice">{notice}</Text>}
  {selected.length>0&&<View style={s.bar}><Text style={s.barText} numberOfLines={1} testID="forward-summary">{selectionSummary(targets??[],selected)}</Text>
   <Pressable onPress={()=>void send()} disabled={busy} style={[s.sendBtn,busy&&{opacity:.6}]} testID="forward-send" accessibilityLabel={FORWARD_LABEL.send}><Text style={s.sendText}>{FORWARD_LABEL.send}</Text><Ionicons name="send" size={16} color="white"/></Pressable></View>}
 </View></View></Modal>;
}
const s=StyleSheet.create({
 shade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{backgroundColor:'#191426',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'94%',minHeight:'78%',paddingTop:10},
 top:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingBottom:6},topBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},topTitle:{flex:1,textAlign:'center',color:C.text,fontSize:18,fontWeight:'800'},
 preview:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginBottom:10,padding:10,borderRadius:12,backgroundColor:'#ffffff10',borderLeftWidth:3,borderLeftColor:violet},previewText:{flex:1,color:C.muted,fontSize:14},
 search:{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginBottom:6,paddingHorizontal:12,borderRadius:20,backgroundColor:C.elevated},searchInput:{flex:1,color:C.text,paddingVertical:10,fontSize:15},
 section:{color:C.muted,fontSize:13,fontWeight:'800',marginTop:14,marginBottom:6,marginHorizontal:20,textTransform:'uppercase'},card:{marginHorizontal:12,borderRadius:16,backgroundColor:'#231C33',overflow:'hidden'},
 row:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:12,paddingVertical:9},rowText:{flex:1,color:C.text,fontSize:16,fontWeight:'700'},
 groupIcon:{width:40,height:40,borderRadius:20,backgroundColor:violet,alignItems:'center',justifyContent:'center'},
 check:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:'#6E6680',alignItems:'center',justifyContent:'center'},checkOn:{backgroundColor:C.blue,borderColor:C.blue},
 empty:{color:C.muted,textAlign:'center',marginTop:30},notice:{color:C.yellow,textAlign:'center',marginVertical:6,paddingHorizontal:16},
 bar:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:12,marginTop:6,padding:10,borderRadius:22,backgroundColor:C.blue},barText:{flex:1,color:'white',fontWeight:'800',fontSize:15},
 sendBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#0006',borderRadius:18,paddingHorizontal:14,paddingVertical:8},sendText:{color:'white',fontWeight:'900'},
});
