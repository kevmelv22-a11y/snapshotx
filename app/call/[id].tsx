import React,{useEffect,useReducer,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C} from '../../lib/theme';
import {callStatusText,nextCallState,type CallEvent,type CallState} from '../../lib/chat-features';

/** Video call screen — UI ONLY (mock). There is no WebRTC/SFU backend yet: nothing is transmitted.
 *  `state` param lets the dev harness open a fixed state (ringing|connecting|active|ended). */
export default function CallScreen(){
  const {name='Vriend',state:initial}=useLocalSearchParams<{id:string;name?:string;state?:CallState}>();
  const insets=useSafeAreaInsets();
  const [state,dispatch]=useReducer((s:CallState,e:CallEvent)=>nextCallState(s,e),(initial as CallState)||'ringing');
  const [startedAt,setStartedAt]=useState<number|null>(()=>initial==='active'?Date.now()-83000:null),[now,setNow]=useState(()=>Date.now());
  // Start the call timer when the call becomes active (in the event, not in an effect).
  const send=(e:CallEvent)=>{if(startedAt===null&&nextCallState(state,e)==='active')setStartedAt(Date.now());dispatch(e)};
  const [muted,setMuted]=useState(false),[camOff,setCamOff]=useState(false),[front,setFront]=useState(true);
  useEffect(()=>{if(initial)return;const a=setTimeout(()=>send('answer'),2500),b=setTimeout(()=>{setStartedAt(t=>t??Date.now());dispatch('connected')},3500);return()=>{clearTimeout(a);clearTimeout(b)}},[initial]);
  useEffect(()=>{if(state==='ended'&&!initial){const t=setTimeout(()=>router.canGoBack()&&router.back(),1200);return()=>clearTimeout(t)}},[state,initial]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
  const active=state==='active';
  return <View style={s.root} testID="call-screen">
    <Stack.Screen options={{headerShown:false}}/>
    {/* Remote video stand-in */}
    <View style={[StyleSheet.absoluteFill,s.remote]}>
      <View style={s.avatar}><Text style={s.avatarText}>{String(name).slice(0,1).toUpperCase()}</Text></View>
      {active&&<Text style={s.remoteHint}>Video van {name}</Text>}
    </View>
    <View style={[s.top,{paddingTop:insets.top+16}]}>
      <Text style={s.name}>{name}</Text>
      <Text style={s.status}>{callStatusText(state,startedAt?now-startedAt:0)}</Text>
      <Text style={s.mock}>Demo — videobellen is nog niet beschikbaar</Text>
    </View>
    {/* Self view */}
    <View style={[s.self,{top:insets.top+120}]}>{camOff?<Text style={s.selfOff}>Camera uit</Text>:<Text style={s.selfOff}>Jij{front?'':' (achter)'}</Text>}</View>
    <View style={[s.controls,{paddingBottom:insets.bottom+24}]}>
      <Ctl icon={muted?'🔇':'🎙'} label={muted?'Dempen uit':'Dempen'} on={muted} onPress={()=>setMuted(v=>!v)}/>
      <Ctl icon={camOff?'🚫':'📹'} label={camOff?'Camera aan':'Camera uit'} on={camOff} onPress={()=>setCamOff(v=>!v)}/>
      <Ctl icon="🔄" label="Omdraaien" onPress={()=>setFront(v=>!v)}/>
      <Pressable onPress={()=>send('hangup')} accessibilityLabel="Ophangen" style={[s.ctl,s.hang]}><Text style={s.ctlIcon}>📞</Text></Pressable>
    </View>
  </View>;
}
function Ctl({icon,label,on,onPress}:{icon:string;label:string;on?:boolean;onPress:()=>void}){
  return <Pressable onPress={onPress} accessibilityLabel={label} style={[s.ctl,on&&{backgroundColor:C.text}]}><Text style={s.ctlIcon}>{icon}</Text></Pressable>;
}
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#000'},remote:{backgroundColor:'#1b1430',alignItems:'center',justifyContent:'center'},
  avatar:{width:140,height:140,borderRadius:70,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},avatarText:{color:C.text,fontSize:60,fontWeight:'800'},remoteHint:{color:C.muted,marginTop:14},
  top:{alignItems:'center',gap:4},name:{color:C.text,fontSize:26,fontWeight:'800'},status:{color:C.text,fontSize:16},mock:{color:C.yellow,fontSize:11,marginTop:4},
  self:{position:'absolute',right:16,width:100,height:150,borderRadius:16,backgroundColor:'#333a',borderWidth:2,borderColor:'#fff5',alignItems:'center',justifyContent:'center'},selfOff:{color:C.text,fontSize:12},
  controls:{position:'absolute',left:0,right:0,bottom:0,flexDirection:'row',justifyContent:'space-evenly',paddingTop:20,backgroundColor:'#0008'},
  ctl:{width:60,height:60,borderRadius:30,backgroundColor:'#ffffff2a',alignItems:'center',justifyContent:'center'},hang:{backgroundColor:'#ff3b30',transform:[{rotate:'135deg'}]},ctlIcon:{fontSize:24},
});
