import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {friendlyError} from '../../lib/db-errors';
import {useConfirmDialog} from '../ConfirmDialog';
import {FriendAvatar} from '../avatar/FriendAvatar';
import {OwnAvatar} from '../avatar/OwnAvatar';
import {useFriendOutfits} from '../../hooks/useFriendOutfits';
import {MemberRoleIcon,useMemberActions} from './MemberActionSheet';
import {wallpaperLabel} from '../../lib/chat-wallpaper';
import {GROUP_MAX_MEMBERS,GROUP_TITLE_MAX,addableFriends,canAddMembers,canRename,canSelectMore,groupErrorText,normalizeGroupTitle,sortMembers,validateAdd} from '../../lib/group-chat';

export type GroupMember={id:string;name:string};
type Props={/** Current Chat-achtergrond id (shows its label) + opens the wallpaper sheet. */wallpaperLabel?:string;onWallpaper?:()=>void;visible:boolean;threadId:string;me:string;title:string;creatorId:string|null;members:GroupMember[];/** Members with can_remove_members (migration 20261027200000). */removers?:string[];onClose:()=>void;/** Reload thread meta + messages after a change. */onChanged:()=>void;/** Called after leaving; the chat screen navigates back to the chat list. */onLeft:()=>void};
const violet='#B629E2';
const errText=(e:unknown)=>groupErrorText(e)??friendlyError(e);

