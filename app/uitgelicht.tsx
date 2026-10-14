import React,{useEffect,useState} from 'react';
import {Share,Text,View} from 'react-native';
import {Stack,router} from 'expo-router';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import {Media} from '../components/Media';
import {HighlightFeed,type HighlightItem} from '../components/spotlight/HighlightFeed';
import {rankFeed,shareText} from '../lib/spotlight';

/** Public vertical feed. Needs migration 20261013170100_stories_highlights.sql (sx_highlight_feed RPC, likes, shares). */
export default function Uitgelicht(){
 const {session}=useSession(),me=session?.user.id;
 const [items,setItems]=useState<HighlightItem[]|null>(null),[names,setNames]=useState<Record<string,string>>({}),[err,setErr]=useState('');
 useEffect(()=>{if(!me)return;let on=true;(async()=>{const {data,error}=await supabase.rpc('sx_highlight_feed',{p_limit:60});if(!on)return;if(error){setErr(error.message);setItems([]);return}
  const ranked=rankFeed((data||[]) as HighlightItem[],Date.now());setItems(ranked);const ids=[...new Set(ranked.map(i=>i.owner_id))];if(ids.length){const p=await supabase.from('profiles').select('id,display_name').in('id',ids);if(on&&p.data)setNames(Object.fromEntries(p.data.map(x=>[x.id,x.display_name])))}})();return()=>{on=false}},[me]);
 return <View style={{flex:1,backgroundColor:'#000'}}><Stack.Screen options={{headerShown:false}}/>{items===null?<Text style={{color:'white',padding:30}}>Laden…</Text>:<>
  <HighlightFeed items={items} names={names} onClose={()=>router.back()} renderMedia={i=><Media path={i.media_path} type={i.media_type} style={{flex:1}}/>}
   onLike={(i,liked)=>{if(!me)return;void(liked?supabase.from('sx_highlight_likes').upsert({story_id:i.id,user_id:me}):supabase.from('sx_highlight_likes').delete().eq('story_id',i.id).eq('user_id',me))}}
   onShare={async i=>{try{const r=await Share.share({message:shareText(names[i.owner_id]||'een maker',i.caption)});if(r.action!==Share.sharedAction)return false;if(me)await supabase.from('sx_highlight_shares').insert({story_id:i.id,user_id:me});return true}catch{return false}}}
   onReport={i=>router.push({pathname:'/report',params:{story_id:i.id}})}/>
  {!!err&&<Text style={{color:'#FFE14D',position:'absolute',bottom:20,left:20,right:20}}>{err}</Text>}</>}</View>;
}
