import {useEffect,useState} from 'react';
import {Platform,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BACK_ONLINE_MS,connStep,connText,type ConnState} from '../../lib/connection-banner';

type Win={navigator?:{onLine?:boolean};addEventListener?:(t:string,l:()=>void)=>void;removeEventListener?:(t:string,l:()=>void)=>void};
const W=globalThis as Win;

/** Web only: a bar at the top while the browser is offline, then "Weer online" for a moment. */
export function OfflineBanner(){
 const [st,setSt]=useState<ConnState>(()=>({phase:W.navigator?.onLine===false?'offline':'online',since:Date.now()}));
 useEffect(()=>{if(Platform.OS!=='web'||!W.addEventListener)return;const on=()=>setSt(s=>connStep(s,true,Date.now())),off=()=>setSt(s=>connStep(s,false,Date.now()));
  W.addEventListener('online',on);W.addEventListener('offline',off);return()=>{W.removeEventListener?.('online',on);W.removeEventListener?.('offline',off)}},[]);
 useEffect(()=>{if(st.phase!=='back')return;const t=setTimeout(()=>setSt(s=>connStep(s,true,Date.now())),BACK_ONLINE_MS);return()=>clearTimeout(t)},[st]);
 const text=Platform.OS==='web'?connText(st):null;if(!text)return null;
 const off=st.phase==='offline';
 return <View pointerEvents="none" style={[s.bar,off?s.off:s.back]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID={off?'offline-banner':'online-banner'}><Ionicons name={off?'cloud-offline-outline':'cloud-done-outline'} size={16} color={off?'#FFE27A':'#0B2B1C'}/><Text style={[s.text,!off&&{color:'#0B2B1C'}]}>{text}</Text></View>;
}
const s=StyleSheet.create({bar:{position:'absolute',top:10,alignSelf:'center',zIndex:50,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingVertical:9,borderRadius:18,maxWidth:560},off:{backgroundColor:'#3B3320F2',borderWidth:1,borderColor:'#FFE27A66'},back:{backgroundColor:'#38E0A5'},text:{color:'#FFE27A',fontSize:13,fontWeight:'700',flexShrink:1}});
