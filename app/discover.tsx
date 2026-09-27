import React,{useEffect,useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '../lib/supabase';
import {Media} from '../components/Media';
import {Page,Title,Hint} from '../components/UI';
import {C} from '../lib/theme';
import type {Story} from '../lib/types';
export default function Discover(){const [rows,setRows]=useState<Story[]>([]);useEffect(()=>{supabase.from('sx_stories').select('*').eq('visibility','everyone').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(30).then(({data})=>setRows(data||[]))},[]);return <Page><Title>Discover ✦</Title><Hint>Openbare verhalen uit de community.</Hint><FlatList data={rows} keyExtractor={x=>x.id} numColumns={2} ListEmptyComponent={<Hint>Er is nog geen openbare content.</Hint>} renderItem={({item})=><Pressable style={s.card} onPress={()=>router.push({pathname:'/story/[id]',params:{id:item.id}})}><Media path={item.media_path} type={item.media_type} style={{width:'100%',height:'100%'}}/><Text style={s.caption}>{item.caption||'Bekijk verhaal'}</Text></Pressable>}/></Page>}
const s=StyleSheet.create({card:{width:'47%',height:235,margin:'1.5%',borderRadius:20,overflow:'hidden',backgroundColor:C.elevated},caption:{color:C.text,backgroundColor:'#0009',position:'absolute',bottom:0,width:'100%',padding:10}});
