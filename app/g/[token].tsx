import React,{useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from 'react-native';
import {Redirect,Stack,router,useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {GalaxyScreen} from '../../components/GalaxyScreen';
import {useSession} from '../../hooks/useSession';
import {friendlyError} from '../../lib/db-errors';
import {GROUP_INVITE_TEXT,groupInviteErrorText,parseGroupInviteSegment} from '../../lib/group-invite';
import {setPendingGroupInvite} from '../../lib/pending-add';
import {supabase} from '../../lib/supabase';

/** snapshot-x.nl/g/<token> — join a group via invite link (web + App Link). */
export default function GroupInvite(){
 const {token:raw}=useLocalSearchParams<{token:string|string[]}>(),seg=Array.isArray(raw)?raw[0]:raw??'';
 const token=parseGroupInviteSegment(seg);
 const {session,ready}=useSession();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');

 if(ready&&!session&&token){setPendingGroupInvite(token);return <Redirect href="/(auth)/login"/>;}
 if(session&&token)setPendingGroupInvite(null);

 async function join(){
  if(!token||busy)return;
  setBusy(true);setNotice('');
  const {data,error}=await supabase.rpc('sx_join_group_invite',{p_token:token});
  setBusy(false);
  if(error){setNotice(groupInviteErrorText(error)??friendlyError(error,'Lid worden'));return}
  router.replace({pathname:'/chat/[id]',params:{id:String(data)}});
 }

 return <GalaxyScreen>
  <Stack.Screen options={{title:'Groepsuitnodiging'}}/>
  <View style={s.wrap} testID="group-invite">
   {!token?<Text style={s.text}>Deze uitnodigingslink is ongeldig.</Text>:
    <>
     <View style={s.icon}><Ionicons name="people" size={40} color="#111"/></View>
     <Text style={s.title}>Uitnodiging voor een groep</Text>
     <Text style={s.text}>Tik op Lid worden om deze groep te openen. Ben je al lid, dan ga je meteen naar de chat.</Text>
     <Pressable testID="group-invite-join" disabled={busy||!session} onPress={()=>void join()} style={[s.btn,(busy||!session)&&{opacity:.6}]}>
      {busy?<ActivityIndicator color="#111"/>:<><Ionicons name="enter-outline" size={20} color="#111"/><Text style={s.btnText}>{GROUP_INVITE_TEXT.join}</Text></>}
     </Pressable>
    </>}
   {!!notice&&<Text style={s.notice} testID="group-invite-notice">{notice}</Text>}
   <Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)')} style={s.link}><Text style={s.linkText}>Terug</Text></Pressable>
  </View>
 </GalaxyScreen>;
}

const s=StyleSheet.create({
 wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:12},
 icon:{width:72,height:72,borderRadius:36,backgroundColor:'#FFFC00',alignItems:'center',justifyContent:'center',marginBottom:8},
 title:{color:'white',fontSize:24,fontWeight:'800',textAlign:'center'},
 text:{color:'#E8E2F5',textAlign:'center',fontSize:15,maxWidth:340,lineHeight:22},
 btn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFFC00',paddingHorizontal:28,paddingVertical:14,borderRadius:26,marginTop:8},
 btnText:{color:'#111',fontWeight:'800',fontSize:16},
 notice:{color:'white',backgroundColor:'#ffffff1f',padding:12,borderRadius:14,textAlign:'center',maxWidth:340},
 link:{padding:12},linkText:{color:'#CFC8E0',fontWeight:'700'},
});
