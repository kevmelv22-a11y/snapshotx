import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {Avatar} from '../components/UI';
import {useConfirmDialog} from '../components/ConfirmDialog';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {PROFILE_NAME_COLUMNS,profileName} from '../lib/profile-name';
import {SHARED_MAX_MEMBERS,SHARED_TITLE_MAX,addableFriends,cleanSharedTitle,membersLabel,sharedErrorText,suggestTitle} from '../lib/shared-stories';
import {filterFriends} from '../lib/send-to';
import {isUuid,uuidList} from '../lib/chat-ids';

type Person={id:string;display_name:string};
/** Gedeeld verhaal: create one (name + friends) or, with ?id=, see members, add friends and leave. */
export default function SharedStoryScreen(){
 const {id}=useLocalSearchParams<{id?:string}>(),sid=isUuid(id)?String(id):null,{session}=useSession(),me=session?.user.id??'',insets=useSafeAreaInsets();
 const [friends,setFriends]=useState<Person[]>([]),[members,setMembers]=useState<Person[]>([]),[title,setTitle]=useState(''),[picked,setPicked]=useState<string[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false);
 const load=useCallback(async()=>{if(!me)return;const f=await supabase.from('sx_friends').select('friend_id').eq('user_id',me);const fids=(f.data||[]).map(x=>x.friend_id as string);let mids:string[]=[];
  if(sid){const [g,m]=await Promise.all([supabase.from('sx_shared_stories').select('title').eq('id',sid).maybeSingle(),supabase.from('sx_shared_story_members').select('user_id').eq('shared_story_id',sid)]);if(!g.data){setNotice(sharedErrorText('Not a member'));setLoaded(true);return}setTitle(String((g.data as {title:string}).title));mids=(m.data||[]).map(x=>x.user_id as string)}
  const ids=[...new Set([...fids,...mids])];const p=ids.length?await supabase.from('profiles').select(PROFILE_NAME_COLUMNS).in('id',ids):{data:[]};const byId=new Map((p.data||[]).map(x=>[x.id as string,profileName(x)]));
  setFriends(fids.map(x=>({id:x,display_name:byId.get(x)||'Vriend'})));setMembers(mids.map(x=>({id:x,display_name:x===me?'Ik':byId.get(x)||'Lid'})));setLoaded(true)},[me,sid]);
 useEffect(()=>{const t=setTimeout(()=>void load(),0);return()=>clearTimeout(t)},[load]);
 const confirm=useConfirmDialog();
 const choices=useMemo(()=>filterFriends(addableFriends(friends,members.map(m=>m.id)),query),[friends,members,query]);
 const room=SHARED_MAX_MEMBERS-(sid?members.length:1);
 const toggle=(fid:string)=>setPicked(v=>v.includes(fid)?v.filter(x=>x!==fid):v.length>=room?v:[...v,fid]);
 async function save(){if(busy||!picked.length)return;setBusy(true);setNotice('');try{
  if(sid){const {error}=await supabase.rpc('sx_add_shared_story_members',{p_id:sid,p_members:uuidList(picked)});if(error)throw error;setPicked([]);await load();setNotice('Toegevoegd ✓');return}
  const name=cleanSharedTitle(title||suggestTitle(friends.filter(f=>picked.includes(f.id)).map(f=>f.display_name)));if(!name){setNotice(sharedErrorText('Invalid shared story name'));return}
  const {data,error}=await supabase.rpc('sx_create_shared_story',{p_title:name,p_members:uuidList(picked)});if(error)throw error;router.replace({pathname:'/shared-story',params:{id:String(data)}})}
  catch(e){setNotice(sharedErrorText((e as {message?:string})?.message||''))}finally{setBusy(false)}}
 function leave(){if(!sid)return;confirm.ask({title:'Gedeeld verhaal verlaten?',message:'Je snaps in dit verhaal worden verwijderd en je ziet het verhaal niet meer.',confirmLabel:'Verlaten',destructive:true},async()=>{const {error}=await supabase.rpc('sx_leave_shared_story',{p_id:sid});if(error)return sharedErrorText(error.message);router.replace('/(tabs)/stories');return null})}
 return <GalaxyScreen readable><Stack.Screen options={{headerShown:false}}/>
  <View style={[s.header,{paddingTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/stories')} accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" size={27} color="white"/></Pressable><Text style={s.title} numberOfLines={1}>{sid?title||'Gedeeld verhaal':'Nieuw gedeeld verhaal'}</Text><View style={{width:27}}/></View>
  <ScrollView contentContainerStyle={[s.content,{paddingBottom:insets.bottom+110}]} testID="shared-story-screen" keyboardShouldPersistTaps="handled">
   {!sid&&<><Text style={s.intro}>Een verhaal dat jullie samen maken. Alleen de leden zien het en kunnen er snaps aan toevoegen. Het is nooit openbaar.</Text>
    <Text style={s.label}>Naam</Text><TextInput value={title} onChangeText={t=>setTitle(t.slice(0,SHARED_TITLE_MAX))} placeholder={suggestTitle(friends.filter(f=>picked.includes(f.id)).map(f=>f.display_name))} placeholderTextColor="#8E879A" style={s.input} maxLength={SHARED_TITLE_MAX} testID="shared-title"/></>}
   {!!sid&&<><Text style={s.label}>{membersLabel(members.length)}</Text><View style={s.card}>{members.map(m=><View key={m.id} style={s.row}><Avatar name={m.display_name} size={38}/><Text style={s.name}>{m.display_name}</Text></View>)}</View>
    <Pressable style={s.addSnap} onPress={()=>router.push('/(tabs)')} testID="shared-add-snap"><Ionicons name="camera" size={20} color="black"/><Text style={s.addSnapText}>Snap toevoegen</Text></Pressable>
    <Text style={s.hint}>Maak een snap en kies dit verhaal bij Verzenden naar.</Text></>}
   <Text style={s.label}>{sid?'Vrienden toevoegen':'Kies vrienden'}</Text>
   <TextInput value={query} onChangeText={setQuery} placeholder="Zoeken" placeholderTextColor="#8E879A" style={s.input}/>
   {loaded&&!choices.length&&<Text style={s.hint}>{friends.length?'Al je vrienden zitten er al in.':'Nog geen vrienden. Voeg ze toe via Vrienden.'}</Text>}
   <View style={s.card}>{choices.map(f=>{const on=picked.includes(f.id);return <Pressable key={f.id} style={s.row} onPress={()=>toggle(f.id)} accessibilityRole="checkbox" accessibilityState={{checked:on}} testID="shared-pick"><Avatar name={f.display_name} size={38}/><Text style={s.name}>{f.display_name}</Text><Ionicons name={on?'checkmark-circle':'ellipse-outline'} size={26} color={on?'#0FADFF':'#77727F'}/></Pressable>})}</View>
   {!!notice&&<Text style={s.notice}>{notice}</Text>}
   {!!sid&&<Pressable style={s.leave} onPress={leave} testID="shared-leave"><Text style={s.leaveText}>Verhaal verlaten</Text></Pressable>}
  </ScrollView>
  {!!picked.length&&<View style={[s.bar,{paddingBottom:Math.max(14,insets.bottom+6)}]}><Text style={s.barText}>{picked.length} gekozen</Text><Pressable onPress={()=>void save()} disabled={busy} style={[s.barBtn,busy&&{opacity:.6}]} testID="shared-save"><Text style={s.barBtnText}>{sid?'Toevoegen':'Maken'}</Text></Pressable></View>}
  {confirm.dialog}
 </GalaxyScreen>;
}
const s=StyleSheet.create({header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:10},title:{color:'white',fontSize:21,fontWeight:'800',flex:1,textAlign:'center'},content:{padding:16,gap:10},intro:{color:'#D8D2E0',fontSize:15,lineHeight:21},label:{color:'white',fontWeight:'800',fontSize:16,marginTop:10},input:{backgroundColor:'#2A2140',color:'white',borderRadius:14,paddingHorizontal:14,paddingVertical:12,fontSize:16},card:{backgroundColor:'#211A31CC',borderRadius:18,overflow:'hidden'},row:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,paddingVertical:10},name:{color:'white',fontSize:16,fontWeight:'700',flex:1},hint:{color:'#C9C2D0',fontSize:14},notice:{color:'#FFD37A',fontSize:15,fontWeight:'700'},addSnap:{flexDirection:'row',alignSelf:'flex-start',gap:8,alignItems:'center',backgroundColor:'#FFFC00',borderRadius:22,paddingHorizontal:16,paddingVertical:10},addSnapText:{color:'black',fontWeight:'800'},leave:{marginTop:24,alignSelf:'center',padding:12},leaveText:{color:'#FF6B81',fontWeight:'800',fontSize:16},bar:{position:'absolute',left:0,right:0,bottom:0,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#0FADFF',paddingHorizontal:18,paddingTop:14},barText:{color:'white',fontWeight:'800',fontSize:16},barBtn:{backgroundColor:'white',borderRadius:20,paddingHorizontal:18,paddingVertical:9},barBtnText:{color:'#0FADFF',fontWeight:'800',fontSize:15}});
