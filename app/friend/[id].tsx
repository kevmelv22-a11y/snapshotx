import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {FriendAvatar} from '../../components/avatar/FriendAvatar';
import {GalaxyScreen} from '../../components/GalaxyScreen';
import {useConfirmDialog} from '../../components/ConfirmDialog';
import {friendlyError} from '../../lib/db-errors';
import {threadStreak} from '../../lib/chat-status';
import type {StreakState} from '../../lib/chat-features';
import {savedCount,savedPreviews,savedSectionTitle,type SaveableMessage,type SavedPreview} from '../../lib/chat-saves';
import {quoteOf} from '../../lib/chat-replies';
import {useFriendEmojis} from '../../stores/friendEmojis';
import {emojiFor,NEW_FRIEND_MS,relationLabel} from '../../lib/friend-emojis';
import {charmsTitle,friendCharms,type Charm,type CharmMessage} from '../../lib/friend-charms';
import {formatScore,friendsSinceLabel,groupLine,sharedChats,sharedGroupsTitle,streakChip,type SharedChats} from '../../lib/friend-profile';

type FriendProfile={id:string;display_name:string;username:string;activity_score:number;gender?:string|null};
const purple='#7A3CFF';
/** Snapchat-style friendship profile: avatar, name, @username · score, streak + friends-since, actions, shared groups. */
export default function FriendProfileScreen(){
 const {id:raw}=useLocalSearchParams<{id:string|string[]}>(),id=Array.isArray(raw)?raw[0]:raw??'';
 const {session}=useSession(),me=session?.user.id??'',insets=useSafeAreaInsets(),confirm=useConfirmDialog();
 const [p,setP]=useState<FriendProfile|null>(null),[since,setSince]=useState<string|null>(null),[fresh,setFresh]=useState(false),[isFriend,setIsFriend]=useState(true);
 const [shared,setShared]=useState<SharedChats>({directId:null,groups:[]}),[streak,setStreak]=useState<StreakState|null>(null),[stories,setStories]=useState(0);
 const [savedRows,setSavedRows]=useState<{total:number;items:SavedPreview[]}>({total:0,items:[]});
 const [sinceIso,setSinceIso]=useState<string|null>(null),[recentMsgs,setRecentMsgs]=useState<CharmMessage[]>([]),[charm,setCharm]=useState<Charm|null>(null),[loadedAt,setLoadedAt]=useState(0);
 const [notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const outfits=useFriendOutfits(useMemo(()=>[id],[id]));
 const load=useCallback(async(alive:()=>boolean)=>{if(!id||!me)return;
  const [pr,fr,mine,st]=await Promise.all([
   supabase.from('profiles').select('id,display_name,username,activity_score,gender').eq('id',id).maybeSingle(),
   supabase.from('sx_friends').select('created_at').eq('user_id',me).eq('friend_id',id).maybeSingle(),
   supabase.from('sx_members').select('thread_id').eq('user_id',me),
   supabase.from('sx_stories').select('id').eq('owner_id',id).gt('expires_at',new Date().toISOString()),
  ]);
  if(!alive())return;
  if(pr.error||!pr.data){setNotice(pr.error?friendlyError(pr.error):'Dit profiel bestaat niet (meer).');setLoading(false);return}
  setP(pr.data as FriendProfile);const friend=!fr.error&&!!fr.data;setIsFriend(friend);{const t=friend&&fr.data?.created_at?Date.parse(fr.data.created_at):NaN;setFresh(Number.isFinite(t)&&Date.now()-t<NEW_FRIEND_MS)}setLoadedAt(Date.now());setSinceIso(friend?(fr.data?.created_at as string|null)??null:null);setSince(friend?friendsSinceLabel(fr.data?.created_at,Date.now(),-new Date().getTimezoneOffset()):'Nog geen vrienden');setStories(st.error?0:(st.data||[]).length);
  // Shared chats + streak are extras: a failing query must not hide the profile itself.
  const tids=(mine.data||[]).map(x=>x.thread_id as string);
  if(tids.length){
   const [mem,th]=await Promise.all([supabase.from('sx_members').select('thread_id,user_id').in('thread_id',tids),supabase.from('sx_threads').select('id,title,is_group').in('id',tids)]);
   const ids=[...new Set((mem.data||[]).map(x=>x.user_id as string))];const names=ids.length?await supabase.from('profiles').select('id,display_name').in('id',ids):null;
   const nm=new Map((names?.data||[]).map(x=>[x.id as string,x.display_name as string]));
   if(!alive())return;
   const sc=mem.error?{directId:null,groups:[]}:sharedChats(mem.data||[],th.data||[],me,id,u=>nm.get(u)||'Vriend');setShared(sc);
   if(sc.directId){const m=await supabase.from('sx_messages').select('sender_id,kind,created_at').eq('thread_id',sc.directId).eq('kind','snap').order('created_at',{ascending:false}).limit(200);
    if(alive()&&!m.error)setStreak(threadStreak(m.data||[],me,id,Date.now(),-new Date().getTimezoneOffset()))
    // Charms (Kletskousen / Nachtbrakers): the last 30 days of the 1:1 chat, newest first.
    const rc=await supabase.from('sx_messages').select('sender_id,kind,created_at').eq('thread_id',sc.directId).gte('created_at',new Date(Date.now()-30*86400000).toISOString()).order('created_at',{ascending:false}).limit(400);
    if(alive()&&!rc.error)setRecentMsgs((rc.data||[]) as CharmMessage[]);
    // Opslaan in chat: newest saved messages of the 1:1 chat (missing column on an old DB → section stays hidden).
    const sv=await supabase.from('sx_messages').select('id,sender_id,kind,body,saved,created_at').eq('thread_id',sc.directId).eq('saved',true).order('created_at',{ascending:false}).limit(50);
    if(alive()&&!sv.error){const list=(sv.data||[]) as (SaveableMessage&{body:string|null})[];const first=(pr.data?.display_name??'').trim().split(/\s+/)[0];setSavedRows({total:savedCount(list),items:savedPreviews(list,me,first,3,m=>quoteOf({...m,body:m.body}).excerpt)})}}
  }
  if(alive())setLoading(false);
 },[id,me]);
 useEffect(()=>{let alive=true;const t=setTimeout(()=>void load(()=>alive),0);return()=>{alive=false;clearTimeout(t)}},[load]);
 // Chat / Bellen go through the stable 1:1 thread (sx_open_thread reuses it or creates it).
 async function thread():Promise<string|null>{if(shared.directId)return shared.directId;const {data,error}=await supabase.rpc('sx_open_thread',{participants:[id],group_title:null});if(error){setNotice(friendlyError(error,'Chat openen'));return null}return data as string}
 async function openChat(){if(busy)return;setBusy(true);try{const t=await thread();if(t)router.push({pathname:'/chat/[id]',params:{id:t}})}finally{setBusy(false)}}
 async function call(){if(busy||!p)return;setBusy(true);try{const t=await thread();if(t)router.push({pathname:'/call/[id]',params:{id:t,name:p.display_name}})}finally{setBusy(false)}}
 // Back to the chat if we came from it (no second copy of the chat on the stack), else open it.
 function openSavedChat(){if(shared.directId)router.dismissTo({pathname:'/chat/[id]',params:{id:shared.directId}})}
 function block(){if(!p)return;confirm.ask({title:`${p.display_name} blokkeren?`,message:'Jullie kunnen elkaar dan niet meer berichten of snaps sturen. In groepschats worden berichten van deze persoon verborgen.',confirmLabel:'Blokkeren',destructive:true},async()=>{const {error}=await supabase.from('sx_blocks').insert({blocker_id:me,blocked_id:id});if(error)return friendlyError(error);router.back();return null})}
 const emojiChoices=useFriendEmojis(st=>me?st.choices[me]:undefined),known=useFriendEmojis(st=>me?st.relations[me]?.[id]:undefined);
 // Vriend-emoji: the relationship last ranked in the chat list; a fresh friendship (< 7 days) is 👶 on its own.
 const relation=isFriend?known??(fresh?'new_friend':null):null;
 const chips=[relation?relationLabel(relation,emojiChoices):null,streakChip(streak,emojiFor('streak',emojiChoices),emojiFor('hourglass',emojiChoices)),since].filter((x):x is string=>!!x);
 const groupsTitle=sharedGroupsTitle(shared.groups.length);
 const charms=useMemo(()=>isFriend&&me?friendCharms({me,friend:id,now:loadedAt,offsetMin:-new Date(loadedAt).getTimezoneOffset(),friendsSince:sinceIso,relation,streak:streak?.count??0,messages:recentMsgs,sharedGroups:shared.groups.length,savedCount:savedRows.total}):[],[isFriend,me,id,loadedAt,sinceIso,relation,streak,recentMsgs,shared.groups.length,savedRows.total]);
 const charmsHead=charmsTitle(charms.length);
 return <GalaxyScreen>
  <Stack.Screen options={{headerShown:false}}/>
  <View style={[s.header,{paddingTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/chats')} accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" size={28} color="white"/></Pressable><Text style={s.headerTitle}>Vriendschapsprofiel</Text><View style={{width:28}}/></View>
  {!p?<Text style={s.muted}>{loading&&!notice?'Profiel laden…':notice}</Text>:
  <ScrollView contentContainerStyle={[s.body,{paddingBottom:insets.bottom+30}]} testID="friend-profile">
   <View style={s.hero}><FriendAvatar id={p.id} outfit={isFriend?outfits.get(p.id):null} size={132} name={p.display_name} gender={p.gender==='female'||p.gender==='male'?p.gender:undefined}/></View>
   <Text style={s.name} testID="friend-name">{p.display_name}</Text>
   <Text style={s.user}>@{p.username} · <Text style={s.score}>{formatScore(p.activity_score)}</Text></Text>
   <View style={s.chips}>{chips.map(c=><View key={c} style={s.chip} testID="friend-chip"><Text style={s.chipText}>{c}</Text></View>)}</View>
   <View style={s.actions}>
    <Action icon="chatbubble" label="Chat" onPress={()=>void openChat()} disabled={busy||!isFriend}/>
    <Action icon="videocam" label="Bellen" onPress={()=>void call()} disabled={busy||!isFriend}/>
    {stories>0&&<Action icon="play-circle" label="Verhaal" onPress={()=>router.push({pathname:'/stories/[owner]',params:{owner:p.id}})}/>}
   </View>
   {!!notice&&<Text style={s.notice}>{notice}</Text>}
   {charmsHead&&<><Text style={s.section} testID="charms-title">{charmsHead}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.charmRow} testID="charms">{charms.map(c=><Pressable key={c.id} onPress={()=>setCharm(c)} style={[s.charm,{backgroundColor:c.colors[1],borderColor:c.colors[0]}]} accessibilityLabel={`Charm ${c.title}: ${c.subtitle}`} testID={`charm-${c.id}`}>
     <View style={[s.charmGlow,{backgroundColor:c.colors[0]}]}/><Text style={s.charmEmoji}>{c.emoji}</Text><Text style={s.charmTitle} numberOfLines={2}>{c.title}</Text><Text style={s.charmSub} numberOfLines={2}>{c.subtitle}</Text></Pressable>)}</ScrollView></>}
   {groupsTitle&&<><Text style={s.section}>{groupsTitle}</Text>
    <View style={s.card}>{shared.groups.map((g,i)=><Pressable key={g.id} onPress={()=>router.push({pathname:'/chat/[id]',params:{id:g.id}})} style={[s.row,i>0&&s.rowLine]} accessibilityLabel={`Open groep ${g.title}`} testID="shared-group"><View style={s.groupIcon}><Ionicons name="people" size={18} color="white"/></View><Text style={s.rowText} numberOfLines={1}>{groupLine(g)}</Text><Ionicons name="chevron-forward" size={18} color="#C7C0CD"/></Pressable>)}</View></>}
   {savedRows.total>0&&shared.directId&&<><Text style={s.section} testID="saved-section">Opgeslagen in chat</Text>
    <View style={s.card}>{savedRows.items.map((x,i)=><Pressable key={x.id} onPress={()=>openSavedChat()} style={[s.row,i>0&&s.rowLine]} accessibilityLabel={`Opgeslagen bericht van ${x.who}`} testID="saved-preview"><Ionicons name="bookmark" size={18} color="#C7C0CD"/><Text style={s.rowText} numberOfLines={1}><Text style={{fontWeight:'800'}}>{x.who}: </Text>{x.excerpt}</Text></Pressable>)}
     <Pressable onPress={()=>openSavedChat()} style={[s.row,s.rowLine]} accessibilityLabel="Bekijk opgeslagen berichten in de chat" testID="saved-open-chat"><Text style={[s.rowText,{color:'#C7C0CD'}]}>{savedSectionTitle(savedRows.total)} · bekijk in chat</Text><Ionicons name="chevron-forward" size={18} color="#C7C0CD"/></Pressable></View></>}
   <Text style={s.section}>Privacy</Text>
   <View style={s.card}><Pressable onPress={()=>router.push({pathname:'/report',params:{user_id:id,name:p.display_name}})} style={s.row} accessibilityLabel={`${p.display_name} melden`} testID="friend-report"><Ionicons name="flag-outline" size={20} color="#FF6B6B"/><Text style={[s.rowText,{color:'#FF6B6B'}]}>Account melden</Text></Pressable><Pressable onPress={block} style={[s.row,s.rowLine]} accessibilityLabel={`${p.display_name} blokkeren`} testID="friend-block"><Ionicons name="ban" size={20} color="#FF6B6B"/><Text style={[s.rowText,{color:'#FF6B6B'}]}>Blokkeren</Text></Pressable></View>
  </ScrollView>}
  <Modal visible={!!charm} transparent animationType="fade" onRequestClose={()=>setCharm(null)}>
   <Pressable style={s.sheetBackdrop} onPress={()=>setCharm(null)} accessibilityLabel="Sluiten" testID="charm-backdrop">
    {charm&&<Pressable style={[s.sheet,{paddingBottom:insets.bottom+20}]} onPress={()=>{}} testID="charm-sheet">
     <View style={[s.sheetBadge,{backgroundColor:charm.colors[1],borderColor:charm.colors[0]}]}><Text style={s.sheetEmoji}>{charm.emoji}</Text></View>
     <Text style={s.sheetTitle}>{charm.title}</Text><Text style={s.sheetSub}>{charm.subtitle}</Text>
     <Text style={s.sheetText}>{charm.description}</Text>
     {!!p&&<Text style={s.sheetNote}>Alleen jij en {p.display_name.split(/\s+/)[0]} zien deze charm.</Text>}
     <Pressable onPress={()=>setCharm(null)} style={s.sheetBtn} accessibilityLabel="Oké" testID="charm-close"><Text style={s.sheetBtnText}>Oké</Text></Pressable>
    </Pressable>}
   </Pressable>
  </Modal>
  {confirm.dialog}
 </GalaxyScreen>;
}
function Action({icon,label,onPress,disabled}:{icon:React.ComponentProps<typeof Ionicons>['name'];label:string;onPress:()=>void;disabled?:boolean}){
 return <Pressable onPress={onPress} disabled={disabled} style={[s.action,disabled&&{opacity:.45}]} accessibilityLabel={label} testID={`friend-action-${label.toLowerCase()}`}><Ionicons name={icon} size={22} color="white"/><Text style={s.actionText}>{label}</Text></Pressable>;
}
const s=StyleSheet.create({
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:6},headerTitle:{color:'white',fontSize:18,fontWeight:'800'},
 body:{paddingHorizontal:18,alignItems:'stretch'},hero:{alignItems:'center',marginTop:10},
 name:{color:'white',fontSize:26,fontWeight:'800',textAlign:'center',marginTop:12},user:{color:'#C7C0CD',fontSize:15,textAlign:'center',marginTop:4},score:{color:'white',fontWeight:'800'},
 chips:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8,marginTop:14},chip:{backgroundColor:'#2B2938CC',borderRadius:16,paddingHorizontal:12,paddingVertical:7},chipText:{color:'white',fontSize:13,fontWeight:'700'},
 actions:{flexDirection:'row',justifyContent:'center',gap:12,marginTop:20},action:{backgroundColor:purple,borderRadius:22,minWidth:96,paddingHorizontal:14,paddingVertical:12,alignItems:'center',gap:4},actionText:{color:'white',fontSize:14,fontWeight:'800'},
 section:{color:'white',fontSize:19,fontWeight:'800',marginTop:26,marginBottom:10},card:{backgroundColor:'#1A1425CC',borderRadius:18,overflow:'hidden'},
 row:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,minHeight:54},rowLine:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#ffffff22'},rowText:{color:'white',fontSize:16,fontWeight:'600',flex:1},
 groupIcon:{width:32,height:32,borderRadius:16,backgroundColor:'#51427980',alignItems:'center',justifyContent:'center'},
 charmRow:{gap:10,paddingRight:6},charm:{width:132,minHeight:142,borderRadius:18,borderWidth:1.5,padding:12,overflow:'hidden',justifyContent:'flex-end'},
 charmGlow:{position:'absolute',top:-40,right:-40,width:110,height:110,borderRadius:55,opacity:.55},charmEmoji:{fontSize:34,position:'absolute',top:12,left:12},
 charmTitle:{color:'white',fontSize:15,fontWeight:'800'},charmSub:{color:'#FFFFFFD0',fontSize:12,fontWeight:'600',marginTop:2},
 sheetBackdrop:{flex:1,backgroundColor:'#000000AA',justifyContent:'flex-end'},sheet:{backgroundColor:'#1A1425',borderTopLeftRadius:26,borderTopRightRadius:26,paddingHorizontal:24,paddingTop:26,alignItems:'center'},
 sheetBadge:{width:96,height:96,borderRadius:48,borderWidth:2,alignItems:'center',justifyContent:'center'},sheetEmoji:{fontSize:50},
 sheetTitle:{color:'white',fontSize:22,fontWeight:'800',marginTop:14},sheetSub:{color:'#C7C0CD',fontSize:15,fontWeight:'700',marginTop:4},
 sheetText:{color:'white',fontSize:16,textAlign:'center',lineHeight:22,marginTop:14},sheetNote:{color:'#9C93A6',fontSize:13,textAlign:'center',marginTop:12},
 sheetBtn:{backgroundColor:purple,borderRadius:24,alignSelf:'stretch',alignItems:'center',paddingVertical:14,marginTop:22},sheetBtnText:{color:'white',fontSize:16,fontWeight:'800'},
 muted:{color:'#C7C0CD',textAlign:'center',marginTop:40},notice:{color:'#FFE436',textAlign:'center',marginTop:12},
});
