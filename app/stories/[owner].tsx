import React,{useCallback,useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {Media} from '../../components/Media';
import {StoryViewer,type ViewerStory} from '../../components/stories/StoryViewer';
import {groupStories,viewersFor,type StoryGroup} from '../../lib/stories';
import type {Story} from '../../lib/types';

/** Story viewer for all active stories, starting at `owner`. Marks views, replies go to the 1:1 chat. */
export default function StoriesViewerScreen(){
 const {owner}=useLocalSearchParams<{owner:string}>(),{session}=useSession(),me=session?.user.id;
 const [groups,setGroups]=useState<StoryGroup<Story>[]|null>(null),[seen,setSeen]=useState<Set<string>>(new Set()),[names,setNames]=useState<Record<string,string>>({}),[start,setStart]=useState(0),[err,setErr]=useState('');
 useEffect(()=>{if(!me)return;let on=true;(async()=>{const now=Date.now();const [st,vw]=await Promise.all([supabase.from('sx_stories').select('*').gt('expires_at',new Date(now).toISOString()).order('created_at').limit(300),supabase.from('sx_story_views').select('story_id').eq('viewer_id',me)]);if(!on)return;if(st.error){setErr(st.error.message);return}
  const seenSet=new Set((vw.data||[]).map(v=>v.story_id as string));const g=groupStories(st.data||[],seenSet,now,me);setSeen(seenSet);setStart(Math.max(0,g.findIndex(x=>x.ownerId===owner)));setGroups(g);
  const ids=g.map(x=>x.ownerId);if(ids.length){const p=await supabase.from('profiles').select('id,display_name').in('id',ids);if(on&&p.data)setNames(Object.fromEntries(p.data.map(x=>[x.id,x.display_name])))}})();return()=>{on=false}},[me,owner]);
 const onViewed=useCallback((s:ViewerStory)=>{if(me&&s.owner_id!==me)void supabase.from('sx_story_views').upsert({story_id:s.id,viewer_id:me})},[me]);
 const loadViewers=useCallback(async(s:ViewerStory)=>{const [v,r]=await Promise.all([supabase.from('sx_story_views').select('story_id,viewer_id,viewed_at').eq('story_id',s.id).order('viewed_at',{ascending:false}).limit(500),supabase.from('sx_story_reactions').select('story_id,user_id,emoji').eq('story_id',s.id)]);const res=viewersFor(s.id,v.data||[],r.data||[],s.owner_id);const ids=res.viewers.map(x=>x.userId).filter(id=>!names[id]);if(ids.length){const p=await supabase.from('profiles').select('id,display_name').in('id',ids);if(p.data)setNames(n=>({...n,...Object.fromEntries(p.data.map(x=>[x.id,x.display_name]))}))}return res},[names]);
 const onReply=useCallback(async(s:ViewerStory,body:string)=>{if(!me)return 'Niet ingelogd';const mine=await supabase.from('sx_members').select('thread_id').eq('user_id',me);if(mine.error)return mine.error.message;const tids=(mine.data||[]).map(x=>x.thread_id);if(!tids.length)return 'Je hebt nog geen chat met deze vriend';
  const shared=await supabase.from('sx_members').select('thread_id').eq('user_id',s.owner_id).in('thread_id',tids).limit(1);if(shared.error)return shared.error.message;const tid=shared.data?.[0]?.thread_id;if(!tid)return 'Je hebt nog geen chat met deze vriend';
  const {error}=await supabase.from('sx_messages').insert({thread_id:tid,sender_id:me,kind:'text',body});return error?error.message:null},[me]);
 return <View style={{flex:1,backgroundColor:'#000'}}><Stack.Screen options={{headerShown:false}}/>{err?<Text style={{color:'white',padding:30}}>{err}</Text>:!groups?<Text style={{color:'white',padding:30}}>Verhalen laden…</Text>:
  <StoryViewer groups={groups} initialGroup={start} seen={seen} meId={me??''} names={names} onClose={()=>router.back()} onViewed={onViewed} onReply={onReply} loadViewers={loadViewers} renderMedia={s=><Media path={s.media_path} type={s.media_type} style={{flex:1}}/>}/>}</View>;
}
