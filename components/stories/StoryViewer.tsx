import React,{useEffect,useMemo,useRef,useState} from 'react';
import {FlatList,KeyboardAvoidingView,PanResponder,Pressable,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as L from '../../lib/stories';

export type ViewerStory=L.StoryLike&{caption:string|null;media_path:string};
export type Props={
 groups:L.StoryGroup<ViewerStory>[]; initialGroup?:number; seen:Set<string>; meId:string; now?:()=>number;
 names:Record<string,string>; renderMedia:(s:ViewerStory)=>React.ReactNode;
 onViewed?:(s:ViewerStory)=>void; onClose:()=>void; onReply?:(s:ViewerStory,body:string)=>Promise<string|null>;
 loadViewers?:(s:ViewerStory)=>Promise<{viewers:L.Viewer[];total:number}>;
 /** Dev/screenshot hooks */ initialPaused?:boolean; initialViewersOpen?:boolean; initialReplyOpen?:boolean; initialProgress?:number;
};
/** Tap-through story viewer: segment bars, tap left/right, hold to pause, swipe sideways/down/up, viewers list for own story, reply. */
export function StoryViewer(p:Props){
 const clockNow=p.now??Date.now,{width}=useWindowDimensions(),insets=useSafeAreaInsets();
 const sizes=useMemo(()=>p.groups.map(g=>g.stories.length),[p.groups]);
 const [cursor,setCursor]=useState<L.Cursor>(()=>{const g=p.initialGroup??0;return {group:g,story:p.groups[g]?L.startIndex(p.groups[g].stories,p.seen):0}});
 const [clock,setClock]=useState<L.Clock>(()=>{const n=clockNow();const c={elapsed:(p.initialProgress??0)*L.PHOTO_DURATION_MS,runningSince:n};return p.initialPaused?L.pauseClock(c,n):c});
 const [tick,setTick]=useState(0),[replyOpen,setReplyOpen]=useState(!!p.initialReplyOpen),[reply,setReply]=useState(''),[notice,setNotice]=useState('');
 const [viewersOpen,setViewersOpen]=useState(!!p.initialViewersOpen),[viewers,setViewers]=useState<{viewers:L.Viewer[];total:number}|null>(null);
 const group=p.groups[cursor.group],story=group?.stories[cursor.story];const mine=group?.ownerId===p.meId;
 const paused=clock.runningSince==null;
 const apply=(r:L.NavResult)=>{if('close' in r){p.onClose();return}setCursor(r.cursor);setClock(L.startClock(clockNow()));setNotice('')};
 useEffect(()=>{if(story)p.onViewed?.(story)},[story?.id]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(paused)return;const t=setInterval(()=>setTick(x=>x+1),50);return()=>clearInterval(t)},[paused]);
 const prog=L.progress(clock,clockNow());
 useEffect(()=>{if(prog>=1&&!paused)apply(L.next(cursor,sizes))},[tick]);// eslint-disable-line react-hooks/exhaustive-deps
 const hold=(on:boolean)=>setClock(c=>on?L.pauseClock(c,clockNow()):L.resumeClock(c,clockNow()));
 useEffect(()=>{if(viewersOpen&&story&&mine&&p.loadViewers)p.loadViewers(story).then(setViewers)},[viewersOpen,story?.id]);// eslint-disable-line react-hooks/exhaustive-deps
 const openPanel=(which:'reply'|'viewers')=>{hold(true);if(which==='reply')setReplyOpen(true);else setViewersOpen(true)};
 const closePanels=()=>{setReplyOpen(false);setViewersOpen(false);hold(false)};
 const ref=useRef({cursor,sizes,mine});ref.current={cursor,sizes,mine};
 const pan=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>12||Math.abs(g.dy)>12,onPanResponderRelease:(_,g)=>{const sw=L.classifySwipe(g.dx,g.dy);const {cursor:c,sizes:z,mine:m}=ref.current;if(sw==='nextGroup')apply(L.switchGroup(c,z,1));else if(sw==='prevGroup')apply(L.switchGroup(c,z,-1));else if(sw==='close')p.onClose();else if(sw==='reply')openPanel(m?'viewers':'reply')}}),[]);// eslint-disable-line react-hooks/exhaustive-deps
 if(!group||!story)return <View style={s.root}><Text style={s.text}>Geen verhalen</Text></View>;
 async function send(){if(!story||!p.onReply)return;const body=L.storyReplyBody(reply,story.caption);if(!body)return;const err=await p.onReply(story,body);setNotice(err??'Antwoord verstuurd naar de chat');if(!err){setReply('');setReplyOpen(false);hold(false)}}
 const name=mine?'Mijn verhaal':p.names[group.ownerId]||'Vriend';
 return <View style={s.root} {...pan.panHandlers}>
  <View style={StyleSheet.absoluteFill}>{p.renderMedia(story)}</View>
  <Pressable style={StyleSheet.absoluteFill} onPressIn={()=>hold(true)} onPressOut={()=>hold(false)} onPress={e=>apply(L.tapAction(e.nativeEvent.locationX,width)==='prev'?L.prev(cursor,sizes):L.next(cursor,sizes))} delayLongPress={250} accessibilityLabel="Tik links voor vorige, rechts voor volgende, houd vast om te pauzeren"/>
  <View style={[s.top,{paddingTop:insets.top+8}]} pointerEvents="box-none">
   <View style={s.bars}>{L.segmentFills(group.stories.length,cursor.story,prog).map((f,i)=><View key={i} style={s.bar}><View style={[s.fill,{width:`${f*100}%`}]}/></View>)}</View>
   <View style={s.head}><View style={s.avatar}><Text style={s.avatarText}>{name.slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.name}>{name}</Text><Text style={s.meta}>{L.ageLabel(story.created_at,clockNow())} · {L.timeLeftLabel(story.expires_at,clockNow())}</Text></View>{paused&&<Ionicons name="pause" size={20} color="white" accessibilityLabel="Gepauzeerd"/>}<Pressable onPress={p.onClose} accessibilityLabel="Sluiten" hitSlop={12}><Ionicons name="close" size={30} color="white"/></Pressable></View>
  </View>
  {!replyOpen&&!viewersOpen&&<View style={[s.bottom,{paddingBottom:insets.bottom+14}]} pointerEvents="box-none">
   {!!story.caption&&<Text style={s.caption}>{story.caption}</Text>}
   {!!notice&&<Text style={s.notice}>{notice}</Text>}
   {mine?<Pressable style={s.pill} onPress={()=>openPanel('viewers')}><Ionicons name="eye-outline" size={18} color="white"/><Text style={s.text}>{viewers?L.viewersLabel(viewers.total):'Kijkers'}</Text><Ionicons name="chevron-up" size={18} color="white"/></Pressable>
   :<Pressable style={s.pill} onPress={()=>openPanel('reply')}><Ionicons name="chatbubble-outline" size={18} color="white"/><Text style={s.text}>Antwoorden aan {name}</Text></Pressable>}
  </View>}
  {replyOpen&&!mine&&<KeyboardAvoidingView behavior="padding" style={[s.sheet,{paddingBottom:insets.bottom+12}]}><Text style={s.sheetTitle}>Antwoord op verhaal van {name}</Text><View style={s.row}><TextInput autoFocus value={reply} onChangeText={setReply} placeholder="Stuur een bericht…" placeholderTextColor="#aaa" style={s.input} onSubmitEditing={send}/><Pressable onPress={send} accessibilityLabel="Versturen" style={s.send}><Ionicons name="send" size={20} color="black"/></Pressable></View><Pressable onPress={closePanels}><Text style={s.meta}>Annuleren</Text></Pressable></KeyboardAvoidingView>}
  {viewersOpen&&mine&&<View style={[s.sheet,{maxHeight:'60%',paddingBottom:insets.bottom+12}]}><View style={s.row}><Text style={[s.sheetTitle,{flex:1}]}>{viewers?L.viewersLabel(viewers.total):'Kijkers laden…'}</Text><Pressable onPress={closePanels} accessibilityLabel="Sluiten"><Ionicons name="chevron-down" size={26} color="white"/></Pressable></View>
   {viewers&&viewers.total===0&&<Text style={s.meta}>Nog niemand heeft dit verhaal bekeken.</Text>}
   <FlatList data={viewers?.viewers??[]} keyExtractor={v=>v.userId} renderItem={({item})=><View style={s.viewer}><View style={s.avatarSm}><Text style={s.avatarText}>{(p.names[item.userId]||'?').slice(0,1)}</Text></View><Text style={[s.text,{flex:1}]}>{p.names[item.userId]||'Vriend'}</Text>{!!item.emoji&&<Text style={{fontSize:20}}>{item.emoji}</Text>}<Text style={s.meta}>{L.ageLabel(item.viewedAt,clockNow())}</Text></View>}/>
   {viewers&&viewers.total>viewers.viewers.length&&<Text style={s.meta}>+{viewers.total-viewers.viewers.length} anderen</Text>}
  </View>}
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#000'},text:{color:'white',fontSize:15,fontWeight:'600'},top:{position:'absolute',top:0,left:0,right:0,paddingHorizontal:10},bars:{flexDirection:'row',gap:4},bar:{flex:1,height:3,borderRadius:2,backgroundColor:'#FFFFFF55',overflow:'hidden'},fill:{height:3,backgroundColor:'white'},head:{flexDirection:'row',alignItems:'center',gap:10,marginTop:10},avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#7D3BBF',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'white'},avatarSm:{width:34,height:34,borderRadius:17,backgroundColor:'#7D3BBF',alignItems:'center',justifyContent:'center'},avatarText:{color:'white',fontWeight:'800'},name:{color:'white',fontWeight:'800',fontSize:16},meta:{color:'#DDD',fontSize:13},bottom:{position:'absolute',bottom:0,left:16,right:16,gap:10,alignItems:'center'},caption:{color:'white',fontSize:20,fontWeight:'800',textAlign:'center',textShadowColor:'#000',textShadowRadius:6},notice:{color:'#FFE14D'},pill:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#000A',borderRadius:22,paddingHorizontal:18,paddingVertical:12,borderWidth:1,borderColor:'#FFFFFF44'},sheet:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#16121C',borderTopLeftRadius:22,borderTopRightRadius:22,padding:16,gap:12},sheetTitle:{color:'white',fontSize:17,fontWeight:'800'},row:{flexDirection:'row',alignItems:'center',gap:10},input:{flex:1,backgroundColor:'#FFFFFF1A',color:'white',padding:12,borderRadius:20},send:{backgroundColor:'#FFE14D',width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'},viewer:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8}});
