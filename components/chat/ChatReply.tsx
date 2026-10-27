import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,type GestureResponderEvent,PanResponder,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {SWIPE_REPLY_PX,isReplySwipe,startsReplySwipe} from '../../lib/chat-replies';

/** Quote of the original inside a reply bubble (Snapchat): coloured sender name + one-line excerpt. Tap → jump to it. */
export function QuoteBlock({label,color,excerpt,onPress}:{label:string;color:string;excerpt:string;onPress?:()=>void}){
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Antwoord op ${label}: ${excerpt}. Tik om naar het bericht te gaan`} style={[s.quote,{borderLeftColor:color}]} testID="reply-quote">
    <Text style={[s.quoteName,{color}]} numberOfLines={1}>{label}</Text>
    <Text style={s.quoteText} numberOfLines={2}>{excerpt}</Text>
  </Pressable>;
}

/** Bar above the chat input while composing a reply: "Antwoord op Aria" + excerpt + ✕. */
export function ReplyBar({title,color,excerpt,onCancel}:{title:string;color:string;excerpt:string;onCancel:()=>void}){
  return <View style={s.bar} testID="reply-bar">
    <Ionicons name="arrow-undo" size={18} color={color}/>
    <View style={[s.barQuote,{borderLeftColor:color}]}><Text style={[s.barTitle,{color}]} numberOfLines={1}>{title}</Text><Text style={s.quoteText} numberOfLines={1}>{excerpt}</Text></View>
    <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Antwoord annuleren" testID="reply-cancel"><Ionicons name="close" size={22} color={C.muted}/></Pressable>
  </View>;
}

/** "Bericht bewerken" bar above the input while editing one of your own messages (Snapchat Bewerken). */
export function EditBar({excerpt,onCancel}:{excerpt:string;onCancel:()=>void}){
  return <View style={s.bar} testID="edit-bar">
    <Ionicons name="pencil" size={17} color={C.yellow}/>
    <View style={[s.barQuote,{borderLeftColor:C.yellow}]}><Text style={[s.barTitle,{color:C.yellow}]} numberOfLines={1}>Bericht bewerken</Text><Text style={s.quoteText} numberOfLines={1}>{excerpt}</Text></View>
    <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Bewerken annuleren" testID="edit-cancel"><Ionicons name="close" size={22} color={C.muted}/></Pressable>
  </View>;
}

/** Swipe a message to the right to reply (Snapchat). Only clear horizontal right-drags are captured, so vertical
 *  scrolling and long-press keep working. The row follows the finger (max 80 px) and a reply arrow fades in. */
export function SwipeToReply({onReply,enabled=true,children}:{onReply:()=>void;enabled?:boolean;children:React.ReactNode}){
  // One PanResponder per row for its whole life: recreating it on every parent render (the chat re-renders while
  // you drag) would drop the gesture. The latest onReply is read from a ref updated after each render.
  const [x]=useState(()=>new Animated.Value(0)),latest=useRef(onReply);
  useEffect(()=>{latest.current=onReply});
  // react-hooks/refs false positive: latest.current is only read inside the gesture-release handler, never during render.
  // eslint-disable-next-line react-hooks/refs
  const pan=useMemo(()=>createReplyPan(x,()=>latest.current()),[x]);
  if(!enabled)return <>{children}</>;
  const opacity=x.interpolate({inputRange:[0,SWIPE_REPLY_PX],outputRange:[0,1],extrapolate:'clamp'});
  return <View>
    <Animated.View pointerEvents="none" style={[s.arrow,{opacity}]}><Ionicons name="arrow-undo" size={18} color={C.text}/></Animated.View>
    <Animated.View {...pan.panHandlers} style={{transform:[{translateX:x}]}}>{children}</Animated.View>
  </View>;
}

/** Distances come from the events' own pageX/pageY relative to where the drag was claimed (+ the claim slop), not
 *  from gestureState.dx: on react-native-web the touch history is stale from the 2nd gesture on (dx jumps to minus
 *  the previous drag), which made every swipe after the first one fail. */
function createReplyPan(x:Animated.Value,reply:()=>void){
  const d={gx:0,gy:0,slop:0,dx:0,dy:0};
  const track=(e:GestureResponderEvent)=>{d.dx=e.nativeEvent.pageX-d.gx+d.slop;d.dy=e.nativeEvent.pageY-d.gy};
  return PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=>startsReplySwipe(g.dx,g.dy),
    onMoveShouldSetPanResponderCapture:(_,g)=>startsReplySwipe(g.dx,g.dy),
    onPanResponderGrant:(e,g)=>{d.gx=e.nativeEvent.pageX;d.gy=e.nativeEvent.pageY;d.slop=Math.max(0,g.dx);d.dx=d.slop;d.dy=0},
    onPanResponderMove:e=>{track(e);x.setValue(Math.max(0,Math.min(80,d.dx)))},
    onPanResponderRelease:e=>{track(e);if(isReplySwipe(d.dx,d.dy))reply();Animated.spring(x,{toValue:0,useNativeDriver:false,bounciness:6}).start()},
    onPanResponderTerminate:()=>Animated.spring(x,{toValue:0,useNativeDriver:false}).start(),
    onPanResponderTerminationRequest:()=>false,
  });
}

const s=StyleSheet.create({
  quote:{borderLeftWidth:2,backgroundColor:'#ffffff0f',borderRadius:6,paddingHorizontal:8,paddingVertical:4,marginBottom:4,maxWidth:300},
  quoteName:{fontSize:10,fontWeight:'800',letterSpacing:.6},quoteText:{color:C.muted,fontSize:13},
  bar:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.surface,paddingHorizontal:14,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  barQuote:{flex:1,borderLeftWidth:2,paddingLeft:8},barTitle:{fontSize:12,fontWeight:'800'},
  arrow:{position:'absolute',left:0,top:0,bottom:0,justifyContent:'center',width:28,alignItems:'center'},
});
