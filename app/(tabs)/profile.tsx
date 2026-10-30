import React,{useCallback,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MapAvatar} from '../../components/MapAvatar';
import {AvatarBust} from '../../components/avatar/AvatarBust';
import {ProfileHome,YellowAvatarCircle,type ProfileFriend} from '../../components/profile/ProfileHome';
import {useStartOutfit,useWardrobeSync} from '../../hooks/useWardrobeSync';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {useSession} from '../../hooks/useSession';
import {birthdayBadge,readBirthdayMeta} from '../../lib/birthday';
import {useStaffRoles} from '../../hooks/useStaffRoles';
import {useOwnProfile} from '../../hooks/useOwnProfile';
import {friendlyError} from '../../lib/db-errors';
import {storyRingState} from '../../lib/avatar/poses';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {TierBanner} from '../../components/plus/TierBrand';
import {AppIconBadge,PlusBadge} from '../../components/plus/PlusParts';
import {useEffectiveAppIcon,usePlusStore,useTier} from '../../stores/plus';
import {appIconInfo,entitlementLabel} from '../../lib/plus';
import {useNow} from '../../hooks/useNow';
import {useMyCountdowns} from '../../stores/countdowns';
import {profileTimers} from '../../lib/countdowns';

/** Profile (step 8 layout: see components/profile/ProfileHome). Data: profile, 4 friends + story rings, own story count, location sharing. */
export default function Profile(){
 const {session}=useSession(),uid=session?.user.id,{isStaff}=useStaffRoles(),insets=useSafeAreaInsets();
 useWardrobeSync(uid);
 const {profile:own}=useOwnProfile();
 const [stories,setStories]=useState(0),[sharing,setSharing]=useState(false),[notice,setNotice]=useState('');
 const [friends,setFriends]=useState<{id:string;name:string;ring:ProfileFriend['ring']}[]>([]);
 const outfits=useFriendOutfits(friends.map(f=>f.id));
 useFocusEffect(useCallback(()=>{if(!uid)return;let active=true;void (async()=>{
  const now=new Date().toISOString();
  // Own profile comes from useOwnProfile (maybeSingle + create/fallback). The rest loads independently so one
  // unavailable table (no GRANT on live) only hides its own part instead of breaking the screen.
  const [f,s,l]=await Promise.all([supabase.from('sx_friends').select('friend_id').eq('user_id',uid).limit(4),supabase.from('sx_stories').select('id',{count:'exact',head:true}).eq('owner_id',uid).gt('expires_at',now),supabase.from('sx_locations').select('sharing').eq('user_id',uid).maybeSingle()]);
  if(!active)return;setStories(s.count||0);setSharing(!!l.data?.sharing);
  const problems=[f.error&&friendlyError(f.error,'Vrienden'),s.error&&friendlyError(s.error,'Stories'),l.error&&friendlyError(l.error,'Locatie')].filter(Boolean) as string[];
  setNotice([...new Set(problems)].join('\n'));
  const ids=(f.data||[]).map(x=>x.friend_id as string);if(!ids.length){setFriends([]);return}
  const [n,st]=await Promise.all([supabase.from('profiles').select('id,display_name').in('id',ids),supabase.from('sx_stories').select('id,owner_id,expires_at').in('owner_id',ids).gt('expires_at',now)]);
  const storyIds=(st.data||[]).map(x=>x.id as string);const v=storyIds.length?await supabase.from('sx_story_views').select('story_id').eq('viewer_id',uid).in('story_id',storyIds):{data:[]};
  if(!active)return;const names=new Map((n.data||[]).map(x=>[x.id,x.display_name])),seen=(v.data||[]).map(x=>x.story_id as string),t=Date.now();
  setFriends(ids.map(id=>({id,name:names.get(id)||'Vriend',ring:storyRingState((st.data||[]).filter(x=>x.owner_id===id).map(x=>({id:x.id,expiresAt:Date.parse(x.expires_at)})),seen,t)})));
 })();return()=>{active=false}},[uid]));
 const nowMs=useNow(),start=useStartOutfit(uid),tier=useTier(),ents=usePlusStore(x=>x.entitlements),appIcon=useEffectiveAppIcon(),mine=ents.find(e=>e.tier===tier);
 // Same art as the doll (OutfitArt), cropped to head+shoulders: updates with every Kast / look change.
 const countdowns=useMyCountdowns(uid),timers=profileTimers(countdowns,nowMs);
 const hero=<YellowAvatarCircle size={230}><AvatarBust outfit={start} size={230} testID="profile-bust-art"/></YellowAvatarCircle>;
 const tile=(icon:keyof typeof Ionicons.glyphMap,label:string,to:Parameters<typeof router.push>[0])=><Pressable key={label} style={s.tile} onPress={()=>router.push(to)}><Ionicons name={icon} color="#FFF" size={22}/><Text style={s.tileText}>{label}</Text><Ionicons name="chevron-forward" color="#C7C7CC" size={20}/></Pressable>;
 const bd=readBirthdayMeta(session?.user.user_metadata),cake=birthdayBadge(bd.birth,bd.party);
 return <ProfileHome username={own?(own.hasUsername||own.source==='metadata'?own.handle:own.displayName):'Mijn profiel'} nameBadge={<>{tier&&tier!=='storage'?<PlusBadge tier={tier} size={22}/>:null}{cake?<Text style={{fontSize:20,marginLeft:6}} accessibilityLabel="Jarig vandaag">{cake}</Text>:null}</>} score={own?.activityScore??0} hero={hero} ownOutfit={start} storyCount={stories} sharingLocation={sharing} topInset={insets.top}
  friends={friends.map(f=>{const o=outfits.get(f.id);return {...f,outfit:o&&o!=='pending'?o:null,fallback:<MapAvatar id={f.id} size={70}/>}})}
  onMenu={()=>router.back()} onSettings={()=>router.push('/settings')} onAvatar={()=>router.push('/avatar/mode')} onStory={()=>router.push('/(tabs)/stories')} onFriends={()=>router.push('/(tabs)/friends')} onMap={()=>router.push('/map')} onTimers={()=>router.push('/countdowns')} timers={timers}
  footer={<View style={{marginTop:6}}>
   <TierBanner tier={tier} status={mine?entitlementLabel(mine,nowMs):undefined} onPress={()=>router.push(tier&&tier!=='storage'?'/plus-manage':'/plus')}/>
   <Pressable testID="profile-app-icon" onPress={()=>router.push('/plus-settings')} accessibilityLabel={`App-icoon ${appIconInfo(appIcon).label}`} style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:C.cardBg,borderRadius:14,padding:12,marginTop:8}}><AppIconBadge id={appIcon} size={36}/><Text style={{color:C.text,fontWeight:'700',flex:1}}>App-icoon: {appIconInfo(appIcon).label}</Text><Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>
   {tile('shirt-outline','Avatar-kast','/avatar/kast')}
   {tile('happy-outline','Avatarstickers','/avatar/stickers')}
   {tile('color-palette-outline','Avatar-editor','/avatar-editor')}
   {isStaff&&tile('shield-checkmark-outline','Staff- en moderatiepaneel','/staff')}
   {!!(notice||own?.notice)&&<Text style={s.notice}>{[own?.notice,notice].filter(Boolean).join('\n')}</Text>}
  </View>}/>;
}
const s=StyleSheet.create({tile:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#14301F',borderRadius:14,borderWidth:1,borderColor:'#24452F',padding:14,marginBottom:8},tileText:{flex:1,color:'#FFF',fontSize:16,fontWeight:'700'},notice:{color:C.yellow,textAlign:'center',marginTop:8}});
