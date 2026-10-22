import React,{useMemo,useState} from 'react';
import {Animated,PanResponder,Pressable,StyleSheet,Text,View} from 'react-native';
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

/** Swipe a message to the right to reply (Snapchat). Only clear horizontal right-drags are captured, so vertical
 *  scrolling and long-press keep working. The row follows the finger (max 80 px) and a reply arrow fades in. */
export function SwipeToReply({onReply,enabled=true,children}:{onReply:()=>void;enabled?:boolean;children:React.ReactNode}){
  const [x]=useState(()=>new Animated.Value(0));
  const pan=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponder:(_,g)=>startsReplySwipe(g.dx,g.dy),
    onMoveShouldSetPanResponderCapture:(_,g)=>startsReplySwipe(g.dx,g.dy),
    onPanResponderMove:(_,g)=>x.setValue(Math.max(0,Math.min(80,g.dx))),
    onPanResponderRelease:(_,g)=>{if(isReplySwipe(g.dx,g.dy))onReply();Animated.spring(x,{toValue:0,useNativeDriver:false,bounciness:6}).start()},
    onPanResponderTerminate:()=>Animated.spring(x,{toValue:0,useNativeDriver:false}).start(),
    onPanResponderTerminationRequest:()=>false,
  }),[x,onReply]);
  if(!enabled)return <>{children}</>;
  const opacity=x.interpolate({inputRange:[0,SWIPE_REPLY_PX],outputRange:[0,1],extrapolate:'clamp'});
  return <View>
    <Animated.View pointerEvents="none" style={[s.arrow,{opacity}]}><Ionicons name="arrow-undo" size={18} color={C.text}/></Animated.View>
    <Animated.View {...pan.panHandlers} style={{transform:[{translateX:x}]}}>{children}</Animated.View>
  </View>;
}

const s=StyleSheet.create({
  quote:{borderLeftWidth:2,backgroundColor:'#ffffff0f',borderRadius:6,paddingHorizontal:8,paddingVertical:4,marginBottom:4,maxWidth:300},
  quoteName:{fontSize:10,fontWeight:'800',letterSpacing:.6},quoteText:{color:C.muted,fontSize:13},
  bar:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:C.surface,paddingHorizontal:14,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  barQuote:{flex:1,borderLeftWidth:2,paddingLeft:8},barTitle:{fontSize:12,fontWeight:'800'},
  arrow:{position:'absolute',left:0,top:0,bottom:0,justifyContent:'center',width:28,alignItems:'center'},
});
