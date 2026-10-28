import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router,Stack} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from './GalaxyScreen';
import type {LegalDoc} from '../lib/legal';

/** Privacybeleid / Gebruiksvoorwaarden page (lib/legal.ts). Works signed out too (login screen link, public web URL). */
export function LegalScreen({doc}:{doc:LegalDoc}){
 const insets=useSafeAreaInsets();
 const back=()=>router.canGoBack()?router.back():router.replace('/');
 return <GalaxyScreen><Stack.Screen options={{headerShown:false,title:doc.title}}/>
  <View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title} accessibilityRole="header">{doc.title}</Text><View style={{width:27}}/></View>
  <ScrollView contentContainerStyle={[s.content,{paddingBottom:Math.max(insets.bottom,20)+30}]} testID={`legal-${doc.route.slice(1)}`}>
   <Text style={s.updated}>Laatst bijgewerkt: {doc.updated}</Text>
   <Text style={s.intro}>{doc.intro}</Text>
   {doc.sections.map(sec=><View key={sec.heading} style={s.card}><Text style={s.heading}>{sec.heading}</Text>{sec.body.map((p,i)=><View key={i} style={s.para}>{sec.body.length>1&&<Text style={s.bullet}>•</Text>}<Text style={s.body}>{p}</Text></View>)}</View>)}
  </ScrollView>
 </GalaxyScreen>;
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:21,fontWeight:'800'},content:{padding:18},updated:{color:'#AAA6B5',fontSize:13,marginBottom:8},intro:{color:'#E8E2ED',fontSize:16,lineHeight:23,marginBottom:14},card:{backgroundColor:'#1A142599',borderRadius:14,padding:14,marginBottom:10,borderWidth:StyleSheet.hairlineWidth,borderColor:'#ACA2C74A'},heading:{color:'white',fontSize:17,fontWeight:'800',marginBottom:6},para:{flexDirection:'row',gap:7,marginTop:4},bullet:{color:'#DDC9EB',fontSize:15,lineHeight:21},body:{color:'#D6D0DE',fontSize:15,lineHeight:21,flex:1}});
