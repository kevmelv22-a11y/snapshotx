import React,{useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,useLocalSearchParams} from 'expo-router';
import {C} from '../lib/theme';
import {WALLPAPERS,applyBffPin,isPinnedBff,rewatchCount,rewatchLabel,sortStoryReplies,wallpaperFor,type PlanId} from '../lib/plus';
import {AppIconPicker,Locked,NameWithBadge,Paywall,PriorityReplyBadge,RewatchPill,WallpaperBackground,WallpaperPicker} from '../components/plus/PlusParts';

/** Dev-only harness for Snapshot X+ with local mock data (no Supabase, no store).
 *  ?scene=paywall|icons|icons_free|rewatch|replies|badge|wallpaper|bff|bff_free  ?plus=0 for a non-subscriber. */
const now=Date.parse('2026-10-13T12:00:00Z');
export default function DevPlus(){
  const {scene='paywall',plus:pq}=useLocalSearchParams<{scene?:string;plus?:string}>();
  const plus=pq!=='0'&&!scene.endsWith('_free');
  const [plan,setPlan]=useState<PlanId>('sx_plus_yearly');const [icon,setIcon]=useState('neon');const [wp,setWp]=useState<Record<string,string>>({t1:'aurora'});
  let body:React.ReactNode=null;
  if(scene==='paywall')body=<Paywall selected={plan} onSelect={setPlan} onBuy={()=>{}} onRestore={()=>{}} onTerms={()=>{}} onPrivacy={()=>{}}/>;
  else if(scene.startsWith('icons'))body=<View style={s.p}><Text style={s.h}>App-icoon</Text>{!plus&&<Locked onUpgrade={()=>{}}/>}<AppIconPicker value={plus?icon:'default'} plus={plus} onChange={setIcon}/></View>;
  else if(scene==='rewatch'){const v=(id:string)=>({viewerId:id,storyId:'s1',at:''});const n=rewatchCount([v('a'),v('a'),v('b'),v('c'),v('c'),v('d'),v('me'),v('me')],'s1','me');
    body=<View style={s.story}><View style={s.storyImg}><Text style={{fontSize:80}}>🌅</Text></View><View style={s.storyBar}><Ionicons name="eye" size={16} color="white"/><Text style={s.w}>4 kijkers</Text><RewatchPill label={rewatchLabel(n,plus)}/></View></View>;}
  else if(scene==='replies'){const r=(id:string,name:string,p:boolean,min:number,text:string)=>({id,senderId:id,senderPlus:p,at:new Date(now-min*60000).toISOString(),name,text});
    const list=sortStoryReplies([r('1','Aria',false,1,'Mooi!'),r('2','Bram',true,12,'Waar is dit? 😍'),r('3','Cleo',false,4,'Wauw'),r('4','Daan',true,30,'Neem mij mee')]);
    body=<View style={s.p}><Text style={s.h}>Reacties op je verhaal</Text>{list.map(x=><View key={x.id} style={s.reply}><View style={s.av}><Text style={s.w}>{x.name[0]}</Text></View><View style={{flex:1}}><View style={{flexDirection:'row',gap:6,alignItems:'center'}}><NameWithBadge name={x.name} plus={x.senderPlus}/>{x.senderPlus&&<PriorityReplyBadge/>}</View><Text style={s.m}>{x.text}</Text></View></View>)}</View>;}
  else if(scene==='badge')body=<View style={[s.p,{alignItems:'center'}]}><View style={[s.av,{width:110,height:110,borderRadius:55}]}><Text style={{fontSize:48}}>🙂</Text></View><NameWithBadge name="Kevin" plus={plus}/><Text style={s.m}>@kevin · 1.204 punten</Text><View style={s.card}><Text style={[s.w,{fontWeight:'800'}]}>Snapshot X+</Text><Text style={s.m}>{plus?'Lid sinds oktober 2026':'Niet geabonneerd'}</Text></View></View>;
  else if(scene==='wallpaper'){const id=wallpaperFor('t1',wp,plus);const w=WALLPAPERS.find(x=>x.id===id)!;
    body=<View style={{flex:1}}><View style={s.chat}><WallpaperBackground colors={w.colors}/><View style={[s.bub,{alignSelf:'flex-start'}]}><Text style={s.w}>Zin in zaterdag!</Text></View><View style={[s.bub,{alignSelf:'flex-end',backgroundColor:C.blue}]}><Text style={s.w}>Zeker 🔥</Text></View></View><View style={s.p}><Text style={s.h}>Achtergrond voor deze chat</Text><WallpaperPicker value={id} onChange={x=>setWp({...wp,t1:x})}/></View></View>;}
  else if(scene.startsWith('bff')){const fr=[{id:'a',n:'Aria',e:'🔥 12'},{id:'b',n:'Bram',e:'🔥 40'},{id:'c',n:'Cleo',e:'😊'},{id:'d',n:'Daan',e:''}];
    body=<View style={s.p}><Text style={s.h}>Beste vrienden</Text>{!plus&&<Locked onUpgrade={()=>{}}/>}{applyBffPin(fr,f=>f.id,'c',plus).map((f,i)=><View key={f.id} style={s.reply}><Text style={[s.m,{width:22}]}>#{i+1}</Text><View style={s.av}><Text style={s.w}>{f.n[0]}</Text></View><Text style={[s.w,{flex:1,fontWeight:'700'}]}>{f.n} {f.e}</Text>{isPinnedBff(f.id,'c',plus)?<View style={s.pin}><Ionicons name="pin" size={14} color={C.bg}/><Text style={{color:C.bg,fontWeight:'800',fontSize:12}}>Vast</Text></View>:<Pressable><Ionicons name="pin-outline" size={18} color={C.muted}/></Pressable>}</View>)}</View>;}
  return <ScrollView contentContainerStyle={{flexGrow:1,backgroundColor:C.bg}}><Stack.Screen options={{title:'X+ test'}}/>{body}</ScrollView>;
}
const s=StyleSheet.create({p:{padding:18,gap:12},h:{color:C.text,fontSize:18,fontWeight:'800'},w:{color:C.text},m:{color:C.muted,fontSize:13},
  story:{flex:1,minHeight:600,backgroundColor:'#3B1361'},storyImg:{flex:1,alignItems:'center',justifyContent:'center'},storyBar:{flexDirection:'row',alignItems:'center',gap:10,padding:16,backgroundColor:'#0006'},
  reply:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:C.surface,borderRadius:12,padding:10},av:{width:38,height:38,borderRadius:19,backgroundColor:C.purple,alignItems:'center',justifyContent:'center'},
  card:{backgroundColor:C.cardBg,borderRadius:14,padding:14,alignSelf:'stretch',marginTop:10},chat:{height:300,padding:14,gap:8,justifyContent:'flex-end',overflow:'hidden'},bub:{backgroundColor:C.elevated,borderRadius:16,padding:10},
  pin:{flexDirection:'row',gap:3,alignItems:'center',backgroundColor:C.yellow,borderRadius:10,paddingHorizontal:7,paddingVertical:3}});