/** Snapchat-style "Groepsinfo": members (long-press → acties), rename, add friends, leave. Mount it only while open (fresh state each time). */
export function GroupInfoSheet({visible,threadId,me,title,creatorId,members,removers=[],onClose,onChanged,onLeft,wallpaperLabel:wp,onWallpaper}:Props){
 const insets=useSafeAreaInsets(),confirm=useConfirmDialog();
 const [mode,setMode]=useState<'info'|'rename'|'add'>('info'),[draft,setDraft]=useState(title),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [friends,setFriends]=useState<GroupMember[]|null>(null),[picked,setPicked]=useState<string[]>([]);
 const memberIds=members.map(m=>m.id),isMember=memberIds.includes(me),count=members.length;
 const sorted=useMemo(()=>sortMembers(members,me,creatorId),[members,me,creatorId]);
 const memberMenu=useMemberActions({threadId,me,adminId:creatorId,members,removers,onChanged,beforeNavigate:onClose});
 const candidates=addableFriends(friends??[],memberIds);
 const outfits=useFriendOutfits([...memberIds.filter(id=>id!==me),...candidates.map(f=>f.id)]);
 useEffect(()=>{if(mode!=='add'||friends)return;let alive=true;void (async()=>{const r=await supabase.from('sx_friends').select('friend_id').eq('user_id',me);if(!alive)return;if(r.error){setNotice(friendlyError(r.error,'Je vrienden'));setFriends([]);return}const ids=(r.data||[]).map(x=>x.friend_id);if(!ids.length){setFriends([]);return}const p=await supabase.from('profiles').select('id,display_name').in('id',ids);if(!alive)return;const names=new Map((p.data||[]).map(x=>[x.id,x.display_name]));setFriends(ids.map(id=>({id,name:names.get(id)||'Vriend'})).sort((a,b)=>a.name.localeCompare(b.name,'nl')))})();return()=>{alive=false}},[mode,friends,me]);

 async function run(fn:()=>PromiseLike<{error:unknown}>,after?:()=>void){if(busy)return;setBusy(true);setNotice('');try{const {error}=await fn();if(error){setNotice(errText(error));return}after?.();onChanged()}catch(e){setNotice(errText(e))}finally{setBusy(false)}}
 function saveName(){const t=normalizeGroupTitle(draft);if(!t){setNotice(`Geef de groep een naam (max ${GROUP_TITLE_MAX} tekens).`);return}if(t===title){setMode('info');return}void run(()=>supabase.rpc('sx_rename_group',{p_thread_id:threadId,p_title:t}),()=>setMode('info'))}
 function addPicked(){const why=validateAdd(count,picked);if(why){setNotice(why);return}void run(()=>supabase.rpc('sx_add_group_members',{p_thread_id:threadId,p_user_ids:picked}),()=>{setPicked([]);setMode('info')})}
 function togglePick(id:string){setNotice('');setPicked(v=>v.includes(id)?v.filter(x=>x!==id):canSelectMore(count,v.length)?[...v,id]:(setNotice(validateAdd(count,[...v,id])??''),v))}
 function askLeave(){confirm.ask({title:'Groep verlaten?',message:`Je verlaat "${title}". Je ziet deze groep en de berichten niet meer, tenzij iemand je opnieuw toevoegt.`,confirmLabel:'Verlaten',destructive:true},async()=>{const {error}=await supabase.rpc('sx_leave_group',{p_thread_id:threadId});if(error)return errText(error);onLeft();return null})}

 const header=(label:string,back?:()=>void)=><View style={s.top}><Pressable onPress={back??onClose} accessibilityLabel={back?'Terug naar groepsinfo':'Groepsinfo sluiten'} style={s.topBtn}><Ionicons name={back?'chevron-back':'chevron-down'} size={26} color={C.text}/></Pressable><Text style={s.topTitle}>{label}</Text><View style={s.topBtn}/></View>;
 return <Modal visible={visible} animationType="slide" transparent onRequestClose={mode==='info'?onClose:()=>setMode('info')}>
  <View style={s.shade}><View testID="group-info" style={[s.sheet,{paddingTop:12,paddingBottom:Math.max(insets.bottom,18)}]}>
  {mode==='info'&&<>{header('Groepsinfo')}
   <ScrollView contentContainerStyle={{paddingBottom:12}}>
    <View style={s.hero}><View style={s.stack}>{sorted.slice(0,3).map((m,i)=><View key={m.id} style={[s.stackItem,{marginLeft:i?-18:0,zIndex:3-i}]}>{m.id===me?<OwnAvatar userId={me} size={58}/>:<FriendAvatar id={m.id} outfit={outfits.get(m.id)} size={58} name={m.name}/>}</View>)}</View>
     <Text style={s.groupName} numberOfLines={2}>{title}</Text><Text style={s.sub}>{count} {count===1?'lid':'leden'} · max {GROUP_MAX_MEMBERS}</Text></View>
    <View style={s.card}>
     {canRename(isMember)&&<Row icon="pencil" label="Groepsnaam wijzigen" onPress={()=>{setDraft(title);setNotice('');setMode('rename')}}/>}
     {isMember&&!!onWallpaper&&<Row icon="image" testID="group-info-wallpaper" label="Chat-achtergrond" hint={wp&&wp!=='none'?wallpaperLabel(wp):'Geen'} onPress={onWallpaper}/>}
     {isMember&&<Row icon="person-add" label="Leden toevoegen" hint={canAddMembers(isMember,count)?`Nog ${GROUP_MAX_MEMBERS-count} plekken`:'Groep is vol'} disabled={!canAddMembers(isMember,count)} onPress={()=>{setNotice('');setPicked([]);setMode('add')}}/>}
    </View>
    <Text style={s.section}>LEDEN ({count})</Text>
    <Text style={s.hint}>Houd een lid ingedrukt voor acties</Text>
    <View style={s.card}>{sorted.map(m=><Pressable key={m.id} style={s.member} testID={`group-member-${m.id}`} onLongPress={()=>memberMenu.open(m)} onPress={()=>memberMenu.open(m)} delayLongPress={350} accessibilityRole="button" accessibilityHint="Lang indrukken voor profiel, bericht en beheer">
     {m.id===me?<OwnAvatar userId={me} size={44}/>:<FriendAvatar id={m.id} outfit={outfits.get(m.id)} size={44} name={m.name}/>}
     <View style={{flex:1}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={s.memberName} numberOfLines={1}>{m.id===me?`${m.name} (jij)`:m.name}</Text><MemberRoleIcon isAdmin={m.id===creatorId} canRemove={removers.includes(m.id)}/></View>{m.id===creatorId?<Text style={s.badge}>Beheerder</Text>:removers.includes(m.id)?<Text style={s.badge}>Kan leden verwijderen</Text>:null}</View>
     <Ionicons name="ellipsis-horizontal" size={18} color={C.muted}/>
    </Pressable>)}</View>
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    {isMember&&<Pressable onPress={askLeave} style={s.leave} accessibilityLabel="Groep verlaten"><Ionicons name="exit-outline" size={21} color="#FF6B81"/><Text style={s.leaveText}>Groep verlaten</Text></Pressable>}
   </ScrollView></>}
  {mode==='rename'&&<>{header('Groepsnaam',()=>setMode('info'))}
   <View style={{padding:20,gap:12}}><Text style={s.label}>Naam van de groep</Text>
    <TextInput value={draft} onChangeText={v=>{setDraft(v);setNotice('')}} maxLength={GROUP_TITLE_MAX} autoFocus placeholder="Bijv. Weekend crew" placeholderTextColor={C.muted} style={s.input} onSubmitEditing={saveName} returnKeyType="done" accessibilityLabel="Naam van de groep"/>
    <Text style={s.counter}>{draft.trim().length}/{GROUP_TITLE_MAX}</Text>
    <Text style={s.sub2}>Iedereen in de groep ziet de nieuwe naam en een melding in de chat.</Text>
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    <Pressable onPress={saveName} disabled={busy||!normalizeGroupTitle(draft)} style={[s.primary,(busy||!normalizeGroupTitle(draft))&&{opacity:.5}]} accessibilityLabel="Naam opslaan">{busy?<ActivityIndicator color={C.text}/>:<Text style={s.primaryText}>Opslaan</Text>}</Pressable>
   </View></>}
  {mode==='add'&&<>{header('Leden toevoegen',()=>setMode('info'))}
   <Text style={[s.sub2,{paddingHorizontal:20}]}>{count+picked.length}/{GROUP_MAX_MEMBERS} leden · kies vrienden om toe te voegen</Text>
   <ScrollView style={{flexGrow:0,maxHeight:440}} contentContainerStyle={{paddingHorizontal:20,paddingVertical:8}}>
    {friends===null?<ActivityIndicator color={violet} style={{marginTop:30}}/>:candidates.length===0?<Text style={[s.sub2,{textAlign:'center',marginTop:30}]}>Al je vrienden zitten al in deze groep.</Text>:
     candidates.map(f=><Pressable key={f.id} onPress={()=>togglePick(f.id)} style={s.member} accessibilityLabel={`${f.name} ${picked.includes(f.id)?'niet ':''}toevoegen`}><FriendAvatar id={f.id} outfit={outfits.get(f.id)} size={44} name={f.name}/><Text style={[s.memberName,{flex:1}]}>{f.name}</Text><Ionicons name={picked.includes(f.id)?'checkmark-circle':'ellipse-outline'} size={27} color={violet}/></Pressable>)}
   </ScrollView>
   {!!notice&&<Text style={s.notice}>{notice}</Text>}
   <View style={{paddingHorizontal:20,paddingTop:8}}><Pressable onPress={addPicked} disabled={busy||!picked.length} style={[s.primary,(busy||!picked.length)&&{opacity:.5}]} accessibilityLabel="Geselecteerde vrienden toevoegen">{busy?<ActivityIndicator color={C.text}/>:<Text style={s.primaryText}>Toevoegen{picked.length?` (${picked.length})`:''}</Text>}</Pressable></View></>}
  {confirm.dialog}
  {memberMenu.sheet}
  </View></View></Modal>;
}

function Row({icon,label,hint,onPress,disabled,testID}:{icon:React.ComponentProps<typeof Ionicons>['name'];label:string;hint?:string;onPress:()=>void;disabled?:boolean;testID?:string}){
 return <Pressable onPress={onPress} disabled={disabled} testID={testID} style={[s.row,disabled&&{opacity:.45}]} accessibilityLabel={label}><View style={s.rowIcon}><Ionicons name={icon} size={18} color="#E9D3FA"/></View><Text style={s.rowLabel}>{label}</Text>{!!hint&&<Text style={s.rowHint}>{hint}</Text>}<Ionicons name="chevron-forward" size={18} color={C.muted}/></Pressable>;
}

const s=StyleSheet.create({
 hint:{color:C.muted,fontSize:12,marginHorizontal:20,marginBottom:6},
 shade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{backgroundColor:'#191426',borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'94%',minHeight:'70%'},
 top:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingBottom:6},topBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},topTitle:{flex:1,textAlign:'center',color:C.text,fontSize:18,fontWeight:'800'},
 hero:{alignItems:'center',paddingVertical:14,gap:6},stack:{flexDirection:'row',marginBottom:6},stackItem:{borderRadius:34,borderWidth:3,borderColor:'#191426',overflow:'hidden'},
 groupName:{color:C.text,fontSize:24,fontWeight:'800',textAlign:'center',paddingHorizontal:24},sub:{color:'#C4B9D1',fontSize:14},
 card:{marginHorizontal:16,marginTop:8,backgroundColor:'#241D35',borderRadius:18,paddingHorizontal:14,paddingVertical:4},
 row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13},rowIcon:{width:32,height:32,borderRadius:16,backgroundColor:'#51427980',alignItems:'center',justifyContent:'center'},rowLabel:{flex:1,color:C.text,fontSize:16,fontWeight:'600'},rowHint:{color:C.muted,fontSize:12},
 section:{color:'#B9A8CF',fontSize:12,fontWeight:'800',letterSpacing:.8,marginTop:20,marginHorizontal:22},
 member:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:9},memberName:{color:C.text,fontSize:16,fontWeight:'600'},badge:{color:'#D6B8F3',fontSize:12,marginTop:2},
 removeBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,borderRadius:14,backgroundColor:'#3A1F33'},removeText:{color:'#FF8FA8',fontSize:12,fontWeight:'700'},
 leave:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginHorizontal:16,marginTop:22,paddingVertical:15,borderRadius:18,backgroundColor:'#2E1A2A'},leaveText:{color:'#FF6B81',fontSize:16,fontWeight:'800'},
 label:{color:'#C4B9D1',fontSize:13,fontWeight:'700'},input:{color:C.text,backgroundColor:'#302840',borderRadius:15,padding:14,fontSize:17},counter:{color:C.muted,fontSize:12,alignSelf:'flex-end'},sub2:{color:'#C4B9D1',fontSize:14,lineHeight:20},
 primary:{backgroundColor:violet,borderRadius:24,paddingVertical:15,alignItems:'center'},primaryText:{color:C.text,fontSize:16,fontWeight:'800'},
 notice:{color:'#FFB4C2',backgroundColor:'#481D35',marginHorizontal:16,marginTop:10,padding:10,borderRadius:12,fontSize:13},
});
