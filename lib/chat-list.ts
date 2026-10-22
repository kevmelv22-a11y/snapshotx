import {supabase} from './supabase';
import {chatPreviewText} from './avatar/poses';
import {replyText} from './chat-replies';
import {hasUnreadMention} from './chat-mentions';
import {threadStatus,threadStreak,type ChatStatus} from './chat-status';
import type {StreakState} from './chat-features';

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
  demo?:boolean;
};

// Preview-only content: it never gets uploaded or mixed with Supabase rows.
export const DEMO_CHATS:ChatRow[] = [
  {id:'demo-aria',title:'Aria Nova',preview:'Die foto van gister was geweldig ✨',status:'Nieuwe snap',createdAt:new Date(Date.now()-12*60000).toISOString(),peerIds:[],isGroup:false,unread:true,demo:true,chatStatus:{tone:'snap',shape:'square',filled:true,label:'Nieuwe snap',mine:false,unopened:true},streak:{count:12,atRisk:false,hoursLeft:null,todayMe:false,todayThem:true}},
  {id:'demo-crew',title:'De Nachtrit',preview:'Milan: We spreken om acht uur af',status:'Ontvangen',createdAt:new Date(Date.now()-2*3600000).toISOString(),peerIds:[],isGroup:true,unread:false,demo:true,chatStatus:{tone:'chat',shape:'square',filled:false,label:'Ontvangen',mine:false,unopened:false}},
  {id:'demo-jules',title:'Jules',preview:'Foto verstuurd',status:'Geopend',createdAt:new Date(Date.now()-86400000).toISOString(),peerIds:[],isGroup:false,unread:false,demo:true,chatStatus:{tone:'snap',shape:'arrow',filled:false,label:'Geopend',mine:true,unopened:false}},
];
export const AI_DEMO:ChatRow = {id:'local-ai',title:'Nova · lokale demo',preview:'Probeer een voorbeeldgesprek',status:'Geen AI-verbinding',createdAt:null,peerIds:[],isGroup:false,unread:false,demo:true};

export async function loadChatRows(uid:string,myName?:string|null):Promise<ChatRow[]> {
  const members=await supabase.from('sx_members').select('thread_id').eq('user_id',uid);
  if(members.error)throw members.error;
  const ids=[...new Set((members.data||[]).map(x=>x.thread_id))];
  if(!ids.length)return [];
  const [threads,participants,messages]=await Promise.all([
    supabase.from('sx_threads').select('id,title').in('id',ids),
    supabase.from('sx_members').select('thread_id,user_id').in('thread_id',ids),
    supabase.from('sx_messages').select('id,thread_id,sender_id,body,kind,created_at').in('thread_id',ids).order('created_at',{ascending:false}).limit(500),
  ]);
  if(threads.error)throw threads.error;
  if(participants.error)throw participants.error;
  if(messages.error)throw messages.error;
  const peers=(participants.data||[]).filter(x=>x.user_id!==uid);
  const peerIds=[...new Set(peers.map(x=>x.user_id))];
  // My own name is needed too: @mentions of me are matched by name.
  const profiles=peerIds.length?await supabase.from('profiles').select('id,display_name').in('id',[...peerIds,uid]):null;
  // Names/read marks are extras: an unavailable table must not hide the chat list itself.
  if(profiles?.error)console.warn('[chat-list] profiles',profiles.error.code,profiles.error.message);
  const names=new Map((profiles?.data||[]).map(x=>[x.id,x.display_name]));
  const latest=new Map<string,NonNullable<typeof messages.data>[number]>();
  for(const message of messages.data||[])if(!latest.has(message.thread_id))latest.set(message.thread_id,message);
  const incoming=(messages.data||[]).filter(x=>x.sender_id!==uid).map(x=>x.id);
  const receipts=incoming.length?await supabase.from('sx_receipts').select('message_id').eq('user_id',uid).in('message_id',incoming):null;
  if(receipts?.error)console.warn('[chat-list] receipts',receipts.error.code,receipts.error.message);
  const read=new Set((receipts?.data||[]).map(x=>x.message_id));
  const unreadThreads=receipts?.error?new Set<string>():new Set((messages.data||[]).filter(x=>x.sender_id!==uid&&!read.has(x.id)).map(x=>x.thread_id));
  // Opened-by-friend marks for my newest message per thread (Bezorgd ➤ vs Geopend ▷). Optional like the read marks.
  const mineLatest=[...latest.values()].filter(x=>x.sender_id===uid&&x.kind!=='system').map(x=>x.id);
  const peerReceipts=mineLatest.length?await supabase.from('sx_receipts').select('message_id,user_id,opened_at').in('message_id',mineLatest).neq('user_id',uid):null;
  if(peerReceipts?.error)console.warn('[chat-list] peer receipts',peerReceipts.error.code,peerReceipts.error.message);
  const peerOpened=new Set((peerReceipts?.data||[]).filter(x=>x.opened_at!==null).map(x=>x.message_id));
  const byThread=new Map<string,NonNullable<typeof messages.data>>();
  for(const message of messages.data||[])(byThread.get(message.thread_id)??byThread.set(message.thread_id,[]).get(message.thread_id)!).push(message);
  const now=Date.now(),offset=-new Date().getTimezoneOffset();
  return (threads.data||[]).map(thread=>{
    const people=peers.filter(x=>x.thread_id===thread.id).map(x=>x.user_id);
    const last=latest.get(thread.id);
    const unread=unreadThreads.has(thread.id);
    const isGroup=people.length>1||!!thread.title;
    const list=byThread.get(thread.id)||[];
    // Without receipts (error) an incoming message counts as opened, so nothing looks falsely "new".
    const chatStatus=threadStatus(list,uid,peerOpened,receipts?.error?new Set(list.map(x=>x.id)):read);
    const streak=isGroup?null:threadStreak(list,uid,people[0]??null,now,offset);
    const members=(participants.data||[]).filter(x=>x.thread_id===thread.id).map(x=>({id:x.user_id as string,name:names.get(x.user_id)??(x.user_id===uid?myName:null)}));
    const mentioned=isGroup&&!receipts?.error&&hasUnreadMention(list,uid,read,members);
    const preview=!last?'Nieuw gesprek':last.kind==='system'?(last.body||'Melding'):last.kind==='text'?(chatPreviewText(replyText(last.body))||'Bericht'):last.kind==='snap'?'Snap ontvangen':last.kind==='voice'?'Spraakbericht':last.kind==='video'?'Video':'Foto';
    return {id:thread.id,title:thread.title||people.map(id=>names.get(id)||'Vriend').join(', ')||'Chat',preview,status:chatStatus.label,chatStatus,streak:streak&&streak.count>0?streak:null,createdAt:last?.created_at||null,peerIds:people,isGroup,unread,mentioned};
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
