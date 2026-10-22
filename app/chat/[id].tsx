import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Stack,router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {uploadMedia,mediaUrl} from '../../lib/media';
import {useSession} from '../../hooks/useSession';
import {C} from '../../lib/theme';
import {Media} from '../../components/Media';
import {Hint} from '../../components/UI';
import type {Message} from '../../lib/types';
import {openDurationMs} from '../../lib/snap-edit';
import {useConfirmDialog} from '../../components/ConfirmDialog';
import {ChatHeaderBar,ChatView} from '../../components/chat/ChatView';
import {RecordingBar,RetentionSheet,VoiceNotePlayer} from '../../components/chat/ChatParts';
import {useOwnOutfit} from '../../hooks/useWardrobeSync';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {AvatarStickerSheet,ChatAvatarSticker} from '../../components/avatar/AvatarStickerSheet';
import {chatStickerBody,stickerFromChatBody} from '../../lib/avatar/poses';
import {VOICE_MAX_MS,activeTypers,applyTyping,computeStreak,isMessageVisible,keepRecording,meterLevel,parseRetention,retentionChangeText,screenshotText,shouldReportScreenshot,shouldSendTyping,toggleReaction,typingText,type Reaction,type RetentionMode,type TypingMap} from '../../lib/chat-features';

import {friendlyError} from '../../lib/db-errors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MENU_LABEL,colorFor,emptyMessageText,messageMenuActions,senderColors} from '../../lib/chat-senders';
import {quoteOf,replyBarTitle,replyBody} from '../../lib/chat-replies';
import {ReplyBar} from '../../components/chat/ChatReply';
import {STATUS_COLOR,messageStatus,snapLine} from '../../lib/chat-status';
import {StatusIcon} from '../../components/chat/StatusIcon';
import {SAVE_LABEL,applySaved,saveAction} from '../../lib/chat-saves';
import {groupDisplayTitle,isGroupThread} from '../../lib/group-chat';
import {GroupInfoSheet,type GroupMember} from '../../components/chat/GroupInfoSheet';
import {isSilentSystemMessageError,systemMessageRow,threadIdFromParam} from '../../lib/chat-ids';
export default function Chat(){
 const confirm=useConfirmDialog(),insets=useSafeAreaInsets();
 const {id:rawId}=useLocalSearchParams<{id:string|string[]}>(),id=threadIdFromParam(rawId)??'',{session}=useSession(),uid=session?.user.id??'';
 const [rows,setRows]=useState<Message[]>([]),[body,setBody]=useState(''),[notice,setNotice]=useState(id?'':'Deze chat kon niet worden geopend.'),[busy,setBusy]=useState(false),[opened,setOpened]=useState<Record<string,boolean>>({});
 const [retention,setRetention]=useState<RetentionMode>('24h'),[retentionOpen,setRetentionOpen]=useState(false);
 const [viewedAt,setViewedAt]=useState<Record<string,number>>({}),[reactions,setReactions]=useState<Reaction[]>([]);
 // Snapchat receipts: my messages opened by a friend (➤ Bezorgd → ▷ Geopend) and how often I replayed a snap.
 const [peerOpened,setPeerOpened]=useState<ReadonlySet<string>>(new Set()),[replays,setReplays]=useState<Record<string,number>>({});
 const [peers,setPeers]=useState<{id:string;name:string}[]>([]),[typingMap,setTypingMap]=useState<TypingMap>({}),[now,setNow]=useState(Date.now());
 const sessionStart=useRef(Date.now()).current,channelRef=useRef<RealtimeChannel|null>(null),lastTyping=useRef<number|null>(null),lastShot=useRef<number|null>(null);
 const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,isMeteringEnabled:true}),recorderState=useAudioRecorderState(recorder,200);

 const load=useCallback(async()=>{if(!id)return;const {data,error}=await supabase.from('sx_messages').select('*').eq('thread_id',id).order('created_at',{ascending:false}).limit(100);if(error){setNotice(friendlyError(error));return}const list=(data||[]) as Message[];setRows(list);
  if(!uid)return;const incoming=list.filter(m=>m.sender_id!==uid).map(m=>m.id);
  if(incoming.length){const r=await supabase.from('sx_receipts').select('message_id,opened_at,replay_count').eq('user_id',uid).in('message_id',incoming);if(!r.error){const seen=(r.data||[]).filter(x=>x.opened_at);setViewedAt(Object.fromEntries(seen.map(x=>[x.message_id,Date.parse(x.opened_at)])));setReplays(Object.fromEntries(seen.map(x=>[x.message_id,Number(x.replay_count)||0])))}}
  const outgoing=list.filter(m=>m.sender_id===uid&&m.kind!=='system').map(m=>m.id);
  if(outgoing.length){const r=await supabase.from('sx_receipts').select('message_id,opened_at').in('message_id',outgoing).neq('user_id',uid);if(!r.error)setPeerOpened(new Set((r.data||[]).filter(x=>x.opened_at).map(x=>x.message_id)))}
  // Reactions need migration 20261013150000_chat_step4.sql; without it the query errors and reactions stay empty.
  const ids=list.map(m=>m.id);if(ids.length){const r=await supabase.from('sx_reactions').select('message_id,user_id,emoji').in('message_id',ids);if(!r.error)setReactions((r.data||[]).map(x=>({messageId:x.message_id,userId:x.user_id,emoji:x.emoji})))}
 },[id,uid]);
 // Thread meta: retention setting, group name/creator + members (names for typing, streak partner, Groepsinfo).
 const [threadTitle,setThreadTitle]=useState<string|null>(null),[creatorId,setCreatorId]=useState<string|null>(null),[members,setMembers]=useState<GroupMember[]>([]),[infoOpen,setInfoOpen]=useState(false);
 const loadMeta=useCallback(async(alive:()=>boolean=()=>true)=>{if(!id||!uid)return;const t=await supabase.from('sx_threads').select('retention_mode,title,created_by').eq('id',id).maybeSingle();if(alive()&&!t.error){setRetention(parseRetention(t.data?.retention_mode));setThreadTitle(t.data?.title??null);setCreatorId(t.data?.created_by??null)}
  const m=await supabase.from('sx_members').select('user_id').eq('thread_id',id);const all=[...new Set((m.data||[]).map(x=>x.user_id as string))];const ids=all.filter(x=>x!==uid);const p=all.length?await supabase.from('profiles').select('id,display_name').in('id',all):null;const names=new Map((p?.data||[]).map(x=>[x.id,x.display_name]));if(!alive())return;
  setPeers(ids.map(x=>({id:x,name:names.get(x)||'Vriend'})));setMembers(all.map(x=>({id:x,name:x===uid?(names.get(x)||session?.user.user_metadata?.display_name||'Jij'):(names.get(x)||'Vriend')})))},[id,uid,session?.user.user_metadata?.display_name]);
 useEffect(()=>{let alive=true;const timer=setTimeout(()=>void loadMeta(()=>alive),0);return()=>{alive=false;clearTimeout(timer)}},[loadMeta]);
 useEffect(()=>{if(!id)return;const timer=setTimeout(()=>void load(),0);
  const channel=supabase.channel(`sx-thread-${id}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_messages',filter:`thread_id=eq.${id}`},()=>void load())
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'sx_messages',filter:`thread_id=eq.${id}`},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'sx_reactions'},()=>void load())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_receipts'},()=>void load())
   .on('broadcast',{event:'typing'},({payload})=>{const p=payload as {user:string;typing:boolean};if(p?.user)setTypingMap(m=>applyTyping(m,p.user,!!p.typing,Date.now()))})
   .subscribe();channelRef.current=channel;
  return()=>{clearTimeout(timer);channelRef.current=null;void supabase.removeChannel(channel)}},[id,load]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 // Text and ordinary attachments become read when this conversation is open.
 // One-time snaps are deliberately excluded: their receipt is claimed only by sx_claim_snap.
 useFocusEffect(useCallback(()=>{if(!uid)return;const ids=rows.filter(m=>m.sender_id!==uid&&m.kind!=='snap'&&m.kind!=='system').map(m=>m.id);if(!ids.length)return;let active=true;void (async()=>{const {data,error}=await supabase.from('sx_receipts').select('message_id').eq('user_id',uid).in('message_id',ids);if(error||!active)return;const read=new Set((data||[]).map(x=>x.message_id));const at=new Date().toISOString();const pending=ids.filter(message_id=>!read.has(message_id)).map(message_id=>({message_id,user_id:uid,opened_at:at,replay_count:0}));if(pending.length){const result=await supabase.from('sx_receipts').insert(pending);if(result.error&&active)setNotice(friendlyError(result.error));else if(active)setViewedAt(v=>({...v,...Object.fromEntries(pending.map(x=>[x.message_id,Date.parse(at)]))}))}})();return()=>{active=false}},[rows,uid]));

 // Screenshot notification (native only; expo-screen-capture has no web screenshot event).
 // Best-effort: a live DB without 20261013150000_chat_step4 rejects kind='system' (23514); never show that as an error.
 const postSystem=useCallback(async(text:string)=>{const row=systemMessageRow(id,uid,text);if(!row)return;const {error}=await supabase.from('sx_messages').insert(row);if(error){if(!isSilentSystemMessageError(error))setNotice(friendlyError(error));else console.warn('[chat] system line skipped',error.code)}else void load()},[id,uid,load]);
 useEffect(()=>{if(Platform.OS==='web'||!uid)return;const sub=ScreenCapture.addScreenshotListener(()=>{const t=Date.now();if(!shouldReportScreenshot(lastShot.current,t))return;lastShot.current=t;void postSystem(screenshotText(session?.user.user_metadata?.display_name||'Je vriend',false))});return()=>sub.remove()},[uid,postSystem,session?.user.user_metadata?.display_name]);

 // Auto-stop voice notes at the max length.
 useEffect(()=>{if(recorderState.isRecording&&recorderState.durationMillis>=VOICE_MAX_MS)void stopRecording(true)},[recorderState.isRecording,recorderState.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

 const visible=useMemo(()=>rows.filter(m=>m.sender_id===uid||m.kind==='system'||isMessageVisible(retention,viewedAt[m.id]??null,now,{saved:m.saved,leftAt:viewedAt[m.id]!==undefined&&viewedAt[m.id]<sessionStart?sessionStart:null})),[rows,uid,retention,viewedAt,now,sessionStart]);
 const streak=useMemo(()=>computeStreak(rows.filter(m=>m.kind==='snap').map(m=>({senderId:m.sender_id,at:Date.parse(m.created_at)})),uid,peers.length===1?peers[0].id:'',now,-new Date().getTimezoneOffset()),[rows,uid,peers,now]);
 const typing=typingText(activeTypers(typingMap,now,uid).map(u=>peers.find(p=>p.id===u)?.name||'Iemand'));
 // Avatars (step 8): header portrait for 1-op-1, sticker messages drawn with the sender's outfit.
 const ownOutfit=useOwnOutfit(uid),friendOutfits=useFriendOutfits(peers.map(p=>p.id)),[stickerOpen,setStickerOpen]=useState(false);
 const outfitOf=(sender:string)=>{if(sender===uid)return ownOutfit;const o=friendOutfits.get(sender);return o&&o!=='pending'?o:null};
 const isGroup=isGroupThread({title:threadTitle,memberCount:members.length||peers.length+1});
 const title=isGroup?groupDisplayTitle(threadTitle,peers.map(p=>p.name)):peers.length===1?peers[0].name:'Chat';

 async function createMessage(kind:Message['kind'],text:string|null,path:string|null){if(!session)return;if(!id)throw new Error('Deze chat kon niet worden geopend.');const {error}=await supabase.from('sx_messages').insert({thread_id:id,sender_id:uid,body:text,kind,media_path:path,expires_at:retention==='keep'?null:new Date(Date.now()+86400000).toISOString()});if(error)throw error;await load()}
 function onChangeBody(v:string){setBody(v);const t=Date.now();if(shouldSendTyping(lastTyping.current,t,v)){lastTyping.current=t;void channelRef.current?.send({type:'broadcast',event:'typing',payload:{user:uid,typing:true}})}}
 function stopTyping(){lastTyping.current=null;void channelRef.current?.send({type:'broadcast',event:'typing',payload:{user:uid,typing:false}})}
 // Quoted reply (Snapchat "Antwoorden"): set by swipe-right or the long-press menu; the quote travels inside the body.
 const [replyTo,setReplyTo]=useState<Message|null>(null),inputRef=useRef<TextInput>(null);
 const startReply=(m:Message)=>{setReplyTo(m);setTimeout(()=>inputRef.current?.focus(),50)};
 async function send(){const text=body.trim();if(!text||busy)return;setBusy(true);try{await createMessage('text',replyTo?replyBody(replyTo,text):text,null);setBody('');setReplyTo(null);stopTyping()}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function sendSticker(id:Parameters<typeof chatStickerBody>[0]){if(busy)return;setBusy(true);try{await createMessage('text',chatStickerBody(id),null)}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function pickMedia(){if(busy)return;try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.8});if(result.canceled)return;setBusy(true);const asset=result.assets[0],kind=asset.type==='video'?'video':'photo';const path=await uploadMedia(asset.uri,kind);await createMessage(kind,null,path)}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function startRecording(){if(busy)return;try{const p=await AudioModule.requestRecordingPermissionsAsync();if(!p.granted)throw new Error('Microfoontoegang nodig');await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true});await recorder.prepareToRecordAsync();recorder.record()}catch(e){setNotice(friendlyError(e))}}
 async function stopRecording(sendIt:boolean){const dur=recorderState.durationMillis;setBusy(true);try{await recorder.stop();await setAudioModeAsync({allowsRecording:false});if(!sendIt)return;if(!keepRecording(dur)){setNotice('Te kort — houd langer vast om op te nemen');return}if(recorder.uri){const path=await uploadMedia(recorder.uri,'voice');await createMessage('voice',null,path)}}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function openSnap(message:Message){if(!session||!message.media_path)return;if(message.view_once&&message.sender_id!==uid){const {data,error}=await supabase.rpc('sx_claim_snap',{p_message_id:message.id});if(error){setNotice(friendlyError(error));return}if(!data){setNotice('Deze snap is verlopen of al twee keer bekeken.');return}}if(message.sender_id!==uid){const again=viewedAt[message.id]!==undefined;setViewedAt(v=>({...v,[message.id]:v[message.id]??Date.now()}));if(again)setReplays(v=>({...v,[message.id]:(v[message.id]??0)+1}))}setOpened(v=>({...v,[message.id]:true}));const ms=openDurationMs(message.view_seconds,message.view_once);if(ms!==null)setTimeout(()=>setOpened(v=>({...v,[message.id]:false})),ms)}
 async function react(messageId:string,emoji:string){const before=reactions,next=toggleReaction(reactions,messageId,uid,emoji);setReactions(next);const mine=next.find(r=>r.messageId===messageId&&r.userId===uid);const {error}=mine?await supabase.from('sx_reactions').upsert({message_id:messageId,user_id:uid,emoji:mine.emoji},{onConflict:'message_id,user_id'}):await supabase.from('sx_reactions').delete().eq('message_id',messageId).eq('user_id',uid);if(error){setReactions(before);setNotice(friendlyError(error))}}
 // Opslaan in chat (long-press menu): optimistic grey highlight, server decides (sx_set_message_saved), revert on error.
 async function setSaved(m:Message,saved:boolean){const before=rows;setRows(r=>applySaved(r,m.id,saved,uid));const {error}=await supabase.rpc('sx_set_message_saved',{p_message_id:m.id,p_saved:saved});if(error){setRows(before);setNotice(friendlyError(error))}else void load()}
 async function changeRetention(mode:RetentionMode){if(mode===retention)return;const prev=retention;setRetention(mode);const {error}=await supabase.rpc('sx_set_retention',{p_thread_id:id,p_mode:mode,p_text:retentionChangeText(session?.user.user_metadata?.display_name||'Iemand',mode)});if(error){setRetention(prev);setNotice(friendlyError(error))}else void load()}
 function blockSender(senderId:string){if(!session)return;confirm.ask({title:'Gebruiker blokkeren?',message:'Jullie kunnen elkaar dan niet meer berichten. In een groepschat worden berichten van deze gebruiker verborgen.',confirmLabel:'Blokkeren',destructive:true},async()=>{const {error}=await supabase.from('sx_blocks').insert({blocker_id:uid,blocked_id:senderId});if(error)return friendlyError(error);setNotice('Gebruiker geblokkeerd');await load();return null})}
 // Snaps render as a Snapchat status line (red/purple ■ or ➤), never as an inline photo until tapped.
 const snapBubble=(item:Message,mine:boolean)=>{const st=messageStatus(item,uid,peerOpened.has(item.id),viewedAt[item.id]!==undefined);const showing=!!opened[item.id]&&!!item.media_path;
  if(!mine&&st.unopened&&!item.media_path)return <Text style={[s.text,s.muted]}>{emptyMessageText(item)}</Text>;
  const canReplay=!mine&&!!item.media_path&&(replays[item.id]??0)<1;const tappable=showing||(!mine&&!!item.media_path&&(st.unopened||canReplay));
  // Tap an open snap to close it (Snapchat); otherwise tap opens / replays it.
  return <Pressable onPress={()=>showing?setOpened(v=>({...v,[item.id]:false})):void openSnap(item)} disabled={!tappable} accessibilityHint={showing?'Tik om de snap te sluiten':undefined} testID={`snap-${st.shape}-${st.filled?'new':'opened'}`}><View style={s.snapRow}><StatusIcon status={st} size={16}/><Text style={[s.snapText,{color:st.unopened&&!mine?STATUS_COLOR[st.tone]:C.text}]}>{snapLine(st,showing,canReplay)}</Text></View>{showing&&<Media path={item.media_path!} type={item.body==='video'?'video':'photo'} style={s.image} ttl={90}/>}</Pressable>};
 const content=(item:Message,mine:boolean)=><>{item.kind==='snap'?snapBubble(item,mine):item.kind==='voice'&&item.media_path?<AudioClip path={item.media_path} seed={item.id} mine={mine}/>:item.media_path?<><Media path={item.media_path} type={item.kind==='video'?'video':'photo'} style={s.image}/><Text style={s.mediaHint}>Blijft zichtbaar in dit gesprek — geen eenmalige snap</Text></>:(()=>{const st=stickerFromChatBody(item.body);const empty=emptyMessageText(item);return st?<ChatAvatarSticker sticker={st} outfit={outfitOf(item.sender_id)}/>:empty?<Text style={[s.text,s.muted]}>{empty}</Text>:<Text style={s.text}>{item.body}</Text>})()}</>;
 // Report + block moved from inline links into the long-press / right-click menu (Snapchat-style).
 const menu=(item:Message,mine:boolean)=>{const save=saveAction(item,uid);const items:{label:string;onPress:()=>void}[]=messageMenuActions(mine).filter(a=>a!=='reply'||item.kind!=='system').map(a=>a==='reply'?{label:MENU_LABEL.reply,onPress:()=>startReply(item)}:a==='report'?{label:MENU_LABEL.report,onPress:()=>router.push({pathname:'/report',params:{message_id:item.id}})}:{label:MENU_LABEL.block,onPress:()=>blockSender(item.sender_id)});
  // Snapchat order: Antwoorden, Opslaan in chat, then report/block.
  if(save)items.splice(items[0]?.label===MENU_LABEL.reply?1:0,0,{label:SAVE_LABEL[save],onPress:()=>void setSaved(item,save==='save')});return items};
 const nameOf=(sid:string)=>members.find(m=>m.id===sid)?.name??peers.find(p=>p.id===sid)?.name??null;
 const avatarOf=(sid:string)=><FriendAvatar id={sid} outfit={sid===uid?ownOutfit:friendOutfits.get(sid)} size={22} name={nameOf(sid)??undefined}/>;
 return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={90}>
  <Stack.Screen options={{headerShown:false,title}}/>
  <ChatHeaderBar onBack={()=>router.canGoBack()?router.back():router.replace('/(tabs)/chats')} topInset={insets.top} title={title} streak={streak} retention={retention} onRetention={()=>setRetentionOpen(true)} onCall={()=>router.push({pathname:'/call/[id]',params:{id:String(id),name:title}})} avatar={!isGroup&&peers.length===1?<FriendAvatar id={peers[0].id} outfit={friendOutfits.get(peers[0].id)} size={34} name={peers[0].name}/>:undefined} onInfo={isGroup?()=>setInfoOpen(true):undefined} onProfile={!isGroup&&peers.length===1?()=>router.push({pathname:'/friend/[id]',params:{id:peers[0].id}}):undefined} memberCount={isGroup?members.length:undefined}/>
  <ChatView receipt={(()=>{const last=visible.find(m=>m.kind!=='system');return last&&last.sender_id===uid&&last.kind!=='snap'?{messageId:last.id,status:messageStatus(last,uid,peerOpened.has(last.id),false)}:null})()} rows={visible} me={uid} reactions={reactions} retention={retention} viewedAt={viewedAt} now={now} streak={streak} typing={typing} renderContent={content} onReact={(m,e)=>void react(m,e)} extraActions={menu} onReply={startReply} nameOf={nameOf} avatarOf={avatarOf} memberIds={members.length?members.map(m=>m.id):[uid,...peers.map(p=>p.id)]}/>
  {!!notice&&<Text style={s.notice}>{notice}</Text>}
  {recorderState.isRecording?<RecordingBar durationMs={recorderState.durationMillis} level={meterLevel(recorderState.metering)} onCancel={()=>void stopRecording(false)} onStop={()=>void stopRecording(true)}/>:
  <View>{replyTo&&(()=>{const ids=members.length?members.map(m=>m.id):[uid,...peers.map(p=>p.id)];return <ReplyBar title={replyBarTitle(replyTo.sender_id,uid,nameOf(replyTo.sender_id))} color={colorFor(replyTo.sender_id,senderColors(ids,uid))} excerpt={quoteOf(replyTo).excerpt} onCancel={()=>setReplyTo(null)}/>})()}<View style={s.inputRow}><Pressable onPress={pickMedia} disabled={busy}><Text style={s.action}>＋</Text></Pressable><TextInput style={s.input} ref={inputRef} placeholder={replyTo?'Antwoord…':'Bericht…'} placeholderTextColor={C.muted} value={body} onChangeText={onChangeBody} onBlur={stopTyping} multiline/><Pressable onPress={()=>setStickerOpen(true)} disabled={busy} accessibilityLabel="Avatarsticker sturen"><Text style={s.action}>☺</Text></Pressable><Pressable onPress={startRecording} disabled={busy} accessibilityLabel="Spraakbericht opnemen"><Text style={s.action}>🎙</Text></Pressable><Pressable onPress={send} disabled={busy} accessibilityLabel="Versturen" testID="chat-send"><Text style={s.send}>➤</Text></Pressable></View></View>}
  <AvatarStickerSheet visible={stickerOpen} outfit={ownOutfit} onPick={st=>void sendSticker(st.id)} onClose={()=>setStickerOpen(false)}/>
  <RetentionSheet visible={retentionOpen} mode={retention} onPick={m=>void changeRetention(m)} onClose={()=>setRetentionOpen(false)}/>
  {isGroup&&infoOpen&&<GroupInfoSheet visible threadId={id} me={uid} title={title} creatorId={creatorId} members={members} onClose={()=>setInfoOpen(false)} onChanged={()=>{void loadMeta();void load()}} onLeft={()=>{setInfoOpen(false);router.replace('/(tabs)/chats')}}/>}
  {confirm.dialog}</KeyboardAvoidingView>
}
function AudioClip({path,seed,mine}:{path:string;seed:string;mine:boolean}){const [url,setUrl]=useState<string|null>(null);useEffect(()=>{let alive=true;mediaUrl(path).then(v=>{if(alive)setUrl(v)}).catch(()=>{});return()=>{alive=false}},[path]);return url?<VoiceNotePlayer uri={url} seed={seed} mine={mine}/>:<Hint>Audio laden…</Hint>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},text:{color:C.text,fontSize:16},image:{width:220,height:300,borderRadius:12},mediaHint:{color:C.muted,fontSize:11,marginTop:4,maxWidth:220},inputRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,padding:12},input:{flex:1,color:C.text,backgroundColor:C.elevated,borderRadius:20,padding:12,maxHeight:130},send:{color:C.yellow,fontSize:30,marginLeft:8},action:{fontSize:24,color:C.yellow,marginHorizontal:7},notice:{color:C.yellow,textAlign:'center'},muted:{color:C.muted,fontStyle:'italic'},snapRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},snapText:{fontSize:15,fontWeight:'700'}});
