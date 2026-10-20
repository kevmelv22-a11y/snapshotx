import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,Path,Rect,Stop} from 'react-native-svg';
import {Stack} from 'expo-router';
import {SnapEditorLayers,SnapEditorTools,useSnapEditor} from '../components/SnapEditor';
import {timingSummary} from '../lib/snap-edit';
import {C} from '../lib/theme';

/** Dev-only harness: the snap editor over a local mock photo. No Supabase, no camera, works on Expo web. */
export default function DevSnapEditor(){
  const ed=useSnapEditor();
  if(!__DEV__)return null;
  return <View style={{flex:1,backgroundColor:C.bg}}>
    <Stack.Screen options={{headerShown:false}}/>
    <View style={{flex:1}}>
      <MockPhoto/>
      <SnapEditorLayers ed={ed}/>
    </View>
    {ed.tool==='none'&&<View style={{position:'absolute',left:0,right:0,bottom:0,padding:14,backgroundColor:'#0009'}}><Text testID="debug" style={{color:C.yellow,textAlign:'center'}}>MOCK · {ed.strokes.length} lijnen · {ed.stickers.length} stickers · tekst: {ed.text?.style??'-'} · {timingSummary(ed.timing)}</Text></View>}
    <SnapEditorTools ed={ed} top={20}/>
  </View>;
}

/** Stand-in "photo" (beach at sunset) drawn with SVG, so no network or camera is needed. */
function MockPhoto(){return <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
  <Defs><LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#3a1c71"/><Stop offset="0.5" stopColor="#d76d77"/><Stop offset="1" stopColor="#ffaf7b"/></LinearGradient>
  <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#1e6091"/><Stop offset="1" stopColor="#184e77"/></LinearGradient></Defs>
  <Rect width="390" height="844" fill="url(#sky)"/><Circle cx="195" cy="470" r="70" fill="#ffd166"/>
  <Rect y="480" width="390" height="200" fill="url(#sea)"/><Path d="M0 680 Q195 640 390 680 L390 844 L0 844 Z" fill="#e9c46a"/>
</Svg>}
