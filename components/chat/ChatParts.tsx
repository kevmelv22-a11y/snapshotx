import React,{useEffect,useRef,useState} from 'react';
import {Animated,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {C} from '../../lib/theme';
import {useSession} from '../../hooks/useSession';
import {useFriendEmojis} from '../../stores/friendEmojis';
import {emojiFor} from '../../lib/friend-emojis';
import {RETENTION_FORWARD_NOTE,UNOPENED_NOTE,pendingOldTimersText} from '../../lib/chat-retention';
import {REACTION_EMOJIS,RETENTION_LABEL,RETENTION_MODES,formatDuration,streakHint,streakLabel,waveform,type RetentionMode,type StreakState} from '../../lib/chat-features';

/** 🔥 counter (+ ⌛ when the streak is about to expire). Renders nothing without a streak. */
export function StreakBadge({streak}:{streak:StreakState}){
  const {session}=useSession(),uid=session?.user.id,choices=useFriendEmojis(st=>uid?st.choices[uid]:undefined);
  if(streak.count<1)return null;
  return <View testID="streak" style={[s.streak,streak.atRisk&&s.streakRisk]}><Text style={s.streakText}>{streakLabel(streak,emojiFor('streak',choices),emojiFor('hourglass',choices))}</Text></View>;
}
export function StreakWarning({streak}:{streak:StreakState}){
  const hint=streakHint(streak);
  return hint?<View style={s.warn}><Text style={s.warnText}>⌛ {hint}</Text></View>:null;
}

/** "Aria is aan het typen…" with three pulsing dots. */
export function TypingIndicator({text}:{text:string|null}){
  const [a]=useState(()=>new Animated.Value(0));
  useEffect(()=>{if(!text)return;const loop=Animated.loop(Animated.timing(a,{toValue:3,duration:1200,useNativeDriver:false}));loop.start();return()=>loop.stop()},[a,text]);
  if(!text)return null;
  return <View testID="typing" style={s.typing}><View style={s.dots}>{[0,1,2].map(i=><Animated.View key={i} style={[s.dot,{opacity:a.interpolate({inputRange:[0,i,i+.5,i+1,3],outputRange:[.3,.3,1,.3,.3],extrapolate:'clamp'})}]}/>)}</View><Text style={s.typingText}>{text}</Text></View>;
}

/** Centered grey system line (screenshot, retention change, missed call). */
export function SystemLine({text,icon='•'}:{text:string;icon?:string}){
  return <View style={s.system}><Text style={s.systemText}>{icon} {text}</Text></View>;
}

/** Taps within this window after opening are ignored (the long-press finger lifting). */
export const BACKDROP_GUARD_MS=250;
/** Long-press menu: 7 emoji reactions plus optional actions. */
export function ReactionPicker({visible,onPick,onClose,current,actions=[]}:{visible:boolean;onPick:(e:string)=>void;onClose:()=>void;current?:string|null;actions?:{label:string;onPress:()=>void}[]}){
  // The menu opens under the finger during a long-press. Lifting that finger must not count as a tap on whatever is
  // now under it (backdrop = close, or worse an action like "Blokkeer gebruiker"). Only presses that STARTED inside
  // the open menu count (onPressIn fired inside it). Plus a short time guard for platforms without pressIn.
  const ready=useRef(false),pressedInside=useRef(false);
  useEffect(()=>{if(!visible)return;ready.current=false;pressedInside.current=false;const t=setTimeout(()=>{ready.current=true},BACKDROP_GUARD_MS);return()=>clearTimeout(t)},[visible]);
  const armed=()=>ready.current&&pressedInside.current;
  const onIn=()=>{pressedInside.current=true};
  const backdrop=()=>{if(armed())onClose()};
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPressIn={onIn} onPress={backdrop} testID="reaction-backdrop">
      <View style={s.picker} testID="reaction-picker">
        <View style={s.emojiRow}>{REACTION_EMOJIS.map(e=><Pressable key={e} accessibilityLabel={`Reageer met ${e}`} onPressIn={onIn} onPress={()=>{if(!armed())return;onPick(e);onClose()}} style={[s.emojiBtn,current===e&&s.emojiOn]}><Text style={s.emoji}>{e}</Text></Pressable>)}</View>
        {actions.map(x=><Pressable key={x.label} onPressIn={onIn} onPress={()=>{if(!armed())return;onClose();x.onPress()}} style={s.action}><Text style={s.actionText}>{x.label}</Text></Pressable>)}
      </View>
    </Pressable>
  </Modal>;
}
export function ReactionChips({items,mine}:{items:{emoji:string;count:number;mine:boolean}[];mine:boolean}){
  if(!items.length)return null;
  return <View style={[s.chips,mine?{alignSelf:'flex-end'}:{alignSelf:'flex-start'}]}>{items.map(r=><View key={r.emoji} style={[s.chip,r.mine&&s.chipMine]}><Text style={s.chipText}>{r.emoji}{r.count>1?` ${r.count}`:''}</Text></View>)}</View>;
}

/** Per-chat retention setting. */
export function RetentionSheet({visible,mode,onPick,onClose,oldTimers=0}:{visible:boolean;mode:RetentionMode;onPick:(m:RetentionMode)=>void;onClose:()=>void;/** Chats that still disappear on the setting they were sent with (lib/chat-retention.ts). */oldTimers?:number}){
  const pending=pendingOldTimersText(oldTimers);
  const sub:Record<RetentionMode,string>={after_view:'Chats verdwijnen zodra iedereen ze heeft gezien en de chat sluit.','24h':'Chats verdwijnen 24 uur nadat ze bekeken zijn.',keep:'Chats blijven staan tot iemand ze verwijdert.'};
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <Pressable style={[s.backdrop,{justifyContent:'flex-end'}]} onPress={onClose}>
      <View style={s.sheet} testID="retention-sheet"><Text style={s.sheetTitle}>Chats verwijderen</Text>
        {RETENTION_MODES.map(m=><Pressable key={m} onPress={()=>{onPick(m);onClose()}} style={s.option}><View style={{flex:1}}><Text style={s.optTitle}>{RETENTION_LABEL[m]}</Text><Text style={s.optSub}>{sub[m]}</Text></View><Text style={s.radio}>{mode===m?'◉':'○'}</Text></Pressable>)}
        <Text style={s.optSub} testID="retention-forward-note">Geldt voor iedereen in dit gesprek. {RETENTION_FORWARD_NOTE} Snaps blijven altijd eenmalig.</Text>
        {mode!=='keep'&&<Text style={s.optSub} testID="retention-unopened-note">{UNOPENED_NOTE}</Text>}
        {!!pending&&<Text style={[s.optSub,{color:C.yellow,marginTop:6}]} testID="retention-old-timers">⏱ {pending}</Text>}
      </View>
    </Pressable>
  </Modal>;
}

/** Presentational voice-note bubble: play/pause, waveform with progress, time. */
export function VoiceNoteView({seed,playing,progress,durationMs,positionMs,onToggle,mine}:{seed:string;playing:boolean;progress:number;durationMs:number;positionMs:number;onToggle:()=>void;mine:boolean}){
  const bars=waveform(seed);
  return <View style={s.voice} testID="voice-note">
    <Pressable onPress={onToggle} accessibilityLabel={playing?'Pauzeren':'Spraakbericht afspelen'} style={[s.play,mine&&{backgroundColor:C.text}]}><Text style={[s.playIcon,mine&&{color:'#273A7B'}]}>{playing?'❚❚':'▶'}</Text></Pressable>
    <View style={s.wave}>{bars.map((h,i)=><View key={i} style={[s.bar,{height:4+h*26,backgroundColor:i/bars.length<progress?C.yellow:'#ffffff55'}]}/>)}</View>
    <Text style={s.voiceTime}>{formatDuration(playing||positionMs>0?positionMs:durationMs)}</Text>
  </View>;
}
/** Real playback via expo-audio. */
export function VoiceNotePlayer({uri,seed,mine}:{uri:string;seed:string;mine:boolean}){
  const player=useAudioPlayer(uri),st=useAudioPlayerStatus(player);
  const dur=(st.duration||0)*1000,pos=(st.currentTime||0)*1000;
  useEffect(()=>{if(st.didJustFinish){player.pause();void player.seekTo(0)}},[st.didJustFinish,player]);
  return <VoiceNoteView seed={seed} mine={mine} playing={st.playing} durationMs={dur} positionMs={st.playing?pos:0} progress={dur>0?pos/dur:0} onToggle={()=>st.playing?player.pause():player.play()}/>;
}
/** Shown in place of the input while recording. */
export function RecordingBar({durationMs,level,onCancel,onStop}:{durationMs:number;level:number;onCancel:()=>void;onStop:()=>void}){
  return <View style={s.recBar} testID="recording-bar">
    <Pressable onPress={onCancel} accessibilityLabel="Opname annuleren"><Text style={s.recCancel}>🗑</Text></Pressable>
    <View style={[s.recDot,{transform:[{scale:1+level*.6}]}]}/>
    <Text style={s.recTime}>{formatDuration(durationMs)}</Text>
    <Text style={s.recHint}>Opnemen… max 1:00</Text>
    <Pressable onPress={onStop} accessibilityLabel="Opname versturen"><Text style={s.recSend}>➤</Text></Pressable>
  </View>;
}

const s=StyleSheet.create({
  streak:{flexDirection:'row',alignItems:'center',backgroundColor:'#ffffff14',borderRadius:12,paddingHorizontal:8,paddingVertical:3},
  streakRisk:{backgroundColor:'#ff8a0033'},streakText:{color:C.text,fontSize:14,fontWeight:'700'},
  warn:{backgroundColor:'#ff8a0022',borderColor:'#ff8a0066',borderWidth:1,borderRadius:12,padding:8,marginHorizontal:12,marginTop:8},warnText:{color:'#ffb86b',fontSize:12,textAlign:'center'},
  typing:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,paddingVertical:6},dots:{flexDirection:'row',gap:4,backgroundColor:C.elevated,borderRadius:12,paddingHorizontal:10,paddingVertical:8},dot:{width:7,height:7,borderRadius:4,backgroundColor:C.text},typingText:{color:C.muted,fontSize:12,fontStyle:'italic'},
  system:{alignSelf:'center',marginVertical:8,paddingHorizontal:12,paddingVertical:5,borderRadius:12,backgroundColor:'#ffffff0d'},systemText:{color:C.muted,fontSize:12,textAlign:'center'},
  backdrop:{flex:1,backgroundColor:'#000a',justifyContent:'center',alignItems:'center'},
  picker:{backgroundColor:C.surface,borderRadius:22,padding:10,minWidth:300},emojiRow:{flexDirection:'row',justifyContent:'space-between'},emojiBtn:{padding:6,borderRadius:18},emojiOn:{backgroundColor:'#ffffff22'},emoji:{fontSize:28},
  action:{paddingVertical:12,paddingHorizontal:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#ffffff22',marginTop:4},actionText:{color:C.text,fontSize:15},
  chips:{flexDirection:'row',gap:4,marginTop:2,marginBottom:4,marginHorizontal:15},chip:{backgroundColor:C.surface,borderRadius:12,paddingHorizontal:6,paddingVertical:2,borderWidth:1,borderColor:'#ffffff22'},chipMine:{borderColor:C.yellow},chipText:{fontSize:13,color:C.text},
  sheet:{width:'100%',backgroundColor:C.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,gap:4},sheetTitle:{color:C.text,fontSize:18,fontWeight:'700',marginBottom:6},
  option:{flexDirection:'row',alignItems:'center',paddingVertical:10,gap:10},optTitle:{color:C.text,fontSize:15,fontWeight:'600'},optSub:{color:C.muted,fontSize:12,marginTop:2},radio:{color:C.yellow,fontSize:20},
  voice:{flexDirection:'row',alignItems:'center',gap:8,minWidth:220},play:{width:34,height:34,borderRadius:17,backgroundColor:C.yellow,alignItems:'center',justifyContent:'center'},playIcon:{color:'#000',fontSize:13,fontWeight:'800'},
  wave:{flex:1,flexDirection:'row',alignItems:'center',gap:2,height:32},bar:{width:3,borderRadius:2},voiceTime:{color:C.text,fontSize:12,minWidth:32,textAlign:'right'},
  recBar:{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,padding:12,gap:10},recCancel:{fontSize:22},recDot:{width:12,height:12,borderRadius:6,backgroundColor:'#ff3b30'},recTime:{color:C.text,fontSize:16,fontVariant:['tabular-nums']},recHint:{flex:1,color:C.muted,fontSize:12},recSend:{color:C.yellow,fontSize:30},
});
