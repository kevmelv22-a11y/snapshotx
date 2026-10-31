import {useEffect,useRef,useState} from 'react';
import {Platform,useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {useNotifyPrefs} from '../../hooks/useNotifyPrefs';
import {shouldNotify} from '../../lib/notification-prefs';
import {isMuted} from '../../lib/chat-mute';
import {useChatFeed} from '../../stores/chatFeed';
import {isSplitLayout} from '../../lib/web-layout';
import {WEB_NOTIFY_KEY,permissionOf,shouldWebNotify,webNotifyContent,type BrowserPermission} from '../../lib/web-notify';

type NotificationCtor={new(title:string,o?:{body?:string;tag?:string;icon?:string}):{onclick:(()=>void)|null;close:()=>void};permission?:string;requestPermission?:()=>Promise<string>};
const G=globalThis as {Notification?:NotificationCtor;localStorage?:{getItem:(k:string)=>string|null;setItem:(k:string,v:string)=>void};document?:{hidden?:boolean;visibilityState?:string};focus?:()=>void};
const listeners=new Set<(on:boolean)=>void>();

export function browserPermission():BrowserPermission{return Platform.OS==='web'?permissionOf(G.Notification):'unsupported'}
export function webNotifyOn():boolean{try{return G.localStorage?.getItem(WEB_NOTIFY_KEY)==='1'}catch{return false}}
/** Switch on (asks the browser for permission) or off for this browser. Returns the resulting permission. */
export async function setWebNotify(on:boolean):Promise<BrowserPermission>{
 let perm=browserPermission();
 if(on&&perm==='default'&&G.Notification?.requestPermission){try{perm=permissionOf({permission:await G.Notification.requestPermission()})}catch{/* stays default */}}
 const value=on&&perm==='granted';
 try{G.localStorage?.setItem(WEB_NOTIFY_KEY,value?'1':'0')}catch{/* private mode */}
 listeners.forEach(l=>l(value));return perm;
}
export function useWebNotifyOn(){const [on,setOn]=useState(webNotifyOn);useEffect(()=>{listeners.add(setOn);return()=>{listeners.delete(setOn)}},[]);return on}

/** Web only, signed in: shows "Noor — stuurde je een chat" while the tab is in the background; click opens the chat. */
export function WebNotifier({uid}:{uid:string}){
 const on=useWebNotifyOn(),{prefs}=useNotifyPrefs(uid),mutes=useChatFeed(st=>st.mutes?.[uid]),{width}=useWindowDimensions();
 const ctx=useRef({prefs,mutes,split:false});
 useEffect(()=>{ctx.current={prefs,mutes,split:isSplitLayout(width,Platform.OS)}},[prefs,mutes,width]);
 useEffect(()=>{if(Platform.OS!=='web'||!on||!G.Notification)return;
  const ch=supabase.channel(`sx-web-notify-${uid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_messages'},(p:{new?:{sender_id?:string;thread_id?:string;kind?:string}})=>void (async()=>{
   const m=p.new??{},thread=String(m.thread_id??''),c=ctx.current,hidden=!!G.document?.hidden||G.document?.visibilityState==='hidden';
   if(!thread||!shouldWebNotify({browserOn:webNotifyOn(),permission:browserPermission(),hidden,prefsAllow:shouldNotify(c.prefs,'chats'),muted:isMuted(c.mutes,thread),senderId:m.sender_id,me:uid,kind:m.kind}))return;
   const [who,t]=await Promise.all([supabase.from('profiles').select('display_name').eq('id',m.sender_id!).maybeSingle(),supabase.from('sx_threads').select('title').eq('id',thread).maybeSingle()]);
   const text=webNotifyContent((who.data as {display_name?:string}|null)?.display_name,m.kind,(t.data as {title?:string|null}|null)?.title);
   try{const n=new G.Notification!(text.title,{body:text.body,tag:`sx-chat-${thread}`,icon:'/icons/icon-192.png'});
    n.onclick=()=>{try{G.focus?.()}catch{/* ignore */}if(ctx.current.split)router.push({pathname:'/(tabs)/chats',params:{chat:thread}});else router.push({pathname:'/chat/[id]',params:{id:thread}});n.close()}}catch{/* blocked by the browser */}
  })()).subscribe();
  return()=>{void supabase.removeChannel(ch)}},[on,uid]);
 return null;
}
