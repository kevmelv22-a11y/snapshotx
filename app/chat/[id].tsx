import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import { MEDIA_LABEL } from '../../lib/media-access';
import {KeyboardAvoidingView,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,router,useFocusEffect,useLocalSearchParams} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioRecorder,useAudioRecorderState} from 'expo-audio';
import type {RealtimeChannel} from '@supabase/supabase-js';
import {supabase} from '../../lib/supabase';
import {uploadMedia,mediaUrl,removeMedia} from '../../lib/media';
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
import {isVisibleAsSent,isVisibleForEveryone,leaveEvents,nameResolver,pendingOldTimers,receiptIndex,sentModes,timerStarts,type ReceiptRow} from '../../lib/chat-retention';
import {VOICE_MAX_MS,activeTypers,applyTyping,computeStreak,keepRecording,meterLevel,parseRetention,retentionChangeText,screenshotText,shouldReportScreenshot,shouldSendTyping,toggleReaction,typingText,type Reaction,type RetentionMode,type TypingMap} from '../../lib/chat-features';

import {friendlyError} from '../../lib/db-errors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MENU_LABEL,colorFor,emptyMessageText,messageMenuActions,senderColors} from '../../lib/chat-senders';
import {quoteOf,replyBarTitle,replyBody} from '../../lib/chat-replies';
import {EditBar,ReplyBar} from '../../components/chat/ChatReply';
import {EDIT_LABEL,UNSEND_CONFIRM,applyEdit,applyUnsend,canEdit,canUnsend,editableText,isNoopEdit,validateEdit} from '../../lib/chat-edits';
import {STATUS_COLOR,messageStatus,snapLine} from '../../lib/chat-status';
import {StatusIcon} from '../../components/chat/StatusIcon';
import {SAVE_LABEL,applySaved,saveAction} from '../../lib/chat-saves';
import {groupDisplayTitle,isGroupThread} from '../../lib/group-chat';
import {GroupInfoSheet,type GroupMember} from '../../components/chat/GroupInfoSheet';
import {MemberRoleIcon,useMemberActions} from '../../components/chat/MemberActionSheet';
import {MentionPicker,MentionText} from '../../components/chat/MentionPicker';
import {MENTION_BADGE,insertMention,latestUnreadMentionId,mentionCandidates,mentionLabel,mentionQuery,type MentionMember} from '../../lib/chat-mentions';
import {PollBubble,PollComposer} from '../../components/chat/PollParts';
import {POLL_LABEL,applyVote,nextVote,parsePoll,tallyPoll,type PollVote} from '../../lib/chat-polls';
import {ForwardSheet} from '../../components/chat/ForwardSheet';
import {FORWARD_LABEL,canForward} from '../../lib/chat-forward';
import {isSilentSystemMessageError,systemMessageRow,threadIdFromParam} from '../../lib/chat-ids';
import {WallpaperSheet} from '../../components/chat/WallpaperSheet';
import type {WallpaperId} from '../../lib/plus';
import {PHOTO_WALLPAPER,parseChatWallpaper,photoWallpaperChange,staleWallpaperPhoto,photoHiddenByBlock,wallpaperBlockedError,wallpaperChange,wallpaperChangeText,wallpaperErrorText,type ChatWallpaperId,type PhotoWallpaper} from '../../lib/chat-wallpaper';
export default function Chat(){
 const confirm=useConfirmDialog(),insets=useSafeAreaInsets();
 const {id:rawId,sheet}=useLocalSearchParams<{id:string|string[];sheet?:string}>(),id=threadIdFromParam(rawId)??'',{session}=useSession(),uid=session?.user.id??'';
 const [rows,setRows]=useState<Message[]>([]),[body,setBody]=useState(''),[notice,setNotice]=useState(id?'':'Deze chat kon niet worden geopend.'),[busy,setBusy]=useState(false),[opened,setOpened]=useState<Record<string,boolean>>({});
 const [retention,setRetention]=useState<RetentionMode>('24h'),[retentionOpen,setRetentionOpen]=useState(false);
 // Snapchat+ Chat-achtergrond: shared by everyone in the chat (sx_threads.wallpaper, migration 20261028150000); everyone in the chat can change it (no X+ needed).
 const [wallpaper,setWallpaper]=useState<ChatWallpaperId>('none'),[wpPhoto,setWpPhoto]=useState<PhotoWallpaper|null>(null),[wpPhotoUri,setWpPhotoUri]=useState<{path:string;uri:string}|null>(null),[wallpaperOpen,setWallpaperOpen]=useState(sheet==='wallpaper'),[wallpaperBusy,setWallpaperBusy]=useState(false);
 const [threadReceipts,setThreadReceipts]=useState<ReceiptRow[]>([]);
 // Names of people with receipts here (also members who left): resolves "A heeft X uit de groep verwijderd" to X's id.
 const [receiptNames,setReceiptNames]=useState<{id:string;name:string}[]>([]);
 const [viewedAt,setViewedAt]=useState<Record<string,number>>({}),[reactions,setReactions]=useState<Reaction[]>([]);
 // Peilingen: votes on poll messages in this thread (needs migration 20261027150000_chat_polls.sql on a real backend).
 const [votes,setVotes]=useState<PollVote[]>([]),[pollOpen,setPollOpen]=useState(false);
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
  // Snapchat: the deletion timer starts once EVERYONE has viewed a chat → read every member's receipt (RLS sx_receipts_read allows members).
  const chats=list.filter(m=>m.kind!=='system'&&m.kind!=='snap').map(m=>m.id);
  if(chats.length){const r=await supabase.from('sx_receipts').select('message_id,user_id,opened_at').in('message_id',chats);if(!r.error){const rs=(r.data||[]) as ReceiptRow[];setThreadReceipts(rs);const who=[...new Set(rs.map(x=>x.user_id))];const p=who.length?await supabase.from('profiles').select('id,display_name').in('id',who):null;if(p&&!p.error)setReceiptNames((p.data||[]).map(x=>({id:x.id as string,name:String(x.display_name??'')})))}}
  // Reactions need migration 20261013150000_chat_step4.sql; without it the query errors and reactions stay empty.
  const ids=list.map(m=>m.id);if(ids.length){const r=await supabase.from('sx_reactions').select('message_id,user_id,emoji').in('message_id',ids);if(!r.error)setReactions((r.data||[]).map(x=>({messageId:x.message_id,userId:x.user_id,emoji:x.emoji})))}
  const polls=list.filter(m=>m.kind==='text'&&parsePoll(m.body)).map(m=>m.id);if(polls.length){const v=await supabase.from('sx_poll_votes').select('message_id,user_id,option_index').in('message_id',polls);if(!v.error)setVotes((v.data||[]).map(x=>({messageId:x.message_id,userId:x.user_id,option:Number(x.option_index)})))}
 },[id,uid]);
 // Thread meta: retention setting, group name/creator + members (names for typing, streak partner, Groepsinfo).
 const [threadTitle,setThreadTitle]=useState<string|null>(null),[creatorId,setCreatorId]=useState<string|null>(null),[members,setMembers]=useState<GroupMember[]>([]),[removers,setRemovers]=useState<string[]>([]),[infoOpen,setInfoOpen]=useState(false);
 const loadMeta=useCallback(async(alive:()=>boolean=()=>true)=>{if(!id||!uid)return;const t=await supabase.from('sx_threads').select('retention_mode,title,created_by').eq('id',id).maybeSingle();if(alive()&&!t.error){setRetention(parseRetention(t.data?.retention_mode));setThreadTitle(t.data?.title??null);setCreatorId(t.data?.created_by??null)}
  // can_remove_members needs migration 20261027200000; without it fall back to plain membership (no remove rights).
  let m:{data:{user_id:string;can_remove_members?:boolean|null}[]|null}=await supabase.from('sx_members').select('user_id,can_remove_members').eq('thread_id',id);if((m as {error?:unknown}).error)m=await supabase.from('sx_members').select('user_id').eq('thread_id',id);if(alive())setRemovers((m.data||[]).filter(x=>x.can_remove_members).map(x=>x.user_id));const all=[...new Set((m.data||[]).map(x=>x.user_id as string))];const ids=all.filter(x=>x!==uid);const p=all.length?await supabase.from('profiles').select('id,display_name').in('id',all):null;const names=new Map((p?.data||[]).map(x=>[x.id,x.display_name]));if(!alive())return;
  setPeers(ids.map(x=>({id:x,name:names.get(x)||'Vriend'})));setMembers(all.map(x=>({id:x,name:x===uid?(names.get(x)||session?.user.user_metadata?.display_name||'Jij'):(names.get(x)||'Vriend')})))},[id,uid,session?.user.user_metadata?.display_name]);
 useEffect(()=>{let alive=true;const timer=setTimeout(()=>void loadMeta(()=>alive),0);return()=>{alive=false;clearTimeout(timer)}},[loadMeta]);
 // Every photo change goes through setPhoto: when MY old wallpaper photo is replaced or removed (by me or another member,
 // seen live), it is deleted from storage so old wallpaper photos don't pile up (lib/chat-wallpaper.ts staleWallpaperPhoto).
 // Blocking (lib/chat-wallpaper.ts): no wallpaper changes in a chat with someone I blocked, and their photo wallpaper is hidden for me.
 const [myBlocks,setMyBlocks]=useState<string[]>([]);
 const loadBlocks=useCallback(async()=>{if(!uid)return;const b=await supabase.from('sx_blocks').select('blocked_id').eq('blocker_id',uid);if(!b.error)setMyBlocks((b.data??[]).map(x=>String((x as {blocked_id:string}).blocked_id)))},[uid]);
 useEffect(()=>{const timer=setTimeout(()=>void loadBlocks(),0);return()=>clearTimeout(timer)},[loadBlocks]);
 const wpPhotoRef=useRef<PhotoWallpaper|null>(null);
 const setPhoto=useCallback((p:PhotoWallpaper|null)=>{const old=staleWallpaperPhoto(wpPhotoRef.current,p?.path,uid);wpPhotoRef.current=p;setWpPhoto(p);if(old)void removeMedia([old])},[uid]);
 // Separate select: a backend without the wallpaper column just keeps the normal background (retention/title still load).
 // Photo wallpaper (20261028180000): wallpaper_path/_blur; a backend without those columns falls back to the preset-only select.
 const loadWallpaper=useCallback(async(alive:()=>boolean=()=>true)=>{if(!id)return;let w=await supabase.from('sx_threads').select('wallpaper,wallpaper_path,wallpaper_blur').eq('id',id).maybeSingle();if(w.error)w=await supabase.from('sx_threads').select('wallpaper').eq('id',id).maybeSingle();
  if(alive()&&!w.error){const v=parseChatWallpaper(w.data as {wallpaper?:unknown}|null);setWallpaper(v.id);setPhoto(v.photo)}},[id,setPhoto]);
 // Signed URL for the photo (members may read it via sx_media_read); unreadable → normal background.
 useEffect(()=>{const path=wpPhoto?.path;if(!path||wpPhotoUri?.path===path)return;let alive=true;mediaUrl(path,3600).then(uri=>{if(alive)setWpPhotoUri({path,uri})},()=>{});return()=>{alive=false}},[wpPhoto?.path,wpPhotoUri?.path]);
 const photoHidden=photoHiddenByBlock(wpPhoto,myBlocks);
 const photoUri=wpPhoto&&!photoHidden&&wpPhotoUri?.path===wpPhoto.path?wpPhotoUri.uri:null;
 function wallpaperBlocked():boolean{const e=wallpaperBlockedError(memberIds,uid,myBlocks);if(e){setNotice(e);setWallpaperOpen(false)}return !!e}
 useEffect(()=>{let alive=true;const timer=setTimeout(()=>void loadWallpaper(()=>alive),0);return()=>{alive=false;clearTimeout(timer)}},[loadWallpaper]);
 async function changeWallpaper(next:WallpaperId){if(wallpaperBusy||wallpaperBlocked())return;const c=wallpaperChange(wallpaper,next);if(!c.ok){if(c.error)setNotice(c.error);setWallpaperOpen(false);return}
  const prev=wallpaper;setWallpaper(c.id);setWallpaperOpen(false);setWallpaperBusy(true);
  try{const {error}=await supabase.rpc('sx_set_wallpaper',{p_thread_id:id,p_wallpaper:c.id,p_text:wallpaperChangeText(session?.user.user_metadata?.display_name||'Iemand',c.id)});if(error){setWallpaper(prev);setNotice(wallpaperErrorText(error)??friendlyError(error))}else{setPhoto(null);void load()}}finally{setWallpaperBusy(false)}}
 async function applyPhotoWallpaper(next:PhotoWallpaper):Promise<boolean>{const c=photoWallpaperChange({id:wallpaper,photo:wpPhoto},next,uid,session?.user.user_metadata?.display_name||'Iemand');if(!c.ok){if(c.error)setNotice(c.error);return false}
  const {error}=await supabase.rpc('sx_set_wallpaper_photo',{p_thread_id:id,p_path:c.photo.path,p_blur:c.photo.blur,p_text:c.line});if(error){setNotice(wallpaperErrorText(error)??friendlyError(error));return false}
  setWallpaper(PHOTO_WALLPAPER);setPhoto(c.photo);if(c.line)void load();return true}
 // Snapchat+: pick a photo from the Camera Roll (9:16 crop on iOS/Android), upload it to my own media folder, share it as the chat wallpaper.
 // An upload that didn't become the wallpaper (rejected / error) is deleted again, so it never lingers in storage.
 async function pickWallpaperPhoto(){if(wallpaperBusy||wallpaperBlocked())return;let unused='';
  try{const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.8,allowsEditing:true,aspect:[9,16]});if(r.canceled||!r.assets?.[0])return;setWallpaperBusy(true);
   const path=await uploadMedia(r.assets[0].uri,'photo');unused=path;if(await applyPhotoWallpaper({path,blur:wpPhoto?.blur??false}))unused=''}catch(e){setNotice(friendlyError(e))}finally{if(unused)void removeMedia([unused]);setWallpaperBusy(false)}}
 async function setWallpaperBlur(blur:boolean){if(wallpaperBusy||!wpPhoto||wallpaperBlocked())return;setWallpaperBusy(true);try{await applyPhotoWallpaper({path:wpPhoto.path,blur})}finally{setWallpaperBusy(false)}}
 useEffect(()=>{if(!id)return;const timer=setTimeout(()=>void load(),0);
  const channel=supabase.channel(`sx-thread-${id}`)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_messages',filter:`thread_id=eq.${id}`},()=>{void load();void loadWallpaper()})
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'sx_threads',filter:`id=eq.${id}`},()=>void loadWallpaper())
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'sx_messages',filter:`thread_id=eq.${id}`},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'sx_members'},()=>void loadMeta())
   .on('postgres_changes',{event:'*',schema:'public',table:'sx_reactions'},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'sx_poll_votes'},()=>void load())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_receipts'},()=>void load())
   .on('broadcast',{event:'typing'},({payload})=>{const p=payload as {user:string;typing:boolean};if(p?.user)setTypingMap(m=>applyTyping(m,p.user,!!p.typing,Date.now()))})
   .subscribe();channelRef.current=channel;
  return()=>{clearTimeout(timer);channelRef.current=null;void supabase.removeChannel(channel)}},[id,load,loadMeta,loadWallpaper]);
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

 // Snapchat: each chat keeps the "Chats verwijderen" setting it was SENT with; a new setting only applies going forward (lib/chat-retention.ts).
 const sentWith=useMemo(()=>sentModes(rows,retention),[rows,retention]);
 // Snapchat: "deleted 24 hours after EVERYONE in the conversation has viewed the Chat … or 31 days after it was sent".
 // The timer starts at the last member's view (not yours), for your own chats too; snaps keep their own (status line) rules.
 const memberIds=useMemo(()=>members.length?members.map(m=>m.id):[uid,...peers.map(p=>p.id)],[members,peers,uid]);
 // A member who leaves / is removed without viewing completes "everyone viewed" at that moment → the 24 h starts then (lib/chat-retention.ts leaveEvents).
 const leaves=useMemo(()=>leaveEvents(rows,nameResolver([...receiptNames,...members])),[rows,receiptNames,members]);
 const starts=useMemo(()=>timerStarts(rows.filter(m=>m.kind!=='snap'),memberIds,receiptIndex(threadReceipts),uid,viewedAt,leaves),[rows,memberIds,threadReceipts,uid,viewedAt,leaves]);
 const visible=useMemo(()=>rows.filter(m=>m.kind==='system'||(m.kind==='snap'?m.sender_id===uid||isVisibleAsSent(m,sentWith[m.id]??retention,viewedAt[m.id]??null,now,viewedAt[m.id]!==undefined&&viewedAt[m.id]<sessionStart?sessionStart:null):isVisibleForEveryone(m,sentWith[m.id]??retention,starts[m.id]??null,now,sessionStart))),[rows,uid,retention,sentWith,viewedAt,starts,now,sessionStart]);
 const oldTimers=useMemo(()=>pendingOldTimers(visible,sentWith,retention),[visible,sentWith,retention]);
 const streak=useMemo(()=>computeStreak(rows.filter(m=>m.kind==='snap').map(m=>({senderId:m.sender_id,at:Date.parse(m.created_at)})),uid,peers.length===1?peers[0].id:'',now,-new Date().getTimezoneOffset()),[rows,uid,peers,now]);
 const typing=typingText(activeTypers(typingMap,now,uid).map(u=>peers.find(p=>p.id===u)?.name||'Iemand'));
 // Avatars (step 8): header portrait for 1-op-1, sticker messages drawn with the sender's outfit.
 const ownOutfit=useOwnOutfit(uid),friendOutfits=useFriendOutfits(peers.map(p=>p.id)),[stickerOpen,setStickerOpen]=useState(false);
 const outfitOf=(sender:string)=>{if(sender===uid)return ownOutfit;const o=friendOutfits.get(sender);return o&&o!=='pending'?o:null};
 const isGroup=isGroupThread({title:threadTitle,memberCount:members.length||peers.length+1});
 const title=isGroup?groupDisplayTitle(threadTitle,peers.map(p=>p.name)):peers.length===1?peers[0].name:'Chat';

 async function createMessage(kind:Message['kind'],text:string|null,path:string|null){if(!session)return;if(!id)throw new Error('Deze chat kon niet worden geopend.');const {error}=await supabase.from('sx_messages').insert({thread_id:id,sender_id:uid,body:text,kind,media_path:path,expires_at:retention==='keep'?null:new Date(Date.now()+86400000).toISOString()});if(error)throw error;await load()}
 function onChangeBody(v:string){const delta=v.length-body.length;setCaret(c=>Math.max(0,Math.min(v.length,(c??body.length)+delta)));setBody(v);const t=Date.now();if(shouldSendTyping(lastTyping.current,t,v)){lastTyping.current=t;void channelRef.current?.send({type:'broadcast',event:'typing',payload:{user:uid,typing:true}})}}
 function stopTyping(){lastTyping.current=null;void channelRef.current?.send({type:'broadcast',event:'typing',payload:{user:uid,typing:false}})}
 // @vermeldingen (group chats): caret tracking → active "@query" → member picker; picking inserts "@Voornaam ".
 const [caret,setCaret]=useState<number|null>(null),[forcedSel,setForcedSel]=useState<{start:number;end:number}|null>(null);
 const mentionMembers:MentionMember[]=useMemo(()=>members.map(m=>({id:m.id,name:m.name})),[members]);
 const colorMap=useMemo(()=>senderColors(members.length?members.map(m=>m.id):[uid,...peers.map(p=>p.id)],uid),[members,peers,uid]);
 const mq=isGroup?mentionQuery(body,caret??body.length):null;
 const candidates=mq?mentionCandidates(mentionMembers,uid,mq.query):[];
 function pickMention(m:MentionMember){if(!mq)return;const next=insertMention(body,mq.start,caret??body.length,mentionLabel(m,mentionMembers));setBody(next.text);setCaret(next.caret);setForcedSel({start:next.caret,end:next.caret});setTimeout(()=>{inputRef.current?.focus();setForcedSel(null)},60)}
 // Jump-to-latest-unread-@mention (group only, local — no backend): latch newest unread id in a ref (survives focus marking receipts read); dismiss flag hides the chip after tap.
 const mentionLatch=useRef<string|null>(null),[mentionDismissed,setMentionDismissed]=useState(false),[jumpRequestId,setJumpRequestId]=useState<string|null>(null);
 if(!mentionLatch.current&&isGroup&&uid&&rows.length&&mentionMembers.length){const id=latestUnreadMentionId(rows,uid,new Set(Object.keys(viewedAt)),mentionMembers);if(id)mentionLatch.current=id}
 const mentionJumpId=!mentionDismissed?mentionLatch.current:null;
 function jumpToMention(){if(!mentionJumpId)return;setJumpRequestId(mentionJumpId);setMentionDismissed(true);setTimeout(()=>setJumpRequestId(null),400)}
 // Quoted reply (Snapchat "Antwoorden"): set by swipe-right or the long-press menu; the quote travels inside the body.
 const [replyTo,setReplyTo]=useState<Message|null>(null),inputRef=useRef<TextInput>(null);
 const startReply=(m:Message)=>{setEditing(null);setReplyTo(m);setTimeout(()=>inputRef.current?.focus(),50)};
 // Snapchat Bewerken (own text, first 5 min): input gets the text + "Bericht bewerken" bar; ➤ saves via sx_edit_message.
 const [editing,setEditing]=useState<Message|null>(null);
 // Doorsturen: the message being forwarded (opens the "Doorsturen naar…" sheet).
 const [forwarding,setForwarding]=useState<Message|null>(null);
 const startEdit=(m:Message)=>{setReplyTo(null);setEditing(m);const t=editableText(m);setBody(t);setCaret(t.length);setTimeout(()=>inputRef.current?.focus(),50)};
 const cancelEdit=()=>{setEditing(null);setBody('');setCaret(0)};
 async function saveEdit(m:Message){const v=validateEdit(body);if(!v.ok){setNotice(v.error);return}if(isNoopEdit(m,v.text)){cancelEdit();return}const before=rows;setBusy(true);setRows(r=>applyEdit(r,m.id,v.text,new Date().toISOString()));cancelEdit();stopTyping();try{const {error}=await supabase.rpc('sx_edit_message',{p_message_id:m.id,p_text:v.text});if(error){setRows(before);setNotice(friendlyError(error))}else void load()}finally{setBusy(false)}}
 // Snapchat Verwijderen (own messages): confirm → gone for everyone, grey "<naam> heeft een chat verwijderd" line stays.
 function unsend(m:Message){confirm.ask({title:UNSEND_CONFIRM.title,message:UNSEND_CONFIRM.body,confirmLabel:UNSEND_CONFIRM.ok,destructive:true},async()=>{const before=rows;setRows(r=>applyUnsend(r,m.id,session?.user.user_metadata?.display_name,new Date().toISOString()));if(editing?.id===m.id)cancelEdit();if(replyTo?.id===m.id)setReplyTo(null);const {error}=await supabase.rpc('sx_unsend_message',{p_message_id:m.id});if(error){setRows(before);return friendlyError(error)}void load();return null})}
 async function send(){if(editing){if(!busy)void saveEdit(editing);return}const text=body.trim();if(!text||busy)return;setBusy(true);try{await createMessage('text',replyTo?replyBody(replyTo,text):text,null);setBody('');setCaret(0);setReplyTo(null);stopTyping()}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function sendSticker(id:Parameters<typeof chatStickerBody>[0]){if(busy)return;setBusy(true);try{await createMessage('text',chatStickerBody(id),null)}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function pickMedia(){if(busy)return;try{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.8});if(result.canceled)return;setBusy(true);const asset=result.assets[0],kind=asset.type==='video'?'video':'photo';const path=await uploadMedia(asset.uri,kind);await createMessage(kind,null,path)}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function startRecording(){if(busy)return;try{const p=await AudioModule.requestRecordingPermissionsAsync();if(!p.granted)throw new Error('Microfoontoegang nodig');await setAudioModeAsync({playsInSilentMode:true,allowsRecording:true});await recorder.prepareToRecordAsync();recorder.record()}catch(e){setNotice(friendlyError(e))}}
 async function stopRecording(sendIt:boolean){const dur=recorderState.durationMillis;setBusy(true);try{await recorder.stop();await setAudioModeAsync({allowsRecording:false});if(!sendIt)return;if(!keepRecording(dur)){setNotice('Te kort — houd langer vast om op te nemen');return}if(recorder.uri){const path=await uploadMedia(recorder.uri,'voice');await createMessage('voice',null,path)}}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 async function openSnap(message:Message){if(!session||!message.media_path)return;if(message.view_once&&message.sender_id!==uid){const {data,error}=await supabase.rpc('sx_claim_snap',{p_message_id:message.id});if(error){setNotice(friendlyError(error));return}if(!data){setNotice('Deze snap is verlopen of al twee keer bekeken.');return}}if(message.sender_id!==uid){const again=viewedAt[message.id]!==undefined;setViewedAt(v=>({...v,[message.id]:v[message.id]??Date.now()}));if(again)setReplays(v=>({...v,[message.id]:(v[message.id]??0)+1}))}setOpened(v=>({...v,[message.id]:true}));const ms=openDurationMs(message.view_seconds,message.view_once);if(ms!==null)setTimeout(()=>setOpened(v=>({...v,[message.id]:false})),ms)}
 async function react(messageId:string,emoji:string){const before=reactions,next=toggleReaction(reactions,messageId,uid,emoji);setReactions(next);const mine=next.find(r=>r.messageId===messageId&&r.userId===uid);const {error}=mine?await supabase.from('sx_reactions').upsert({message_id:messageId,user_id:uid,emoji:mine.emoji},{onConflict:'message_id,user_id'}):await supabase.from('sx_reactions').delete().eq('message_id',messageId).eq('user_id',uid);if(error){setReactions(before);setNotice(friendlyError(error))}}
 // Peiling: tap an answer = vote / switch, tap your own answer again = take it back. Optimistic, server decides (sx_vote_poll).
 async function vote(m:Message,option:number){if(!uid)return;const before=votes,next=nextVote(votes,m.id,uid,option);setVotes(v=>applyVote(v,m.id,uid,next));const {error}=await supabase.rpc('sx_vote_poll',{p_message_id:m.id,p_option:next});if(error){setVotes(before);setNotice(friendlyError(error))}}
 async function sendPoll(text:string){if(busy)return;setPollOpen(false);setBusy(true);try{await createMessage('text',text,null)}catch(e){setNotice(friendlyError(e))}finally{setBusy(false)}}
 // Opslaan in chat (long-press menu): optimistic grey highlight, server decides (sx_set_message_saved), revert on error.
 async function setSaved(m:Message,saved:boolean){const before=rows;setRows(r=>applySaved(r,m.id,saved,uid));const {error}=await supabase.rpc('sx_set_message_saved',{p_message_id:m.id,p_saved:saved});if(error){setRows(before);setNotice(friendlyError(error))}else void load()}
 async function changeRetention(mode:RetentionMode){if(mode===retention)return;const prev=retention;setRetention(mode);const {error}=await supabase.rpc('sx_set_retention',{p_thread_id:id,p_mode:mode,p_text:retentionChangeText(session?.user.user_metadata?.display_name||'Iemand',mode)});if(error){setRetention(prev);setNotice(friendlyError(error))}else void load()}
 function blockSender(senderId:string){if(!session)return;confirm.ask({title:'Gebruiker blokkeren?',message:'Jullie kunnen elkaar dan niet meer berichten. In een groepschat worden berichten van deze gebruiker verborgen.',confirmLabel:'Blokkeren',destructive:true},async()=>{const {error}=await supabase.from('sx_blocks').insert({blocker_id:uid,blocked_id:senderId});if(error)return friendlyError(error);setNotice('Gebruiker geblokkeerd');await load();await loadBlocks();return null})}
 // Snaps render as a Snapchat status line (red/purple ■ or ➤), never as an inline photo until tapped.
 const snapBubble=(item:Message,mine:boolean)=>{const st=messageStatus(item,uid,peerOpened.has(item.id),viewedAt[item.id]!==undefined);const showing=!!opened[item.id]&&!!item.media_path;
  if(!mine&&st.unopened&&!item.media_path)return <Text style={[s.text,s.muted]}>{emptyMessageText(item)}</Text>;
  const canReplay=!mine&&!!item.media_path&&(replays[item.id]??0)<1;const tappable=showing||(!mine&&!!item.media_path&&(st.unopened||canReplay));
  // Tap an open snap to close it (Snapchat); otherwise tap opens / replays it.
  return <Pressable onPress={()=>showing?setOpened(v=>({...v,[item.id]:false})):void openSnap(item)} disabled={!tappable} accessibilityHint={showing?'Tik om de snap te sluiten':undefined} testID={`snap-${st.shape}-${st.filled?'new':'opened'}`}><View style={s.snapRow}><StatusIcon status={st} size={16}/><Text style={[s.snapText,{color:st.unopened&&!mine?STATUS_COLOR[st.tone]:C.text}]}>{snapLine(st,showing,canReplay)}</Text></View>{showing&&<Media path={item.media_path!} type={item.body==='video'?'video':'photo'} style={s.image} ttl={90}/>}</Pressable>};
 const content=(item:Message,mine:boolean)=><>{item.kind==='snap'?snapBubble(item,mine):item.kind==='voice'&&item.media_path?<AudioClip path={item.media_path} seed={item.id} mine={mine}/>:item.media_path?<><Media path={item.media_path} type={item.kind==='video'?'video':'photo'} style={s.image}/><Text style={s.mediaHint}>Blijft zichtbaar in dit gesprek — geen eenmalige snap</Text></>:(()=>{const poll=item.kind==='text'?parsePoll(item.body):null;if(poll)return <PollBubble poll={poll} result={tallyPoll(poll,votes,item.id,uid)} senderId={item.sender_id} me={uid} color={colorFor(item.sender_id,colorMap)} onVote={o=>void vote(item,o)} avatarOf={sid=><FriendAvatar id={sid} outfit={sid===uid?ownOutfit:friendOutfits.get(sid)} size={18} name={nameOf(sid)??undefined}/>}/>;const st=stickerFromChatBody(item.body);const empty=emptyMessageText(item);return st?<ChatAvatarSticker sticker={st} outfit={outfitOf(item.sender_id)}/>:empty?<Text style={[s.text,s.muted]}>{empty}</Text>:isGroup&&item.body?.includes('@')?<MentionText body={item.body} members={mentionMembers} me={uid} colorOf={id=>colorFor(id,colorMap)} style={s.text}/>:<Text style={s.text}>{item.body}</Text>})()}</>;
 // Report + block moved from inline links into the long-press / right-click menu (Snapchat-style).
 const menu=(item:Message,mine:boolean)=>{const save=saveAction(item,uid);const items:{label:string;onPress:()=>void}[]=messageMenuActions(mine).filter(a=>a!=='reply'||item.kind!=='system').map(a=>a==='reply'?{label:MENU_LABEL.reply,onPress:()=>startReply(item)}:a==='report'?{label:MENU_LABEL.report,onPress:()=>router.push({pathname:'/report',params:{message_id:item.id,user_id:item.sender_id,name:nameOf(item.sender_id)??''}})}:{label:MENU_LABEL.block,onPress:()=>blockSender(item.sender_id)});
  // Snapchat order: Antwoorden, Opslaan in chat, then report/block.
  if(save)items.splice(items[0]?.label===MENU_LABEL.reply?1:0,0,{label:SAVE_LABEL[save],onPress:()=>void setSaved(item,save==='save')});
  // Own messages: Bewerken (text, first 5 minutes) right after Antwoorden; Verwijderen last.
  if(canEdit(item,uid,Date.now()))items.splice(items[0]?.label===MENU_LABEL.reply?1:0,0,{label:EDIT_LABEL.edit,onPress:()=>startEdit(item)});
  // Doorsturen (Snapchat Forward): after Opslaan in chat / before Melden; not for snaps, polls, system lines.
  if(canForward(item)){const at=items.findIndex(a=>a.label===MENU_LABEL.report||a.label===MENU_LABEL.block||a.label===EDIT_LABEL.unsend);items.splice(at<0?items.length:at,0,{label:FORWARD_LABEL.action,onPress:()=>setForwarding(item)})}
  if(canUnsend(item,uid))items.push({label:EDIT_LABEL.unsend,onPress:()=>unsend(item)});return items};
 const memberMenu=useMemberActions({threadId:String(id??''),me:uid,adminId:creatorId,members,removers,onChanged:()=>{void loadMeta();void load()}});
 const nameOf=(sid:string)=>members.find(m=>m.id===sid)?.name??peers.find(p=>p.id===sid)?.name??null;
 const avatarOf=(sid:string)=><FriendAvatar id={sid} outfit={sid===uid?ownOutfit:friendOutfits.get(sid)} size={22} name={nameOf(sid)??undefined}/>;
 return <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={90}>
  <Stack.Screen options={{headerShown:false,title}}/>
  <ChatHeaderBar onBack={()=>router.canGoBack()?router.back():router.replace('/(tabs)/chats')} topInset={insets.top} title={title} streak={streak} retention={retention} onRetention={()=>setRetentionOpen(true)} onCall={()=>router.push({pathname:'/call/[id]',params:{id:String(id),name:title}})} avatar={!isGroup&&peers.length===1?<FriendAvatar id={peers[0].id} outfit={friendOutfits.get(peers[0].id)} size={34} name={peers[0].name}/>:undefined} onInfo={isGroup?()=>setInfoOpen(true):undefined} onProfile={!isGroup&&peers.length===1?()=>router.push({pathname:'/friend/[id]',params:{id:peers[0].id}}):undefined} memberCount={isGroup?members.length:undefined}/>
  <ChatView wallpaper={photoHidden?'none':wallpaper} wallpaperPhoto={photoUri&&wpPhoto?{uri:photoUri,blur:wpPhoto.blur}:null} onSenderLongPress={isGroup?sid=>memberMenu.open(members.find(m=>m.id===sid)):undefined} badgeOf={isGroup?sid=><MemberRoleIcon isAdmin={sid===creatorId} canRemove={removers.includes(sid)} size={12}/>:undefined} receipt={(()=>{const last=visible.find(m=>m.kind!=='system');return last&&last.sender_id===uid&&last.kind!=='snap'?{messageId:last.id,status:messageStatus(last,uid,peerOpened.has(last.id),false)}:null})()} rows={visible} me={uid} reactions={reactions} retention={retention} retentionOf={m=>sentWith[m.id]??retention} viewedAt={viewedAt} timerStart={starts} now={now} streak={streak} typing={typing} renderContent={content} onReact={(m,e)=>void react(m,e)} extraActions={menu} onReply={startReply} nameOf={nameOf} avatarOf={avatarOf} memberIds={memberIds} jumpRequestId={jumpRequestId}/>
  {isGroup&&!!mentionJumpId&&<Pressable style={s.mentionJump} testID="jump-mention" accessibilityRole="button" accessibilityLabel={MENTION_BADGE} onPress={jumpToMention}><Text style={s.mentionJumpAt}>@</Text><Text style={s.mentionJumpText}>{MENTION_BADGE}</Text></Pressable>}
  {!!notice&&<Text style={s.notice}>{notice}</Text>}
  {recorderState.isRecording?<RecordingBar durationMs={recorderState.durationMillis} level={meterLevel(recorderState.metering)} onCancel={()=>void stopRecording(false)} onStop={()=>void stopRecording(true)}/>:
  <View>{isGroup&&<MentionPicker candidates={candidates} members={mentionMembers} colorOf={id=>colorFor(id,colorMap)} avatarOf={sid=><FriendAvatar id={sid} outfit={friendOutfits.get(sid)} size={32} name={nameOf(sid)??undefined}/>} onPick={pickMention}/>}{editing&&<EditBar excerpt={editableText(editing)} onCancel={cancelEdit}/>}{replyTo&&(()=>{const ids=members.length?members.map(m=>m.id):[uid,...peers.map(p=>p.id)];return <ReplyBar title={replyBarTitle(replyTo.sender_id,uid,nameOf(replyTo.sender_id))} color={colorFor(replyTo.sender_id,senderColors(ids,uid))} excerpt={quoteOf(replyTo).excerpt} onCancel={()=>setReplyTo(null)}/>})()}<View style={s.inputRow}><Pressable onPress={pickMedia} disabled={busy}><Text style={s.action}>＋</Text></Pressable><TextInput style={s.input} ref={inputRef} placeholder={editing?'Bewerk je bericht…':replyTo?'Antwoord…':'Bericht…'} placeholderTextColor={C.muted} value={body} onChangeText={onChangeBody} onSelectionChange={e=>setCaret(e.nativeEvent.selection.end)} selection={forcedSel??undefined} testID="chat-input" onBlur={stopTyping} multiline/>{isGroup&&!editing&&<Pressable onPress={()=>setPollOpen(true)} disabled={busy} accessibilityLabel={POLL_LABEL.button} testID="poll-button" style={{marginHorizontal:7}}><Ionicons name="stats-chart" size={22} color={C.yellow}/></Pressable>}<Pressable onPress={()=>setStickerOpen(true)} disabled={busy} accessibilityLabel="Avatarsticker sturen"><Text style={s.action}>☺</Text></Pressable><Pressable onPress={startRecording} disabled={busy} accessibilityLabel="Spraakbericht opnemen"><Text style={s.action}>🎙</Text></Pressable><Pressable onPress={send} disabled={busy} accessibilityLabel={editing?"Bewerking opslaan":"Versturen"} testID="chat-send"><Text style={s.send}>➤</Text></Pressable></View></View>}
  <AvatarStickerSheet visible={stickerOpen} outfit={ownOutfit} onPick={st=>void sendSticker(st.id)} onClose={()=>setStickerOpen(false)}/>
  {isGroup&&<PollComposer visible={pollOpen} onClose={()=>setPollOpen(false)} onSend={b=>void sendPoll(b)}/>}
  {forwarding&&<ForwardSheet me={uid} myName={(session?.user.user_metadata?.display_name as string|undefined)??null} threadId={id} messageId={forwarding.id} excerpt={quoteOf(forwarding).excerpt} onClose={()=>setForwarding(null)} onDone={t=>{setForwarding(null);setNotice(t);setTimeout(()=>setNotice(n=>n===t?'':n),3500)}}/>}
  <WallpaperSheet visible={wallpaperOpen} current={wallpaper} busy={wallpaperBusy} onPick={w=>void changeWallpaper(w)} photo={wpPhoto?{uri:photoUri,blur:wpPhoto.blur}:null} onPickPhoto={()=>void pickWallpaperPhoto()} onBlur={b=>void setWallpaperBlur(b)} onClose={()=>setWallpaperOpen(false)}/>
  <RetentionSheet visible={retentionOpen} mode={retention} oldTimers={oldTimers} onPick={m=>void changeRetention(m)} onClose={()=>setRetentionOpen(false)}/>
  {isGroup&&memberMenu.sheet}
  {isGroup&&infoOpen&&<GroupInfoSheet visible threadId={id} me={uid} title={title} creatorId={creatorId} members={members} removers={removers} onClose={()=>setInfoOpen(false)} onChanged={()=>{void loadMeta();void load()}} onLeft={()=>{setInfoOpen(false);router.replace('/(tabs)/chats')}} wallpaperLabel={wallpaper} onWallpaper={()=>{setInfoOpen(false);setWallpaperOpen(true)}}/>}
  {confirm.dialog}</KeyboardAvoidingView>
}
function AudioClip({path,seed,mine}:{path:string;seed:string;mine:boolean}){const [url,setUrl]=useState<string|null>(null);const [gonePath,setGonePath]=useState<string|null>(null);useEffect(()=>{let alive=true;mediaUrl(path).then(v=>{if(alive)setUrl(v)}).catch(()=>{if(alive)setGonePath(path)});return()=>{alive=false}},[path]);return url?<VoiceNotePlayer uri={url} seed={seed} mine={mine}/>:<Hint>{gonePath===path?`🔇 ${MEDIA_LABEL.gone}`:'Audio laden…'}</Hint>}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},mentionJump:{position:'absolute',alignSelf:'center',top:72,zIndex:6,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFFC00',borderRadius:20,paddingHorizontal:14,paddingVertical:9,shadowColor:'#000',shadowOpacity:.25,shadowRadius:8,elevation:6},mentionJumpAt:{color:'#000',fontSize:16,fontWeight:'900'},mentionJumpText:{color:'#000',fontSize:13,fontWeight:'800'},text:{color:C.text,fontSize:16},image:{width:220,height:300,borderRadius:12},mediaHint:{color:C.muted,fontSize:11,marginTop:4,maxWidth:220},inputRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,padding:12},input:{flex:1,color:C.text,backgroundColor:C.elevated,borderRadius:20,padding:12,maxHeight:130},send:{color:C.yellow,fontSize:30,marginLeft:8},action:{fontSize:24,color:C.yellow,marginHorizontal:7},notice:{color:C.yellow,textAlign:'center'},muted:{color:C.muted,fontStyle:'italic'},snapRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},snapText:{fontSize:15,fontWeight:'700'}});
