import {supabase} from './supabase';
import {chatPreviewText} from './avatar/poses';
import {replyText} from './chat-replies';
import {hasUnreadMention} from './chat-mentions';
import {threadStatus,threadStreak,type ChatStatus} from './chat-status';
import {parseRetention,type StreakState} from './chat-features';
import {listVisibleRows,nameResolver,type ReceiptRow,type RetentionRow} from './chat-retention';
import {relationKinds,type Interaction,type RelationKind} from './friend-emojis';

export type ChatRow = {
  id:string;
  title:string;
  preview:string;
  status:string;
  createdAt:string|null;
  peerIds:string[];
  isGroup:boolean;
  unread:boolean;
  /** Group chats: an unread message @mentions me (Snapchat "@ Je bent vermeld"). */
  mentioned?:boolean;
  /** Snapchat status glyph + label (Nieuwe snap / Bezorgd / Geopend / Ontvangen …). */
  chatStatus?:ChatStatus;
  /** 1-on-1 snap streak (🔥 count, ⌛ when about to expire). */
  streak?:StreakState|null;
  /** 1-on-1 Vriend-emoji relationship (💛 BFF, 😊 Beste vrienden, 👶 Nieuwe vriend …). */
  relation?:RelationKind|null;
  demo?:boolean;
};

// Preview-only content: it never gets uploaded or mixed with Supabase rows.
export const DEMO_CHATS:ChatRow[] = [
  {id:'demo-aria',title:'Aria Nova',preview:'Die foto van gister was geweldig ✨',status:'Nieuwe snap',createdAt:new Date(Date.now()-12*60000).toISOString(),peerIds:[],isGroup:false,unread:true,demo:true,chatStatus:{tone:'snap',shape:'square',filled:true,label:'Nieuwe snap',mine:false,unopened:true},streak:{count:12,atRisk:false,hoursLeft:null,todayMe:false,todayThem:true},relation:'bffs'},
  {id:'demo-crew',title:'De Nachtrit',preview:'Milan: We spreken om acht uur af',status:'Ontvangen',createdAt:new Date(Date.now()-2*3600000).toISOString(),peerIds:[],isGroup:true,unread:false,demo:true,chatStatus:{tone:'chat',shape:'square',filled:false,label:'Ontvangen',mine:false,unopened:false}},
  {id:'demo-jules',title:'Jules',preview:'Foto verstuurd',status:'Geopend',createdAt:new Date(Date.now()-86400000).toISOString(),peerIds:[],isGroup:false,unread:false,demo:true,chatStatus:{tone:'snap',shape:'arrow',filled:false,label:'Geopend',mine:true,unopened:false}},
];
export const AI_DEMO:ChatRow = {id:'local-ai',title:'Nova · lokale demo',preview:'Probeer een voorbeeldgesprek',status:'Geen AI-verbinding',createdAt:null,peerIds:[],isGroup:false,unread:false,demo:true};

