import {supabase} from './supabase';
import {chatPreviewText} from './avatar/poses';

export type ChatRow = {
  id:string;
  title:string;
  preview:string;
  status:string;
  createdAt:string|null;
  peerIds:string[];
  isGroup:boolean;
  unread:boolean;
  demo?:boolean;
};

// Preview-only content: it never gets uploaded or mixed with Supabase rows.
export const DEMO_CHATS:ChatRow[] = [
  {id:'demo-aria',title:'Aria Nova',preview:'Die foto van gister was geweldig ✨',status:'Nieuw bericht',createdAt:new Date(Date.now()-12*60000).toISOString(),peerIds:[],isGroup:false,unread:true,demo:true},
  {id:'demo-crew',title:'De Nachtrit',preview:'Milan: We spreken om acht uur af',status:'Groepschat',createdAt:new Date(Date.now()-2*3600000).toISOString(),peerIds:[],isGroup:true,unread:false,demo:true},
  {id:'demo-jules',title:'Jules',preview:'Foto verstuurd',status:'Verzonden',createdAt:new Date(Date.now()-86400000).toISOString(),peerIds:[],isGroup:false,unread:false,demo:true},
];
export const AI_DEMO:ChatRow = {id:'local-ai',title:'Nova · lokale demo',preview:'Probeer een voorbeeldgesprek',status:'Geen AI-verbinding',createdAt:null,peerIds:[],isGroup:false,unread:false,demo:true};

export async function loadChatRows(uid:string):Promise<ChatRow[]> {
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
  const profiles=peerIds.length?await supabase.from('profiles').select('id,display_name').in('id',peerIds):null;
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
  return (threads.data||[]).map(thread=>{
    const people=peers.filter(x=>x.thread_id===thread.id).map(x=>x.user_id);
    const last=latest.get(thread.id);
    const unread=unreadThreads.has(thread.id);
    const preview=!last?'Nieuw gesprek':last.kind==='system'?(last.body||'Melding'):last.kind==='text'?(chatPreviewText(last.body)||'Bericht'):last.kind==='snap'?'Snap ontvangen':last.kind==='voice'?'Spraakbericht':last.kind==='video'?'Video':'Foto';
    return {id:thread.id,title:thread.title||people.map(id=>names.get(id)||'Vriend').join(', ')||'Chat',preview,status:!last?'Begin een gesprek':last.sender_id===uid?(unread?'Eerder ongelezen':'Verzonden'):unread?'Nieuw bericht':'Ontvangen',createdAt:last?.created_at||null,peerIds:people,isGroup:people.length>1||!!thread.title,unread};
  }).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
}
