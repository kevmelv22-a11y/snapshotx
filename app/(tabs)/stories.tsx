import React,{useCallback,useEffect,useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '../../lib/supabase';
import {useSession} from '../../hooks/useSession';
import {C} from '../../lib/theme';
import {Media} from '../../components/Media';
import {Hint,Page,Title} from '../../components/UI';
import type {Story} from '../../lib/types';
export default function Stories(){const {session}=useSession(),[stories,setStories]=useState<Story[]>([]),[names,setNames]=useState<Record<string,string>>({}),[error,setError]=useState('');
 const load=useCallback(async()=>{const {data,error}=await supabase.from('sx_stories').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(80);if(error){setError(error.message);return}setStories(data||[]);const ids=[...new Set((data||[]).map(s=>s.owner_id))];if(ids.length){const p=await supabase.from('profiles').select('id,display_name').in('id',ids);setNames(Object.fromEntries((p.data||[]).map(x=>[x.id,x.display_name])))}},[]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);const ch=supabase.channel('sx-stories').on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_stories'},()=>void load()).subscribe();return()=>{clearTimeout(timer);void supabase.removeChannel(ch)}},[load]);
 return <Page><Title>Verhalen ✦</Title><Hint>Momenten verdwijnen na 24 uur.</Hint><Pressable onPress={()=>router.push('/(tabs)')} style={s.button}><Text style={{color:C.bg,fontWeight:'900'}}>＋ Maak een verhaal</Text></Pressable>{!!error&&<Hint>{error}</Hint>}<FlatList data={stories} numColumns={2} keyExtractor={x=>x.id} ListEmptyComponent={<Hint>Er zijn nog geen verhalen.</Hint>} renderItem={({item})=><Pressable onPress={()=>router.push({pathname:'/story/[id]',params:{id:item.id}})} style={s.card}><Media path={item.media_path} type={item.media_type} style={s.media}/><View style={s.label}><Text style={{color:C.text,fontWeight:'900'}}>{item.owner_id===session?.user.id?'Mijn verhaal':names[item.owner_id]||'Verhaal'}</Text></View></Pressable>}/></Page>
}
const s=StyleSheet.create({button:{backgroundColor:C.yellow,padding:13,borderRadius:19,alignSelf:'flex-start',margin:12},card:{width:'47%',height:230,margin:'1.5%',borderRadius:20,overflow:'hidden',backgroundColor:C.elevated},media:{width:'100%',height:'100%'},label:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#000A',padding:10}});
