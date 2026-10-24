import React,{useEffect,useState} from 'react';
import {Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {C} from '../lib/theme';
import type {Message} from '../lib/types';
import {ChatHeaderBar,ChatView} from '../components/chat/ChatView';
import {RecordingBar,RetentionSheet,VoiceNoteView} from '../components/chat/ChatParts';
import {activeTypers,computeStreak,isMessageVisible,retentionChangeText,screenshotText,toggleReaction,typingText,type Reaction,type RetentionMode} from '../lib/chat-features';

/** Dev-only harness for step 4 chat features with local mock data. No Supabase, works on Expo web.
 *  ?scene=overview|reactions|retention|recording|risk|after_view|empty  (default overview). */
const ME='me',ARIA='aria',H=3600000;
export default function DevChat(){
  const {scene='overview'}=useLocalSearchParams<{scene?:string}>();
  const now=Date.parse('2026-10-13T12:00:00Z')+(scene==='risk'?8*H:0);
  const at=(minAgo:number)=>new Date(now-minAgo*60000).toISOString();
  const msg=(id:string,sender:string,kind:Message['kind'],body:string|null,minAgo:number):Message=>({id,thread_id:'demo',sender_id:sender,kind,body,media_path:kind==='voice'?'mock':null,view_once:false,expires_at:null,created_at:at(minAgo)});
  const all:Message[]=[
    msg('m9',ARIA,'text','Haha die is goed 😂',1),
    msg('m8',ME,'voice',null,3),
    msg('sys2',ARIA,'system',screenshotText('Aria',false),5),
    msg('m7',ARIA,'voice',null,6),
    msg('m6',ME,'text','Kijk deze dan, zonsondergang op het strand 🌅',8),
    msg('sys1',ME,'system',retentionChangeText('Jij','24h'),30),
    msg('m5',ARIA,'text','Zin in zaterdag!',45),
    msg('m4',ARIA,'text','Dit bericht heb je gisteren al gezien',60*20),
  ].map(m=>({...m}));
  const [retention,setRetention]=useState<RetentionMode>(scene==='after_view'?'after_view':'24h');
  const [sheet,setSheet]=useState(scene==='retention');
  const [reactions,setReactions]=useState<Reaction[]>([{messageId:'m6',userId:ARIA,emoji:'❤️'},{messageId:'m5',userId:ME,emoji:'🔥'},{messageId:'m9',userId:ME,emoji:'😂'},{messageId:'m9',userId:ARIA,emoji:'😂'}]);
  const [playing,setPlaying]=useState<string|null>(scene==='overview'?'m7':null);
  const [rec,setRec]=useState(scene==='recording'?12400:0);
  useEffect(()=>{if(scene!=='recording')return;const t=setInterval(()=>setRec(v=>v+200),200);return()=>clearInterval(t)},[scene]);
  // Viewed-at for received messages: m4 viewed 20 h ago (previous session), others just now.
  const sessionStart=now-2*60000;
  const viewedAt:Record<string,number>={m9:now-30000,m7:now-60000,m5:now-40*60000,m4:now-20*H};
  const rows=scene==='empty'?[]:all.filter(m=>m.sender_id===ME||m.kind==='system'||isMessageVisible(retention,viewedAt[m.id]??null,now,{leftAt:viewedAt[m.id]!==undefined&&viewedAt[m.id]<sessionStart?sessionStart:null}));
  // Streak: snaps both ways the last 6 days; today only I sent (in 'risk' it is late evening -> ⌛).
  const snaps=[];for(let d=1;d<=6;d++){snaps.push({senderId:ME,at:now-d*24*H},{senderId:ARIA,at:now-d*24*H+H})}snaps.push({senderId:ME,at:now-3*H});
  const streak=computeStreak(snaps,ME,ARIA,now,120);
  const typing=typingText(activeTypers({[ARIA]:now-1000},now,ME).map(()=> 'Aria'));
  if(!__DEV__)return null;
  return <View style={{flex:1,backgroundColor:C.bg}}>
    <Stack.Screen options={{headerShown:false}}/>
    <ChatHeaderBar title="Aria Nova" streak={streak} retention={retention} onRetention={()=>setSheet(true)} onCall={()=>router.push({pathname:'/call/[id]',params:{id:'demo',name:'Aria Nova'}})}/>
    <ChatView rows={rows} me={ME} reactions={reactions} retention={retention} viewedAt={viewedAt} now={now} streak={streak} typing={typing} pickerFor={scene==='reactions'?'m6':null}
      onReact={(m,e)=>setReactions(r=>toggleReaction(r,m,ME,e))}
      extraActions={(m,mine)=>mine?[]:[{label:'Meld bericht',onPress:()=>{}}]}
      renderContent={(m,mine)=>m.kind==='voice'?<VoiceNoteView seed={m.id} mine={mine} playing={playing===m.id} progress={playing===m.id?.42:0} positionMs={playing===m.id?3000:0} durationMs={m.id==='m7'?7200:4100} onToggle={()=>setPlaying(p=>p===m.id?null:m.id)}/>:<Text style={s.text}>{m.body}</Text>}/>
    {scene==='recording'?<RecordingBar durationMs={rec} level={.5+.5*Math.sin(rec/300)} onCancel={()=>setRec(0)} onStop={()=>setRec(0)}/>:
    <View style={s.inputRow}><Text style={s.action}>＋</Text><TextInput style={s.input} placeholder="Bericht…" placeholderTextColor={C.muted}/><Text style={s.action}>🎙</Text><Text style={s.send}>➤</Text></View>}
    <Text testID="debug" style={s.debug}>MOCK · scene={scene} · {rows.length}/{all.length} zichtbaar · retentie={retention}</Text>
    <RetentionSheet visible={sheet} mode={retention} onPick={setRetention} onClose={()=>setSheet(false)}/>
    <Pressable onPress={()=>router.push({pathname:'/call/[id]',params:{id:'demo',name:'Aria Nova',state:'active'}})}><Text style={s.debug}>→ Videogesprek (mock)</Text></Pressable>
  </View>;
}
const s=StyleSheet.create({text:{color:C.text,fontSize:16},inputRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,padding:12},input:{flex:1,color:C.text,backgroundColor:C.elevated,borderRadius:20,padding:12},send:{color:C.yellow,fontSize:30,marginLeft:8},action:{fontSize:24,color:C.yellow,marginHorizontal:7},debug:{color:C.yellow,fontSize:10,textAlign:'center',padding:3}});
