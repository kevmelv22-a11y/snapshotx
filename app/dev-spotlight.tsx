import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {Stack} from 'expo-router';
import {HighlightFeed,type HighlightItem} from '../components/spotlight/HighlightFeed';
import {rankFeed} from '../lib/spotlight';

/** Dev-only harness for the public vertical feed ("Uitgelicht") with mock data. No Supabase. */
const NOW=Date.parse('2026-10-13T12:00:00Z');
const it=(id:string,owner:string,hAgo:number,likes:number,shares:number,views:number,caption:string,liked=false):HighlightItem=>({id,owner_id:owner,created_at:new Date(NOW-hAgo*3600000).toISOString(),likes,shares,views,liked,caption,media_path:'mock',media_type:'photo'});
const ITEMS=rankFeed([it('p1','lotte',2,12450,830,98200,'Skaten bij het Museumplein 🛹 #amsterdam'),it('p2','sem',1,342,12,4100,'Mijn kat ontdekt de sneeuw ❄️🐈',true),it('p3','noor',20,1500000,42000,3900000,'Zonsopgang op de Veluwe')],NOW);
const BG:Record<string,string>={p1:'#283c86',p2:'#614385',p3:'#e96443'},EM:Record<string,string>={p1:'🛹',p2:'🐈',p3:'🌄'};
export default function DevSpotlight(){
 return <View style={{flex:1}}><Stack.Screen options={{headerShown:false}}/><HighlightFeed items={ITEMS} names={{lotte:'lotte.skate',sem:'sem_de_kat',noor:'noorbuiten'}} onClose={()=>{}} onReport={()=>{}} onShare={async()=>true}
  renderMedia={i=><View style={[StyleSheet.absoluteFill,{backgroundColor:BG[i.id],alignItems:'center',justifyContent:'center'}]}><Text style={{fontSize:110}}>{EM[i.id]}</Text><Text style={{color:'#FFFFFF88'}}>mock-snap {i.id}</Text></View>}/></View>;
}
