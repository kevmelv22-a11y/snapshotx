import React,{useEffect,useState} from 'react';
import {Image,View,ActivityIndicator,StyleSheet} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import {mediaUrl} from '../lib/media';
import {C} from '../lib/theme';
export function Media({path,type,style,ttl=300}:{path:string;type:'photo'|'video';style?:any;ttl?:number}) {
 const [loaded,setLoaded]=useState<{path:string;ttl:number;url:string}|null>(null);
 useEffect(()=>{let active=true;mediaUrl(path,ttl).then(url=>{if(active)setLoaded({path,ttl,url})}).catch(()=>{});return()=>{active=false}},[path,ttl]);
 const url=loaded?.path===path&&loaded.ttl===ttl?loaded.url:null;
 if(!url)return <View style={[styles.empty,style]}><ActivityIndicator color={C.yellow}/></View>;
 return type==='photo'?<Image source={{uri:url}} style={[styles.media,style]} resizeMode="cover"/>:<Clip uri={url} style={style}/>;
}
function Clip({uri,style}:{uri:string;style?:any}) {const player=useVideoPlayer(uri,p=>{p.loop=true;p.play()});return <VideoView player={player} style={[styles.media,style]} contentFit="cover" nativeControls/>}
const styles=StyleSheet.create({media:{width:'100%',height:'100%'},empty:{backgroundColor:C.elevated,alignItems:'center',justifyContent:'center'}});
