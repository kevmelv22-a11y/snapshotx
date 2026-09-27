import React,{useCallback,useEffect,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import * as Location from 'expo-location';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import FriendMap from '../components/FriendMap';
import type {Pin} from '../components/FriendMap.native';
import {C} from '../lib/theme';
import {Button,Hint} from '../components/UI';
export default function MapScreen(){const {session}=useSession(),uid=session?.user.id,[pins,setPins]=useState<Pin[]>([]),[sharing,setSharing]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{if(!uid)return;const {data,error}=await supabase.from('sx_locations').select('user_id,latitude,longitude,sharing');if(error){setNotice(error.message);return}setSharing(!!data?.find(x=>x.user_id===uid)?.sharing);const ids=(data||[]).map(x=>x.user_id);const p=ids.length?await supabase.from('profiles').select('id,display_name').in('id',ids):null;setPins((data||[]).filter(x=>x.sharing).map(x=>({id:x.user_id,name:p?.data?.find(v=>v.id===x.user_id)?.display_name||'Vriend',latitude:x.latitude,longitude:x.longitude})))},[uid]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
 async function toggle(){if(!uid)return;try{if(sharing){const {error}=await supabase.from('sx_locations').update({sharing:false}).eq('user_id',uid);if(error)throw error;setSharing(false);setNotice('Ghost mode aan: locatie verborgen.')}else{const permission=await Location.requestForegroundPermissionsAsync();if(!permission.granted)throw new Error('Locatietoegang niet toegestaan');const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});const {error}=await supabase.from('sx_locations').upsert({user_id:uid,latitude:pos.coords.latitude,longitude:pos.coords.longitude,sharing:true,updated_at:new Date().toISOString()});if(error)throw error;setSharing(true);setNotice('Je locatie wordt tot 24 uur met vrienden gedeeld.')}await load()}catch(e){setNotice((e as Error).message)}}
 return <View style={s.root}><View style={s.top}><Text style={s.title}>Snap Map</Text><Button onPress={toggle} secondary>{sharing?'Ghost mode aanzetten':'Locatie delen met vrienden'}</Button>{!!notice&&<Hint>{notice}</Hint>}</View><FriendMap pins={pins}/></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},top:{padding:16},title:{color:C.text,fontSize:25,fontWeight:'900'}});
