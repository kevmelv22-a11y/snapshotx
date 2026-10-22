import React,{useRef,useState} from 'react';
import {Animated,FlatList,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {formatCount,pageFromOffset,toggleLike} from '../../lib/spotlight';
import {canSubscribe,isDoubleTap,liveSubscribers,likeOnDoubleTap,subscribeLabel,subscriberText,type CommentView} from '../../lib/spotlight-social';
import {CommentsSheet} from './CommentsSheet';

export type HighlightItem={id:string;owner_id:string;created_at:string;likes:number;shares:number;views:number;liked:boolean;caption:string|null;media_path:string;media_type:'photo'|'video';subscribers?:number;subscribedAtLoad?:boolean};
/** Social layer (Snapchat Spotlight): comments, comment likes and subscribing to the creator. Optional — without it the feed is likes/shares only. */
export type HighlightSocial={me:string;now:number;thread:(i:HighlightItem)=>CommentView[];count:(i:HighlightItem)=>number;subscribed:Set<string>;
 onSubscribe:(owner:string,on:boolean)=>void;onComment:(i:HighlightItem,text:string)=>void;onLikeComment:(c:CommentView)=>void;onDeleteComment:(c:CommentView)=>void;avatarOf:(userId:string,size:number)=>React.ReactNode};
/** Vertical full-screen paging feed of public snaps ("Uitgelicht"). Swipe up/down; like (also double tap), comments, share, subscribe. */
export function HighlightFeed({items,names,renderMedia,onLike,onShare,onReport,onClose,height:forced,social}:{items:HighlightItem[];names:Record<string,string>;renderMedia:(i:HighlightItem,active:boolean)=>React.ReactNode;onLike?:(i:HighlightItem,liked:boolean)=>void;onShare?:(i:HighlightItem)=>Promise<boolean>;onReport?:(i:HighlightItem)=>void;onClose?:()=>void;height?:number;social?:HighlightSocial}){
 const win=useWindowDimensions(),h=forced??win.height,insets=useSafeAreaInsets();
 const [state,setState]=useState<Record<string,{liked:boolean;likes:number;shares:number}>>({}),[index,setIndex]=useState(0);
 const [sheetFor,setSheetFor]=useState<HighlightItem|null>(null),[burst,setBurst]=useState<string|null>(null);
 const lastTap=useRef<{id:string;at:number}|null>(null),burstAnim=useRef(new Animated.Value(0)).current;
 const get=(i:HighlightItem)=>state[i.id]??{liked:i.liked,likes:i.likes,shares:i.shares};
 const heartBurst=(id:string)=>{setBurst(id);burstAnim.setValue(0);Animated.sequence([Animated.spring(burstAnim,{toValue:1,useNativeDriver:true,friction:4}),Animated.delay(350),Animated.timing(burstAnim,{toValue:0,duration:220,useNativeDriver:true})]).start(()=>setBurst(null))};
 // Event timestamps (same clock for both taps) instead of Date.now(): only the gap between the taps matters.
 const tapMedia=(item:HighlightItem,at:number)=>{const now=at,prev=lastTap.current;
  if(prev&&prev.id===item.id&&isDoubleTap(prev.at,now)){lastTap.current=null;const st=get(item),n=likeOnDoubleTap(st);heartBurst(item.id);if(n.changed){setState(x=>({...x,[item.id]:{...st,liked:n.liked,likes:n.likes}}));onLike?.(item,true)}return}
  lastTap.current={id:item.id,at:now}};
 if(!items.length)return <View style={[s.empty,{height:h}]}><Ionicons name="star-outline" size={46} color="#C99AE8"/><Text style={s.text}>Nog niets uitgelicht.</Text><Text style={s.meta}>Openbare snaps verschijnen hier.</Text></View>;
 return <View style={{height:h,backgroundColor:'#000'}}>
  <FlatList data={items} keyExtractor={i=>i.id} pagingEnabled snapToInterval={h} decelerationRate="fast" showsVerticalScrollIndicator={false} getItemLayout={(_,i)=>({length:h,offset:h*i,index:i})} scrollEnabled={!sheetFor}
   onMomentumScrollEnd={e=>setIndex(pageFromOffset(e.nativeEvent.contentOffset.y,h,items.length))} onScroll={e=>setIndex(pageFromOffset(e.nativeEvent.contentOffset.y,h,items.length))} scrollEventThrottle={100}
   renderItem={({item,index:i})=>{const st=get(item);const name=names[item.owner_id]||'Maker';const subbed=!!social?.subscribed.has(item.owner_id);const nComments=social?.count(item)??0;return <View style={{height:h}} testID="spot-page">
    <Pressable style={StyleSheet.absoluteFill} onPress={e=>tapMedia(item,e.timeStamp||e.nativeEvent.timestamp)} accessibilityLabel="Dubbeltik om leuk te vinden" testID="spot-media">{renderMedia(item,i===index)}</Pressable>
    {burst===item.id&&<Animated.View pointerEvents="none" testID="spot-heart-burst" style={[s.burst,{opacity:burstAnim,transform:[{scale:burstAnim.interpolate({inputRange:[0,1],outputRange:[0.4,1]})}]}]}><Ionicons name="heart" size={120} color="#FF4D6D"/></Animated.View>}
    <View style={[s.side,{bottom:insets.bottom+110}]}>
     <Pressable style={s.action} testID="spot-like" accessibilityLabel={st.liked?'Vind ik niet meer leuk':'Vind ik leuk'} onPress={()=>{const n=toggleLike(st);setState(x=>({...x,[item.id]:{...st,...n}}));onLike?.(item,n.liked)}}><Ionicons name={st.liked?'heart':'heart-outline'} size={34} color={st.liked?'#FF4D6D':'white'}/><Text style={s.count} testID="spot-like-count">{formatCount(st.likes)}</Text></Pressable>
     {social&&<Pressable style={s.action} testID="spot-comments" accessibilityLabel="Reacties" onPress={()=>setSheetFor(item)}><Ionicons name="chatbubble-ellipses-outline" size={31} color="white"/><Text style={s.count} testID="spot-comment-count">{formatCount(nComments)}</Text></Pressable>}
     <Pressable style={s.action} accessibilityLabel="Delen" onPress={async()=>{if(await (onShare?.(item)??Promise.resolve(true)))setState(x=>({...x,[item.id]:{...st,shares:st.shares+1}}))}}><Ionicons name="arrow-redo-outline" size={32} color="white"/><Text style={s.count}>{formatCount(st.shares)}</Text></Pressable>
     <View style={s.action}><Ionicons name="eye-outline" size={28} color="white"/><Text style={s.count}>{formatCount(item.views)}</Text></View>
     {onReport&&<Pressable style={s.action} accessibilityLabel="Melden" onPress={()=>onReport(item)}><Ionicons name="flag-outline" size={26} color="white"/><Text style={s.count}>Meld</Text></Pressable>}
    </View>
    <View style={[s.info,{bottom:insets.bottom+30}]}>
     <View style={s.creator}>{social?.avatarOf(item.owner_id,34)}<View style={{flexShrink:1}}><Text style={s.name} numberOfLines={1}>@{name}</Text>{item.subscribers!=null&&<Text style={s.subs} testID="spot-subscribers">{subscriberText(liveSubscribers(item.subscribers,!!item.subscribedAtLoad,subbed),formatCount)}</Text>}</View>
      {social&&canSubscribe(item.owner_id,social.me)&&<Pressable onPress={()=>social.onSubscribe(item.owner_id,!subbed)} style={[s.sub,subbed&&s.subOn]} testID="spot-subscribe" accessibilityRole="button" accessibilityLabel={subbed?`Geabonneerd op ${name}`:`Abonneren op ${name}`}>{subbed&&<Ionicons name="checkmark" size={14} color="white"/>}<Text style={[s.subText,subbed&&s.subTextOn]}>{subscribeLabel(subbed)}</Text></Pressable>}
     </View>
     {!!item.caption&&<Text style={s.caption} numberOfLines={3}>{item.caption}</Text>}
    </View>
   </View>}}/>
  <View style={[s.header,{top:insets.top+8}]} pointerEvents="box-none">{onClose&&<Pressable onPress={onClose} accessibilityLabel="Terug"><Ionicons name="chevron-back" size={28} color="white"/></Pressable>}<Text style={s.title}>Uitgelicht</Text><Text style={s.meta}>{index+1}/{items.length}</Text></View>
  {social&&sheetFor&&<CommentsSheet item={sheetFor} social={social} names={names} height={h} bottomInset={insets.bottom} onClose={()=>setSheetFor(null)}/>}
 </View>;
}
const s=StyleSheet.create({empty:{alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#0B0810'},text:{color:'white',fontSize:16,fontWeight:'700'},meta:{color:'#DDD',fontSize:13},header:{position:'absolute',left:14,right:14,flexDirection:'row',alignItems:'center',gap:10},title:{color:'white',fontSize:20,fontWeight:'900',flex:1,textShadowColor:'#000',textShadowRadius:6},side:{position:'absolute',right:12,alignItems:'center',gap:20},action:{alignItems:'center',gap:3},count:{color:'white',fontWeight:'800',fontSize:13,textShadowColor:'#000',textShadowRadius:4},info:{position:'absolute',left:16,right:90,gap:8},creator:{flexDirection:'row',alignItems:'center',gap:8},name:{color:'white',fontWeight:'900',fontSize:16,textShadowColor:'#000',textShadowRadius:4},subs:{color:'#EEE',fontSize:12,fontWeight:'700',textShadowColor:'#000',textShadowRadius:4},
 sub:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#FFFC00',borderRadius:16,paddingHorizontal:12,paddingVertical:6,marginLeft:4},subOn:{backgroundColor:'#ffffff33',borderWidth:1,borderColor:'#ffffff66'},subText:{color:'#000',fontWeight:'900',fontSize:13},subTextOn:{color:'white'},
 caption:{color:'white',fontSize:15,textShadowColor:'#000',textShadowRadius:4},burst:{position:'absolute',top:'38%',alignSelf:'center'}});
