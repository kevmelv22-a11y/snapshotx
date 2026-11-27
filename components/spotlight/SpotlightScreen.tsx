import React,{useEffect,useState} from 'react';
import {PROFILE_NAME_COLUMNS,profileNames} from '../../lib/profile-name';
import {Share,Text,View} from 'react-native';
import {Stack,router} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {Media} from '../../components/Media';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {useOwnOutfit} from '../../hooks/useWardrobeSync';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {HighlightFeed,type HighlightItem,type HighlightSocial} from './HighlightFeed';
import {rankFeed,shareText} from '../../lib/spotlight';
import {commentCount,commentThread,toggleCommentLike,toggleSubscription,type SpotComment,type SpotCommentLike} from '../../lib/spotlight-social';

import {friendlyError} from '../../lib/db-errors';
import {SPOT_LABEL,spotlightBody,startFirst} from '../../lib/spotlight-share';
import {ForwardSheet} from '../chat/ForwardSheet';
/** Public vertical feed. Needs migration 20261013170100_stories_highlights.sql (sx_highlight_feed RPC, likes, shares)
 * and — for comments + Abonneren — 20261022180000_spotlight_social.sql (not applied to live yet). */
/** Snapchat Spotlight: full-screen vertical feed of public snaps. `embedded` = the Spotlight tab (no back button, fits above the tab bar). */
export function SpotlightScreen({embedded=false,startId}:{embedded?:boolean;/** Opened from a shared card in chat: this snap first. */startId?:string}){
 const [boxH,setBoxH]=useState<number|null>(null),[sharing,setSharing]=useState<HighlightItem|null>(null);
 const {session}=useSession(),me=session?.user.id;
 const [items,setItems]=useState<HighlightItem[]|null>(null),[names,setNames]=useState<Record<string,string>>({}),[err,setErr]=useState('');
 const [comments,setComments]=useState<SpotComment[]>([]),[cLikes,setCLikes]=useState<SpotCommentLike[]>([]),[subs,setSubs]=useState<Set<string>>(new Set()),[blocked,setBlocked]=useState<Set<string>>(new Set()),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!me)return;let on=true;(async()=>{const {data,error}=await supabase.rpc('sx_highlight_feed',{p_limit:60});if(!on)return;if(error){setErr(friendlyError(error));setItems([]);return}
  const first=startFirst(rankFeed((data||[]) as HighlightItem[],Date.now()),startId);const ranked=first.items;setItems(ranked);if(!first.found)setErr(SPOT_LABEL.gone);
  const storyIds=ranked.map(i=>i.id);
  // Social layer: when the migration isn't applied these queries fail → the feed still works, just without comments.
  const [c,s,b]=await Promise.all([storyIds.length?supabase.from('sx_highlight_comments').select('id,story_id,user_id,body,created_at').in('story_id',storyIds).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
   supabase.from('sx_creator_subscriptions').select('creator_id').eq('subscriber_id',me),supabase.from('sx_blocks').select('blocked_id').eq('blocker_id',me)]);
  if(!on)return;
  const list=(c.data||[]) as SpotComment[];setComments(list);
  if(list.length){const l=await supabase.from('sx_highlight_comment_likes').select('comment_id,user_id').in('comment_id',list.map(x=>x.id));if(on)setCLikes((l.data||[]) as SpotCommentLike[])}
  const subSet=new Set((s.data||[]).map((x:{creator_id:string})=>x.creator_id));setSubs(subSet);setItems(ranked.map(i=>({...i,subscribedAtLoad:subSet.has(i.owner_id)})));
  setBlocked(new Set((b.data||[]).map((x:{blocked_id:string})=>x.blocked_id)));
  const ids=[...new Set([...ranked.map(i=>i.owner_id),...list.map(x=>x.user_id)])];if(ids.length){const p=await supabase.from('profiles').select(PROFILE_NAME_COLUMNS).in('id',ids);if(on&&p.data)setNames(profileNames(p.data))}})();return()=>{on=false}},[me,startId]);
 const ownOutfit=useOwnOutfit(me),outfits=useFriendOutfits(Object.keys(names).filter(id=>id!==me));
 const social:HighlightSocial|undefined=me?{me,now,subscribed:subs,
  thread:i=>commentThread(comments,cLikes,i.id,me,now,blocked),count:i=>commentCount(comments,i.id,blocked),
  avatarOf:(id,size)=><FriendAvatar id={id} outfit={id===me?ownOutfit:outfits.get(id)} size={size} name={names[id]}/>,
  onSubscribe:(owner,on)=>{setSubs(x=>toggleSubscription(x,owner));void(async()=>{const {error}=on?await supabase.from('sx_creator_subscriptions').upsert({subscriber_id:me,creator_id:owner}):await supabase.from('sx_creator_subscriptions').delete().eq('subscriber_id',me).eq('creator_id',owner);if(error){setSubs(x=>toggleSubscription(x,owner));setErr(friendlyError(error,'Abonneren'))}})()},
  onComment:(i,body)=>{const tmp:SpotComment={id:`tmp-${Date.now()}`,story_id:i.id,user_id:me,body,created_at:new Date().toISOString()};setNow(Date.now());setComments(x=>[tmp,...x]);
   void(async()=>{const {data,error}=await supabase.from('sx_highlight_comments').insert({story_id:i.id,user_id:me,body}).select('id,story_id,user_id,body,created_at').single();
    if(error){setComments(x=>x.filter(c=>c.id!==tmp.id));setErr(friendlyError(error,'Reageren'));return}setComments(x=>x.map(c=>c.id===tmp.id?data as SpotComment:c))})()},
  onLikeComment:c=>{if(c.id.startsWith('tmp-'))return;const liked=c.liked;setCLikes(x=>toggleCommentLike(x,c.id,me));void(async()=>{const {error}=liked?await supabase.from('sx_highlight_comment_likes').delete().eq('comment_id',c.id).eq('user_id',me):await supabase.from('sx_highlight_comment_likes').upsert({comment_id:c.id,user_id:me});if(error)setCLikes(x=>toggleCommentLike(x,c.id,me))})()},
  onDeleteComment:c=>{const before=comments;setComments(x=>x.filter(y=>y.id!==c.id));void(async()=>{const {error}=await supabase.from('sx_highlight_comments').delete().eq('id',c.id);if(error){setComments(before);setErr(friendlyError(error,'Verwijderen'))}})()},
 }:undefined;
 async function shareOutside(i:HighlightItem){try{const r=await Share.share({message:shareText(names[i.owner_id]||'een maker',i.caption)});if(r.action!==Share.sharedAction)return false;if(me)await supabase.from('sx_highlight_shares').insert({story_id:i.id,user_id:me});return true}catch{return false}}
 return <View style={{flex:1,backgroundColor:'#000'}} onLayout={e=>{if(embedded)setBoxH(Math.round(e.nativeEvent.layout.height))}}>{!embedded&&<Stack.Screen options={{headerShown:false}}/>}{items===null?<Text style={{color:'white',padding:30}}>Laden…</Text>:<>
  <HighlightFeed items={items} names={names} social={social} title={embedded?'Spotlight':'Uitgelicht'} height={embedded&&boxH?boxH:undefined} onClose={embedded?undefined:()=>router.back()}
   // Only the snap on screen plays: a video further down the feed would otherwise play (with sound) in the background.
   renderMedia={(i,active)=>i.media_type==='video'&&!active?<View style={{flex:1,backgroundColor:'#000'}}/>:<Media path={i.media_path} type={i.media_type} style={{flex:1}}/>}
   // supabase-js builders are lazy: without await/then the request is never sent (likes were silently dropped before).
   onLike={(i,liked)=>{if(!me)return;void(async()=>{const {error}=liked?await supabase.from('sx_highlight_likes').upsert({story_id:i.id,user_id:me}):await supabase.from('sx_highlight_likes').delete().eq('story_id',i.id).eq('user_id',me);if(error)setErr(friendlyError(error,'Leuk vinden'))})()}}
   // Snapchat: Delen opens 'Stuur naar…' (friends/chats) with 'Delen buiten de app' as the system share.
   onShare={async i=>{if(!me)return shareOutside(i);setSharing(i);return false}}
   onReport={i=>router.push({pathname:'/report',params:{story_id:i.id,user_id:i.owner_id,name:names[i.owner_id]??''}})}/>
  {!!sharing&&!!me&&<ForwardSheet me={me} myName={null} threadId="" title={SPOT_LABEL.sheet} excerpt={`${SPOT_LABEL.preview} · @${names[sharing.owner_id]||'maker'}${sharing.caption?` — ${sharing.caption}`:''}`} extra={{label:SPOT_LABEL.outside,onPress:()=>{const i=sharing;setSharing(null);void shareOutside(i)}}} onSendTo={async ids=>{const body=spotlightBody(sharing,names[sharing.owner_id]);if(!body)throw new Error(SPOT_LABEL.gone);for(const t of ids){const {error}=await supabase.from('sx_messages').insert({thread_id:t,sender_id:me,kind:'text',body});if(error)throw error}await supabase.from('sx_highlight_shares').insert({story_id:sharing.id,user_id:me})}} onClose={()=>setSharing(null)} onDone={t=>{setSharing(null);setErr(t.replace(/^Doorgestuurd/,'Verstuurd'))}}/>}
  {!!err&&<Text style={{color:'#FFE14D',position:'absolute',bottom:20,left:20,right:20}}>{err}</Text>}</>}</View>;
}
