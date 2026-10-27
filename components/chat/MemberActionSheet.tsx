import React,{useCallback,useState} from 'react';
import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {friendlyError} from '../../lib/db-errors';
import {useConfirmDialog} from '../ConfirmDialog';
import {MEMBER_ACTION,groupErrorText,memberActions,removeConfirmText,type MemberActionKey} from '../../lib/group-chat';

export type SheetMember={id:string;name:string};
type Opts={threadId:string;me:string;adminId:string|null;members:readonly SheetMember[];/** user ids with can_remove_members */removers:readonly string[];onChanged:()=>void;/** Close any parent modal before navigating away. */beforeNavigate?:()=>void};
const errText=(e:unknown)=>groupErrorText(e)??friendlyError(e);
const ICON:Record<MemberActionKey,React.ComponentProps<typeof Ionicons>['name']>={profile:'person-circle-outline',message:'chatbubble-outline',remove:'person-remove-outline',grant:'shield-checkmark-outline',revoke:'shield-outline'};

/**
 * Long-press menu for a group member: "Profiel bekijken", "Bericht sturen", and — only when lib/group-chat
 * memberActions() allows it — "Verwijderen uit groep" and the admin-only "Rechten geven/ontnemen". The server
 * (sx_remove_group_member / sx_set_can_remove_members) re-checks every action; this only hides what you can't do.
 */
export function useMemberActions({threadId,me,adminId,members,removers,onChanged,beforeNavigate}:Opts){
 const confirm=useConfirmDialog();
 const [target,setTarget]=useState<SheetMember|null>(null),[notice,setNotice]=useState('');
 const memberIds=members.map(m=>m.id);
 const actions=target?memberActions(me,target.id,{adminId,memberIds,removers}):[];
 const open=useCallback((m:SheetMember|null|undefined)=>{if(!m?.id)return;setNotice('');setTarget(m)},[]);
 const close=()=>setTarget(null);
 async function pick(k:MemberActionKey){
  const m=target;if(!m)return;
  if(k==='profile'){close();beforeNavigate?.();if(m.id===me)router.push('/(tabs)/profile');else router.push({pathname:'/friend/[id]',params:{id:m.id}});return}
  if(k==='message'){const {data,error}=await supabase.rpc('sx_open_thread',{participants:[m.id],group_title:null});if(error||!data){setNotice(error?friendlyError(error):'Chat openen lukt nu niet.');return}close();beforeNavigate?.();router.push({pathname:'/chat/[id]',params:{id:String(data)}});return}
  if(k==='grant'||k==='revoke'){const {error}=await supabase.rpc('sx_set_can_remove_members',{p_thread_id:threadId,p_user_id:m.id,p_value:k==='grant'});if(error){setNotice(errText(error));return}close();onChanged();return}
  close();
  confirm.ask({title:'Verwijderen uit groep',message:removeConfirmText(m.name),confirmLabel:'Verwijderen',destructive:true},async()=>{const {error}=await supabase.rpc('sx_remove_group_member',{p_thread_id:threadId,p_user_id:m.id});if(error)return errText(error);onChanged();return null});
 }
 const sheet=<>
  <Modal visible={!!target} transparent animationType="fade" onRequestClose={close}>
   <Pressable style={s.shade} onPress={close} accessibilityLabel="Menu sluiten">
    <Pressable style={s.sheet} testID="member-actions" onPress={()=>{}}>
     <View style={s.head}><Text style={s.name} numberOfLines={1}>{target?.name}{target?.id===me?' (jij)':''}</Text>
      {!!target&&target.id===adminId&&<View style={s.tag}><Text style={s.tagText}>👑 Beheerder</Text></View>}
      {!!target&&target.id!==adminId&&removers.includes(target.id)&&<View style={s.tag}><Text style={s.tagText}>🛡️ Kan leden verwijderen</Text></View>}</View>
     {actions.map(k=><Pressable key={k} testID={`member-action-${k}`} style={s.row} onPress={()=>void pick(k)} accessibilityRole="button" accessibilityLabel={MEMBER_ACTION[k]}>
      <Ionicons name={ICON[k]} size={21} color={k==='remove'?'#FF6B81':'#E9D3FA'}/><Text style={[s.label,k==='remove'&&{color:'#FF6B81'}]}>{MEMBER_ACTION[k]}</Text></Pressable>)}
     {!!notice&&<Text style={s.notice}>{notice}</Text>}
     <Pressable style={s.cancel} onPress={close} accessibilityRole="button"><Text style={s.cancelText}>Annuleren</Text></Pressable>
    </Pressable>
   </Pressable>
  </Modal>
  {confirm.dialog}
 </>;
 return {open,sheet};
}

/** Small badge next to a member name: crown for the admin, shield for members with remove rights. */
export function MemberRoleIcon({isAdmin,canRemove,size=14}:{isAdmin:boolean;canRemove:boolean;size?:number}){
 if(isAdmin)return <Text style={{fontSize:size}} accessibilityLabel="Beheerder" testID="badge-admin">👑</Text>;
 if(canRemove)return <Ionicons name="shield-checkmark" size={size} color="#7FD8FF" accessibilityLabel="Kan leden verwijderen" testID="badge-remover"/>;
 return null;
}

const s=StyleSheet.create({
 shade:{flex:1,backgroundColor:'rgba(0,0,0,.55)',justifyContent:'flex-end'},
 sheet:{backgroundColor:'#1D1726',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:16,paddingTop:14,paddingBottom:26,gap:4},
 head:{alignItems:'center',paddingBottom:10,gap:6},name:{color:'#fff',fontSize:18,fontWeight:'800'},
 tag:{backgroundColor:'#302840',borderRadius:12,paddingHorizontal:10,paddingVertical:3},tagText:{color:'#E9D3FA',fontSize:12,fontWeight:'700'},
 row:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:'#26202F'},
 label:{color:'#fff',fontSize:16,fontWeight:'600'},
 notice:{color:'#FFB4C2',backgroundColor:'#481D35',padding:10,borderRadius:12,fontSize:13},
 cancel:{alignItems:'center',paddingVertical:14,marginTop:4},cancelText:{color:'#C4B9D1',fontSize:16,fontWeight:'700'},
});
