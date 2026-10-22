import React,{useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {useFriendEmojis} from '../stores/friendEmojis';
import {DEFAULT_FRIEND_EMOJIS,EMOJI_CHOICES,FRIEND_EMOJI_INFO,emojiFor,infoFor,type FriendEmojiKind} from '../lib/friend-emojis';

/** Snapchat Instellingen → Vriend-emoji's: see what each emoji means and pick your own. */
export default function FriendEmojisScreen(){
 const {session}=useSession(),uid=session?.user.id??'',insets=useSafeAreaInsets();
 const choices=useFriendEmojis(st=>uid?st.choices[uid]:undefined),choose=useFriendEmojis(st=>st.choose),reset=useFriendEmojis(st=>st.reset);
 const [editing,setEditing]=useState<FriendEmojiKind|null>(null);
 const custom=!!choices&&Object.keys(choices).length>0;
 return <GalaxyScreen><Stack.Screen options={{headerShown:false}}/>
  <View style={[s.header,{paddingTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/settings')} accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" size={27} color="white"/></Pressable><Text style={s.title}>{"Vriend-emoji's"}</Text><View style={{width:27}}/></View>
  <ScrollView contentContainerStyle={[s.content,{paddingBottom:insets.bottom+40}]} testID="friend-emojis">
   <Text style={s.intro}>{"Deze emoji's staan naast de namen van je vrienden in Chat en op hun Vriendschapsprofiel. Alleen jij ziet ze. Tik op een emoji om hem te wijzigen."}</Text>
   {FRIEND_EMOJI_INFO.map(info=>{const e=emojiFor(info.kind,choices),changed=e!==DEFAULT_FRIEND_EMOJIS[info.kind];return <Pressable key={info.kind} style={s.row} onPress={()=>setEditing(info.kind)} testID={`fe-row-${info.kind}`} accessibilityLabel={`${info.title}: ${e}. Wijzigen`}>
    <Text style={s.emoji}>{e}</Text><View style={{flex:1}}><Text style={s.rowTitle}>{info.title}{changed?<Text style={s.changed}>  · aangepast</Text>:null}</Text><Text style={s.desc}>{info.description}</Text></View><Ionicons name="chevron-forward" size={19} color="#AAA4B4"/></Pressable>})}
   {custom&&<Pressable style={s.reset} onPress={()=>uid&&reset(uid)} testID="fe-reset"><Text style={s.resetText}>{"Standaard-emoji's herstellen"}</Text></Pressable>}
  </ScrollView>
  <Modal visible={!!editing} transparent animationType="fade" onRequestClose={()=>setEditing(null)}><Pressable style={s.shade} onPress={()=>setEditing(null)}><Pressable onPress={()=>{}} style={[s.sheet,{paddingBottom:Math.max(22,insets.bottom)}]} testID="fe-picker">{editing&&<>
   <Text style={s.sheetTitle}>{infoFor(editing).title}</Text><Text style={s.desc}>{infoFor(editing).description}</Text>
   <View style={s.grid}>{EMOJI_CHOICES.map(e=>{const on=emojiFor(editing,choices)===e;return <Pressable key={e} onPress={()=>{if(uid)choose(uid,editing,e);setEditing(null)}} style={[s.cell,on&&s.cellOn]} testID={`fe-choice-${e}`} accessibilityLabel={`${e} kiezen`} accessibilityState={{selected:on}}><Text style={s.cellText}>{e}</Text></Pressable>})}</View>
   <Pressable style={s.reset} onPress={()=>{if(uid)choose(uid,editing,null);setEditing(null)}} testID="fe-default"><Text style={s.resetText}>Standaard ({DEFAULT_FRIEND_EMOJIS[editing]})</Text></Pressable>
  </>}</Pressable></Pressable></Modal>
 </GalaxyScreen>;
}
const s=StyleSheet.create({header:{paddingHorizontal:18,paddingBottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:21,fontWeight:'800'},content:{padding:16,gap:6},intro:{color:'#C9C1D6',fontSize:14,lineHeight:20,marginBottom:8},row:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'#1A142599',borderRadius:14,paddingVertical:12,paddingHorizontal:14},emoji:{fontSize:30,width:40,textAlign:'center'},rowTitle:{color:'#F1ECF6',fontSize:16,fontWeight:'700'},changed:{color:'#FFFC00',fontSize:13,fontWeight:'700'},desc:{color:'#AAA6B5',fontSize:13,marginTop:3},reset:{marginTop:14,alignItems:'center',paddingVertical:13,borderRadius:18,backgroundColor:'#2C2440'},resetText:{color:'white',fontWeight:'800',fontSize:15},shade:{flex:1,backgroundColor:'#0008',justifyContent:'flex-end'},sheet:{backgroundColor:'#1C1528',borderTopLeftRadius:26,borderTopRightRadius:26,padding:20,gap:6},sheetTitle:{color:'white',fontSize:20,fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12,justifyContent:'center'},cell:{width:50,height:50,borderRadius:25,alignItems:'center',justifyContent:'center',backgroundColor:'#2A2238'},cellOn:{backgroundColor:'#5B3A88',borderWidth:2,borderColor:'#FFFC00'},cellText:{fontSize:26}});
