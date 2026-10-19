import React,{useCallback,useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {Media} from '../../components/Media';
import type {Story} from '../../lib/types';

import {friendlyError} from '../../lib/db-errors';
export default function Videos(){const [videos,setVideos]=useState<Story[]>([]),[notice,setNotice]=useState(''),insets=useSafeAreaInsets();
 const load=useCallback(async()=>{const {data,error}=await supabase.from('sx_stories').select('*').eq('visibility','everyone').eq('media_type','video').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(40);if(error)setNotice(friendlyError(error));else{setVideos(data||[]);setNotice('')}},[]);
 useFocusEffect(useCallback(()=>{void load()},[load]));
 return <View style={[s.root,{paddingTop:insets.top+12}]}><Text style={s.title}>Video’s</Text><Text style={s.sub}>Openbare momenten uit SnapShot X</Text>{!!notice&&<Text style={s.sub}>{notice}</Text>}<FlatList data={videos} numColumns={2} keyExtractor={x=>x.id} onRefresh={()=>void load()} refreshing={false} contentContainerStyle={{padding:12,flexGrow:1}} ListEmptyComponent={<View style={s.empty}><Ionicons name="videocam-outline" size={48} color="#C99AE8"/><Text style={s.sub}>Nog geen openbare video’s.</Text><Pressable onPress={()=>router.push('/(tabs)')} style={s.action}><Text style={s.actionText}>Maak een video</Text></Pressable><Pressable onPress={()=>router.push('/discover')} style={s.link}><Text style={s.actionText}>Ontdek alle verhalen</Text></Pressable></View>} renderItem={({item})=><Pressable onPress={()=>router.push({pathname:'/story/[id]',params:{id:item.id}})} style={s.card}><Media path={item.media_path} type="video" style={s.media}/><Text numberOfLines={2} style={s.caption}>{item.caption||'Bekijk video'}</Text></Pressable>}/></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},title:{color:C.text,fontSize:28,fontWeight:'900',marginHorizontal:18},sub:{color:C.muted,fontSize:15,margin:18},card:{width:'47%',height:240,margin:'1.5%',borderRadius:18,overflow:'hidden',backgroundColor:C.elevated},media:{width:'100%',height:'100%'},caption:{color:C.text,backgroundColor:'#000A',position:'absolute',bottom:0,width:'100%',padding:10,fontWeight:'800'},empty:{flex:1,alignItems:'center',justifyContent:'center',paddingTop:90},action:{backgroundColor:'#A82BCE',borderRadius:20,padding:13},link:{padding:14},actionText:{color:C.text,fontWeight:'800'}});