export async function loadChatRows(uid:string,myName?:string|null):Promise<ChatRow[]> {
  const members=await supabase.from('sx_members').select('thread_id').eq('user_id',uid);
  if(members.error)throw members.error;
  const ids=[...new Set((members.data||[]).map(x=>x.thread_id))];
  if(!ids.length)return [];
  // retention_mode (threads: 20261013150000, messages: 20261028030000), expires_at and saved drive which chats still exist;
  // older backends without those columns fall back to the plain columns (then only the receipts decide).
  const firstOk=async<R extends {error:unknown}>(...qs:(()=>PromiseLike<R>)[])=>{let r=await qs[0]();for(const q of qs.slice(1)){if(!r.error)break;r=await q()}return r};
  type MsgRow={id:string;thread_id:string;sender_id:string;body:string|null;kind:string;created_at:string;expires_at?:string|null;saved?:boolean|null;retention_mode?:string|null};
  const base='id,thread_id,sender_id,body,kind,created_at';
  const msgQuery=(cols:string)=>()=>supabase.from('sx_messages').select(cols).in('thread_id',ids).order('created_at',{ascending:false}).limit(500) as unknown as PromiseLike<{data:MsgRow[]|null;error:unknown}>;
  const [threads,participants,messages]=await Promise.all([
    firstOk(()=>supabase.from('sx_threads').select('id,title,retention_mode').in('id',ids) as unknown as PromiseLike<{data:{id:string;title:string|null;retention_mode?:string|null}[]|null;error:unknown}>,()=>supabase.from('sx_threads').select('id,title').in('id',ids) as unknown as PromiseLike<{data:{id:string;title:string|null}[]|null;error:unknown}>),
    supabase.from('sx_members').select('thread_id,user_id').in('thread_id',ids),
    firstOk(msgQuery(`${base},expires_at,saved,retention_mode`),msgQuery(`${base},expires_at,saved`),msgQuery(base)),
  ]);
  if(threads.error)throw threads.error;
  if(participants.error)throw participants.error;
  if(messages.error)throw messages.error;
  const peers=(participants.data||[]).filter(x=>x.user_id!==uid);
  const peerIds=[...new Set(peers.map(x=>x.user_id))];
  // Every member's read marks (RLS sx_receipts_read: members of the thread): my own → unread/Ontvangen, others' on my
  // chats → Bezorgd/Geopend, everyone's → Snapchat's "deleted 24 h after everyone viewed" (vanished chats leave the preview).
  const chatIds=(messages.data||[]).filter(x=>x.kind!=='system').map(x=>x.id);
  let receiptRows:ReceiptRow[]=[],receiptError:unknown=null;
  for(let i=0;i<chatIds.length&&!receiptError;i+=150){const r=await supabase.from('sx_receipts').select('message_id,user_id,opened_at').in('message_id',chatIds.slice(i,i+150));if(r.error)receiptError=r.error;else receiptRows=receiptRows.concat((r.data||[]) as ReceiptRow[])}
  if(receiptError){const e=receiptError as {code?:string;message?:string};console.warn('[chat-list] receipts',e.code,e.message);receiptRows=[]}
  // My own name is needed too: @mentions of me are matched by name; members who left (receipts) for "… uit de groep verwijderd".
  const nameIds=[...new Set([...peerIds,...receiptRows.map(x=>x.user_id)])].filter(x=>x!==uid);
  const profiles=nameIds.length?await supabase.from('profiles').select('id,display_name').in('id',[...nameIds,uid]):null;
  // Names/read marks are extras: an unavailable table must not hide the chat list itself.
  if(profiles?.error)console.warn('[chat-list] profiles',profiles.error.code,profiles.error.message);
  const names=new Map((profiles?.data||[]).map(x=>[x.id,x.display_name]));
  const resolve=nameResolver([...names].map(([id,name])=>({id,name})));
  const read=new Set(receiptRows.filter(x=>x.user_id===uid).map(x=>x.message_id));
  const peerOpened=new Set(receiptRows.filter(x=>x.user_id!==uid&&x.opened_at!==null).map(x=>x.message_id));
  const now=Date.now(),offset=-new Date().getTimezoneOffset();
  const threadMode=new Map((threads.data||[]).map(t=>[t.id,parseRetention((t as {retention_mode?:string|null}).retention_mode)]));
  // Snapchat: chats that already disappeared (everyone viewed + 24 h, Na bekijken, server expiry, 31 days) are gone from the feed row too.
  const allRows=messages.data||[];
  const raw=new Map<string,MsgRow[]>();
  for(const message of allRows)(raw.get(message.thread_id)??raw.set(message.thread_id,[]).get(message.thread_id)!).push(message);
  const alive=new Set<string>();
  for(const [tid,list] of raw){const memberIds=(participants.data||[]).filter(x=>x.thread_id===tid).map(x=>x.user_id as string);for(const m of listVisibleRows(list as (MsgRow&RetentionRow)[],threadMode.get(tid)??'24h',memberIds,receiptRows,uid,now,resolve))alive.add(m.id)}
  const visibleMessages=allRows.filter(x=>alive.has(x.id));
  const latest=new Map<string,MsgRow>();
  for(const message of visibleMessages)if(!latest.has(message.thread_id))latest.set(message.thread_id,message);
  const unreadThreads=receiptError?new Set<string>():new Set(visibleMessages.filter(x=>x.sender_id!==uid&&!read.has(x.id)).map(x=>x.thread_id));
  const byThread=new Map<string,MsgRow[]>();
  for(const message of visibleMessages)(byThread.get(message.thread_id)??byThread.set(message.thread_id,[]).get(message.thread_id)!).push(message);
  // Vriend-emoji's: ranked from the 1-on-1 messages above + friendship dates (optional: errors only hide 👶).
  const directPeer=new Map<string,string>();
  for(const thread of threads.data||[]){const people=peers.filter(x=>x.thread_id===thread.id).map(x=>x.user_id);if(people.length===1&&!thread.title)directPeer.set(thread.id,people[0])}
  const interactions:Interaction[]=allRows.filter(x=>directPeer.has(x.thread_id)).map(x=>({peerId:directPeer.get(x.thread_id)!,senderId:x.sender_id,kind:x.kind,at:Date.parse(x.created_at)}));
  const since=await supabase.from('sx_friends').select('friend_id,created_at').eq('user_id',uid);
  if(since.error)console.warn('[chat-list] friends',since.error.code,since.error.message);
  const relations=relationKinds(interactions,uid,now,new Map((since.data||[]).map(x=>[x.friend_id as string,Date.parse(x.created_at)])));
  return (threads.data||[]).map(thread=>{
    const people=peers.filter(x=>x.thread_id===thread.id).map(x=>x.user_id);
    const last=latest.get(thread.id);
    const unread=unreadThreads.has(thread.id);
    const isGroup=people.length>1||!!thread.title;
    const list=byThread.get(thread.id)||[];
    // Without receipts (error) an incoming message counts as opened, so nothing looks falsely "new".
    const chatStatus=threadStatus(list,uid,peerOpened,receiptError?new Set(list.map(x=>x.id)):read);
    const streak=isGroup?null:threadStreak(list,uid,people[0]??null,now,offset);
    const members=(participants.data||[]).filter(x=>x.thread_id===thread.id).map(x=>({id:x.user_id as string,name:names.get(x.user_id)??(x.user_id===uid?myName:null)}));
    const mentioned=isGroup&&!receiptError&&hasUnreadMention(list,uid,read,members);
    const preview=!last?'Nieuw gesprek':last.kind==='system'?(last.body||'Melding'):last.kind==='text'?(chatPreviewText(replyText(last.body))||'Bericht'):last.kind==='snap'?'Snap ontvangen':last.kind==='voice'?'Spraakbericht':last.kind==='video'?'Video':'Foto';
    return {id:thread.id,title:thread.title||people.map(id=>names.get(id)||'Vriend').join(', ')||'Chat',preview,status:chatStatus.label,chatStatus,streak:streak&&streak.count>0?streak:null,createdAt:last?.created_at||raw.get(thread.id)?.[0]?.created_at||null,peerIds:people,isGroup,unread,mentioned,relation:isGroup?null:relations.get(people[0])??null};
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
