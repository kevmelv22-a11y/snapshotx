import React,{useEffect,useState} from 'react';
import {Share,Text,View} from 'react-native';
import {Stack,router} from 'expo-router';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import {Media} from '../components/Media';
import {FriendAvatar} from '../components/avatar/FriendAvatar';
import {useOwnOutfit} from '../hooks/useWardrobeSync';
import {useFriendOutfits} from '../hooks/useFriendOutfits';
import {HighlightFeed,type HighlightItem,type HighlightSocial} from '../components/spotlight/HighlightFeed';
import {rankFeed,shareText} from '../lib/spotlight';
import {commentCount,commentThread,toggleCommentLike,toggleSubscription,type SpotComment,type SpotCommentLike} from '../lib/spotlight-social';

import {friendlyError} from '../lib/db-errors';
/** Public vertical feed. Needs migration 20261013170100_stories_highlights.sql (sx_highlight_feed RPC, likes, shares)
 * and — for comments + Abonneren — 20261022180000_spotlight_social.sql (not applied to live yet). */
export default function Uitgelicht(){
 const {session}=useSession(),me=session?.user.id;
 const [items,setItems]=useState<HighlightItem[]|null>(null),[names,setNames]=useState<Record<string,string>>({}),[err,setErr]=useState('');
 const [comments,setComments]=useState<SpotComment[]>([]),[cLikes,setCLikes]=useState<SpotCommentLike[]>([]),[subs,setSubs]=useState<Set<string>>(new Set()),[blocked,setBlocked]=useState<Set<string>>(new Set()),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!me)return;let on=true;(async()=>{const {data,error}=await supabase.rpc('sx_highlight_feed',{p_limit:60});if(!on)return;if(error){setErr(friendlyError(error));setItems([]);return}
  const ranked=rankFeed((data||[]) as HighlightItem[],Date.now());setItems(ranked);
  const storyIds=ranked.map(i=>i.id);
  // Social layer: when the migration isn't applied these queries fail → the feed still works, just without comments.
  const [c,s,b]=await Promise.all([storyIds.length?supabase.from('sx_highlight_comments').select('id,story_id,user_id,body,created_at').in('story_id',storyIds).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
   supabase.from('sx_creator_subscriptions').select('creator_id').eq('subscriber_id',me),supabase.from('sx_blocks').select('blocked_id').eq('blocker_id',me)]);
  if(!on)return;
  const list=(c.data||[]) as SpotComment[];setComments(list);
  if(list.length){const l=await supabase.from('sx_highlight_comment_likes').select('comment_id,user_id').in('comment_id',list.map(x=>x.id));if(on)setCLikes((l.data||[]) as SpotCommentLike[])}
  const subSet=new Set((s.data||[]).map((x:{creator_id:string})=>x.creator_id));setSubs(subSet);setItems(ranked.map(i=>({...i,subscribedAtLoad:subSet.has(i.owner_id)})));
  setBlocked(new Set((b.data||[]).map((x:{blocked_id:string})=>x.blocked_id)));
  const ids=[...new Set([...ranked.map(i=>i.owner_id),...list.map(x=>x.user_id)])];if(ids.length){const p=await supabase.from('profiles').select('id,display_name').in('id',ids);if(on&&p.data)setNames(Object.fromEntries(p.data.map(x=>[x.id,x.display_name])))}})();return()=>{on=false}},[me]);
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
 return <View style={{flex:1,backgroundColor:'#000'}}><Stack.Screen options={{headerShown:false}}/>{items===null?<Text style={{color:'white',padding:30}}>Laden…</Text>:<>
  <HighlightFeed items={items} names={names} social={social} onClose={()=>router.back()} renderMedia={i=><Media path={i.media_path} type={i.media_type} style={{flex:1}}/>}
   // supabase-js builders are lazy: without await/then the request is never sent (likes were silently dropped before).
   onLike={(i,liked)=>{if(!me)return;void(async()=>{const {error}=liked?await supabase.from('sx_highlight_likes').upsert({story_id:i.id,user_id:me}):await supabase.from('sx_highlight_likes').delete().eq('story_id',i.id).eq('user_id',me);if(error)setErr(friendlyError(error,'Leuk vinden'))})()}}
   onShare={async i=>{try{const r=await Share.share({message:shareText(names[i.owner_id]||'een maker',i.caption)});if(r.action!==Share.sharedAction)return false;if(me)await supabase.from('sx_highlight_shares').insert({story_id:i.id,user_id:me});return true}catch{return false}}}
   onReport={i=>router.push({pathname:'/report',params:{story_id:i.id}})}/>
  {!!err&&<Text style={{color:'#FFE14D',position:'absolute',bottom:20,left:20,right:20}}>{err}</Text>}</>}</View>;
}
