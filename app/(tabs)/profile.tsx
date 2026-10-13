import React,{useCallback,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {OwnAvatar} from '../../components/avatar/OwnAvatar';
import {PosedAvatar,BUST_VIEWBOX} from '../../components/avatar/PosedAvatar';
import {MapAvatar} from '../../components/MapAvatar';
import {ProfileHome,YellowAvatarCircle,type ProfileFriend} from '../../components/profile/ProfileHome';
import {useOwnOutfit,useWardrobeSync} from '../../hooks/useWardrobeSync';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {useSession} from '../../hooks/useSession';
import {useStaffRoles} from '../../hooks/useStaffRoles';
import {useAvatarPose} from '../../stores/avatarPose';
import {storyRingState} from '../../lib/avatar/poses';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {readAvatarAppearance} from '../../lib/avatar';

/** Profile (step 8 layout: see components/profile/ProfileHome). Data: profile, 4 friends + story rings, own story count, location sharing. */
export default function Profile(){
 const {session}=useSession(),uid=session?.user.id,{isStaff}=useStaffRoles(),insets=useSafeAreaInsets();
 const appearance=readAvatarAppearance(session?.user.user_metadata?.snaplion_avatar);
 useWardrobeSync(uid);
 const outfit=useOwnOutfit(uid),pose=useAvatarPose(s=>s.pose);
 const [username,setUsername]=useState(''),[score,setScore]=useState(0),[stories,setStories]=useState(0),[sharing,setSharing]=useState(false),[notice,setNotice]=useState('');
 const [friends,setFriends]=useState<{id:string;name:string;ring:ProfileFriend['ring']}[]>([]);
 const outfits=useFriendOutfits(friends.map(f=>f.id));
 useFocusEffect(useCallback(()=>{if(!uid)return;let active=true;void (async()=>{
  const now=new Date().toISOString();
  const [p,f,s,l]=await Promise.all([supabase.from('profiles').select('display_name,username,activity_score').eq('id',uid).single(),supabase.from('sx_friends').select('friend_id').eq('user_id',uid).limit(4),supabase.from('sx_stories').select('id',{count:'exact',head:true}).eq('owner_id',uid).gt('expires_at',now),supabase.from('sx_locations').select('sharing').eq('user_id',uid).maybeSingle()]);
  if(!active)return;if(p.error)setNotice(p.error.message);else if(p.data){setUsername(p.data.username||p.data.display_name);setScore(p.data.activity_score)}setStories(s.count||0);setSharing(!!l.data?.sharing);
  const ids=(f.data||[]).map(x=>x.friend_id as string);if(!ids.length){setFriends([]);return}
  const [n,st]=await Promise.all([supabase.from('profiles').select('id,display_name').in('id',ids),supabase.from('sx_stories').select('id,owner_id,expires_at').in('owner_id',ids).gt('expires_at',now)]);
  const storyIds=(st.data||[]).map(x=>x.id as string);const v=storyIds.length?await supabase.from('sx_story_views').select('story_id').eq('viewer_id',uid).in('story_id',storyIds):{data:[]};
  if(!active)return;const names=new Map((n.data||[]).map(x=>[x.id,x.display_name])),seen=(v.data||[]).map(x=>x.story_id as string),t=Date.now();
  setFriends(ids.map(id=>({id,name:names.get(id)||'Vriend',ring:storyRingState((st.data||[]).filter(x=>x.owner_id===id).map(x=>({id:x.id,expiresAt:Date.parse(x.expires_at)})),seen,t)})));
 })();return()=>{active=false}},[uid]));
 const hero=<YellowAvatarCircle size={230}>{outfit?<PosedAvatar outfit={outfit} pose={pose==='stand'?'stand':pose} width={230} height={230} viewBox={BUST_VIEWBOX}/>:<View style={{flex:1,justifyContent:'center'}}><OwnAvatar userId={uid} size={180} appearance={appearance}/></View>}</YellowAvatarCircle>;
 const tile=(icon:keyof typeof Ionicons.glyphMap,label:string,to:Parameters<typeof router.push>[0])=><Pressable key={label} style={s.tile} onPress={()=>router.push(to)}><Ionicons name={icon} color="#FFF" size={22}/><Text style={s.tileText}>{label}</Text><Ionicons name="chevron-forward" color="#C7C7CC" size={20}/></Pressable>;
 return <ProfileHome username={username||'Mijn profiel'} score={score} hero={hero} ownOutfit={outfit} storyCount={stories} sharingLocation={sharing} topInset={insets.top}
  friends={friends.map(f=>{const o=outfits.get(f.id);return {...f,outfit:o&&o!=='pending'?o:null,fallback:<MapAvatar id={f.id} size={70}/>}})}
  onMenu={()=>router.back()} onSettings={()=>router.push('/settings')} onAvatar={()=>router.push('/avatar/mode')} onStory={()=>router.push('/(tabs)/stories')} onFriends={()=>router.push('/(tabs)/friends')} onMap={()=>router.push('/map')} onTimers={()=>setNotice('Afteltimers komen binnenkort.')}
  footer={<View style={{marginTop:6}}>
   {tile('shirt-outline','Avatarkast','/avatar/kast')}
   {tile('happy-outline','Avatarstickers','/avatar/stickers')}
   {tile('color-palette-outline','Klassieke avatar-editor','/avatar-editor')}
   {isStaff&&tile('shield-checkmark-outline','Staff- en moderatiepaneel','/staff')}
   {!!notice&&<Text style={s.notice}>{notice}</Text>}
  </View>}/>;
}
const s=StyleSheet.create({tile:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#14301F',borderRadius:14,borderWidth:1,borderColor:'#24452F',padding:14,marginBottom:8},tileText:{flex:1,color:'#FFF',fontSize:16,fontWeight:'700'},notice:{color:C.yellow,textAlign:'center',marginTop:8}});
