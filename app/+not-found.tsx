import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Stack,router,usePathname} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {notFoundCopy} from '../lib/not-found';

/** Unknown link (typo, old link, removed page): friendly Dutch page instead of the default "Unmatched Route". */
export default function NotFound(){
 const path=usePathname(),c=notFoundCopy(path);
 return <GalaxyScreen><Stack.Screen options={{headerShown:false,title:'Niet gevonden'}}/>
  <View style={s.wrap} testID="not-found">
   <View style={s.badge}><Ionicons name="help-buoy-outline" size={56} color="#FFFC00"/></View>
   <Text style={s.code}>404</Text>
   <Text style={s.title} accessibilityRole="header">{c.title}</Text>
   <Text style={s.body}>{c.body}</Text>
   {!!c.path&&<Text style={s.path} numberOfLines={1}>{c.path}</Text>}
   <Pressable testID="not-found-home" accessibilityRole="button" onPress={()=>router.replace('/')} style={s.btn}><Ionicons name="home" size={20} color="#111"/><Text style={s.btnText}>Naar SnapShot X</Text></Pressable>
   {c.addHint&&<Pressable accessibilityRole="button" onPress={()=>router.replace('/(tabs)/friends')} style={s.link}><Text style={s.linkText}>Vrienden zoeken</Text></Pressable>}
   <Pressable accessibilityRole="link" onPress={()=>router.push('/help')} style={s.link}><Text style={s.linkText}>Help en support</Text></Pressable>
  </View></GalaxyScreen>;
}
const s=StyleSheet.create({wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:10},badge:{width:110,height:110,borderRadius:55,borderWidth:3,borderColor:'#FFFC00',alignItems:'center',justifyContent:'center',marginBottom:6},
 code:{color:'#CFC8E0',fontSize:14,fontWeight:'800',letterSpacing:4},title:{color:'white',fontSize:26,fontWeight:'800',textAlign:'center'},body:{color:'#E8E2F5',fontSize:15,textAlign:'center',maxWidth:340},
 path:{color:'#9F95B0',fontSize:13,maxWidth:340,fontFamily:'monospace'},btn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFFC00',paddingHorizontal:28,paddingVertical:14,borderRadius:26,marginTop:12},
 btnText:{color:'#111',fontWeight:'800',fontSize:16},link:{padding:10},linkText:{color:'#CFC8E0',fontWeight:'700'}});
