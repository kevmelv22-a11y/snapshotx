import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {PROFILE_NAME_COLUMNS,profileNames} from '../../lib/profile-name';
import {Pressable,Text,View} from 'react-native';
import {Stack,router,useIsFocused,useLocalSearchParams} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {Media} from '../../components/Media';
import {OwnAvatar} from '../../components/avatar/OwnAvatar';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {StoryViewer,type ViewerStory} from '../../components/stories/StoryViewer';
import {STORY_GONE,viewerStartIndex,groupStories,shouldPostReaction,storyReactionBody,viewersFor,type StoryGroup} from '../../lib/stories';
import type {Story} from '../../lib/types';

import {friendlyError} from '../../lib/db-errors';
import {isUuid} from '../../lib/chat-ids';
import {parseSound,playbackRateFor,soundLabel} from '../../lib/snap-sound';
import {SnapMusic,SoundPill} from '../../components/SnapSound';
import {personalOnly,sharedIdOf,sharedViewerGroup} from '../../lib/shared-stories';
import {STORY_DELETE_TEXT,isStoryActive,storyDeletePatch} from '../../lib/story-delete';
/** Story viewer for all active stories, starting at `owner`. Marks views, replies go to the 1:1 chat. */
export default function StoriesViewerScreen(){
 const {owner}=useLocalSearchParams<{owner:string}>(),{session}=useSession(),me=session?.user.id;
 const focused=useIsFocused();
 const [groups,setGroups]=useState<StoryGroup<Story>[]|null>(null),[seen,setSeen]=useState<Set<string>>(new Set()),[names,setNames]=useState<Record<string,string>>({}),[start,setStart]=useState(0),[err,setErr]=useState('');
 useEffect(()=>{if(!me)return;let on=true;(async()=>{const now=Date.now();const [st,vw]=await Promise.all([supabase.from('sx_stories').select('*').gt('expires_at',new Date(now).toISOString()).order('created_at').limit(300),supabase.from('sx_story_views').select('story_id').eq('viewer_id',me)]);if(!on)return;if(st.error){setErr(friendlyError(st.error));return}
  const seenSet=new Set((vw.data||[]).map(v=>v.story_id as string));const active=(st.data||[]).filter(x=>isStoryActive(x,now));const sid=sharedIdOf(String(owner??''));if(sid){const sg=sharedViewerGroup(active,sid,seenSet,now);if(!sg){setErr('Er staan (nog) geen snaps in dit gedeelde verhaal.');return}const t=await supabase.from('sx_shared_stories').select('title').eq('id',sid).maybeSingle();setSeen(seenSet);setStart(0);setGroups([sg]);const ids=[...new Set(sg.stories.map(x=>x.owner_id))];const p=ids.length?await supabase.from('profiles').select(PROFILE_NAME_COLUMNS).in('id',ids):null;if(on)setNames({...(p?.data?profileNames(p.data):{}),[sg.ownerId]:String((t.data as {title?:string}|null)?.title||'Gedeeld verhaal')});return}
  const g=groupStories(personalOnly(active),seenSet,now,me);const at=viewerStartIndex(g,String(owner??''));if(at<0){setErr(STORY_GONE);return}setSeen(seenSet);setStart(at);setGroups(g);
  const ids=g.map(x=>x.ownerId);if(ids.length){const p=await supabase.from('profiles').select(PROFILE_NAME_COLUMNS).in('id',ids);if(on&&p.data)setNames(profileNames(p.data))}})();return()=>{on=false}},[me,owner]);
 const outfits=useFriendOutfits(useMemo(()=>(groups??[]).map(g=>g.ownerId).filter(x=>x!==me&&!sharedIdOf(x)),[groups,me]));
 const onViewed=useCallback((s:ViewerStory)=>{if(me&&s.owner_id!==me)void supabase.from('sx_story_views').upsert({story_id:s.id,viewer_id:me})},[me]);
 const loadViewers=useCallback(async(s:ViewerStory)=>{const [v,r]=await Promise.all([supabase.from('sx_story_views').select('story_id,viewer_id,viewed_at').eq('story_id',s.id).order('viewed_at',{ascending:false}).limit(500),supabase.from('sx_story_reactions').select('story_id,user_id,emoji').eq('story_id',s.id)]);const res=viewersFor(s.id,v.data||[],r.data||[],s.owner_id);const ids=res.viewers.map(x=>x.userId).filter(id=>!names[id]);if(ids.length){const p=await supabase.from('profiles').select(PROFILE_NAME_COLUMNS).in('id',ids);if(p.data)setNames(n=>({...n,...Object.fromEntries(p.data.map(x=>[x.id,x.display_name]))}))}return res},[names]);
 // Story replies always go to the 1:1 chat (Snapchat). sx_open_thread returns the stable 1:1 thread (or creates it);
 // before, the first shared thread was used, which could be a group chat.
 const onReply=useCallback(async(s:ViewerStory,body:string)=>{if(!me)return 'Niet ingelogd';const t=await supabase.rpc('sx_open_thread',{participants:[s.owner_id],group_title:null});if(t.error||!t.data)return t.error?friendlyError(t.error,'Antwoorden'):'Je hebt nog geen chat met deze vriend';
  const {error}=await supabase.from('sx_messages').insert({thread_id:t.data,sender_id:me,kind:'text',body});return error?friendlyError(error):null},[me]);
 // Snapchat: reply to a story with a snap — camera opens bound to the 1-on-1 chat (compose sends it there via threadId).
 const onSnapReply=useCallback(async(s:ViewerStory)=>{if(!me)return 'Niet ingelogd';const t=await supabase.rpc('sx_open_thread',{participants:[s.owner_id],group_title:null});if(t.error||!isUuid(t.data))return t.error?friendlyError(t.error,'Antwoorden'):'Je hebt nog geen chat met deze vriend';router.push({pathname:'/(tabs)',params:{threadId:String(t.data),chatTitle:names[s.owner_id]||'Vriend'}});return null},[me,names]);
 // Snapchat quick reactions: one emoji per viewer per story (upsert on story_id,user_id; RLS: own user_id only).
 // The reaction is also posted as a line in the 1:1 chat (Snapchat: "😂 Reageerde op je verhaal"), once per new emoji.
 const posted=useRef<Record<string,string>>({});
 const onReact=useCallback(async(s:ViewerStory,emoji:string)=>{if(!me)return 'Niet ingelogd';if(s.owner_id===me)return null;const {error}=await supabase.from('sx_story_reactions').upsert({story_id:s.id,user_id:me,emoji},{onConflict:'story_id,user_id'});if(error)return friendlyError(error,'Reageren');
  const body=storyReactionBody(emoji,s.caption);if(!body||!shouldPostReaction(posted.current,s.id,emoji))return null;
  const t=await supabase.rpc('sx_open_thread',{participants:[s.owner_id],group_title:null});if(t.error||!t.data)return null;// reaction itself is saved; chat line is best effort
  const m=await supabase.from('sx_messages').insert({thread_id:t.data,sender_id:me,kind:'text',body});if(!m.error)posted.current={...posted.current,[s.id]:emoji};return null},[me]);
 const onDelete=useCallback(async(s:ViewerStory)=>{if(!me||s.owner_id!==me)return 'Alleen je eigen verhaal';const patch=storyDeletePatch();const {error}=await supabase.from('sx_stories').update(patch).eq('id',s.id).eq('owner_id',me);if(error)return friendlyError(error,STORY_DELETE_TEXT.action);setGroups(gs=>{if(!gs)return gs;return gs.map(g=>({...g,stories:g.stories.filter(x=>x.id!==s.id)})).filter(g=>g.stories.length>0)});return null},[me]);
 return <View style={{flex:1,backgroundColor:'#000'}}><Stack.Screen options={{headerShown:false}}/>{err?<View style={{padding:30,paddingTop:80,gap:18}} testID="stories-error"><Text style={{color:'white',fontSize:16,lineHeight:22}}>{err}</Text><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/stories')} accessibilityRole="button" style={{alignSelf:'flex-start',backgroundColor:'#FFFC00',borderRadius:18,paddingHorizontal:18,paddingVertical:10}} testID="stories-error-back"><Text style={{color:'#140F22',fontWeight:'900'}}>Terug</Text></Pressable></View>:!groups?<Text style={{color:'white',padding:30}}>Verhalen laden…</Text>:
  <StoryViewer groups={groups} initialGroup={start} seen={seen} meId={me??''} names={names} onClose={()=>router.back()} onViewed={onViewed} onReply={onReply} onSnapReply={onSnapReply} focused={focused} onDelete={onDelete} onReact={onReact} renderAvatar={(id,size)=>sharedIdOf(id)?<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:'#5B2DB8',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:size*.5}}>👥</Text></View>:id===me?<OwnAvatar userId={me} size={size}/>:<FriendAvatar id={id} outfit={outfits.get(id)??null} size={size} name={names[id]||'Vriend'}/>} loadViewers={loadViewers} renderMedia={s=>{const snd=parseSound((s as Story).sound);return <View key={s.id} style={{flex:1}}><Media path={s.media_path} type={s.media_type} style={{flex:1}} rate={playbackRateFor(snd)}/>{snd.music&&<SnapMusic track={snd.music}/>}{!!soundLabel(snd)&&<View style={{position:'absolute',top:90,left:0,right:0}} pointerEvents="none"><SoundPill label={soundLabel(snd)}/></View>}</View>}}/>}</View>;
}
