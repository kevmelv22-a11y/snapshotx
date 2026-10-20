import React,{useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {formatCount,pageFromOffset,toggleLike} from '../../lib/spotlight';

export type HighlightItem={id:string;owner_id:string;created_at:string;likes:number;shares:number;views:number;liked:boolean;caption:string|null;media_path:string;media_type:'photo'|'video'};
/** Vertical full-screen paging feed of public snaps ("Uitgelicht"). Swipe up/down; like/share counters. */
export function HighlightFeed({items,names,renderMedia,onLike,onShare,onReport,onClose,height:forced}:{items:HighlightItem[];names:Record<string,string>;renderMedia:(i:HighlightItem,active:boolean)=>React.ReactNode;onLike?:(i:HighlightItem,liked:boolean)=>void;onShare?:(i:HighlightItem)=>Promise<boolean>;onReport?:(i:HighlightItem)=>void;onClose?:()=>void;height?:number}){
 const win=useWindowDimensions(),h=forced??win.height,insets=useSafeAreaInsets();
 const [state,setState]=useState<Record<string,{liked:boolean;likes:number;shares:number}>>({}),[index,setIndex]=useState(0);
 const get=(i:HighlightItem)=>state[i.id]??{liked:i.liked,likes:i.likes,shares:i.shares};
 if(!items.length)return <View style={[s.empty,{height:h}]}><Ionicons name="star-outline" size={46} color="#C99AE8"/><Text style={s.text}>Nog niets uitgelicht.</Text><Text style={s.meta}>Openbare snaps verschijnen hier.</Text></View>;
 return <View style={{height:h,backgroundColor:'#000'}}>
  <FlatList data={items} keyExtractor={i=>i.id} pagingEnabled snapToInterval={h} decelerationRate="fast" showsVerticalScrollIndicator={false} getItemLayout={(_,i)=>({length:h,offset:h*i,index:i})}
   onMomentumScrollEnd={e=>setIndex(pageFromOffset(e.nativeEvent.contentOffset.y,h,items.length))} onScroll={e=>setIndex(pageFromOffset(e.nativeEvent.contentOffset.y,h,items.length))} scrollEventThrottle={100}
   renderItem={({item,index:i})=>{const st=get(item);const name=names[item.owner_id]||'Maker';return <View style={{height:h}}>
    <View style={StyleSheet.absoluteFill}>{renderMedia(item,i===index)}</View>
    <View style={[s.side,{bottom:insets.bottom+110}]}>
     <Pressable style={s.action} accessibilityLabel={st.liked?'Vind ik niet meer leuk':'Vind ik leuk'} onPress={()=>{const n=toggleLike(st);setState(x=>({...x,[item.id]:{...st,...n}}));onLike?.(item,n.liked)}}><Ionicons name={st.liked?'heart':'heart-outline'} size={34} color={st.liked?'#FF4D6D':'white'}/><Text style={s.count}>{formatCount(st.likes)}</Text></Pressable>
     <Pressable style={s.action} accessibilityLabel="Delen" onPress={async()=>{if(await (onShare?.(item)??Promise.resolve(true)))setState(x=>({...x,[item.id]:{...st,shares:st.shares+1}}))}}><Ionicons name="arrow-redo-outline" size={32} color="white"/><Text style={s.count}>{formatCount(st.shares)}</Text></Pressable>
     <View style={s.action}><Ionicons name="eye-outline" size={28} color="white"/><Text style={s.count}>{formatCount(item.views)}</Text></View>
     {onReport&&<Pressable style={s.action} accessibilityLabel="Melden" onPress={()=>onReport(item)}><Ionicons name="flag-outline" size={26} color="white"/><Text style={s.count}>Meld</Text></Pressable>}
    </View>
    <View style={[s.info,{bottom:insets.bottom+30}]}><Text style={s.name}>@{name}</Text>{!!item.caption&&<Text style={s.caption} numberOfLines={3}>{item.caption}</Text>}</View>
   </View>}}/>
  <View style={[s.header,{top:insets.top+8}]} pointerEvents="box-none">{onClose&&<Pressable onPress={onClose} accessibilityLabel="Terug"><Ionicons name="chevron-back" size={28} color="white"/></Pressable>}<Text style={s.title}>Uitgelicht</Text><Text style={s.meta}>{index+1}/{items.length}</Text></View>
 </View>;
}
const s=StyleSheet.create({empty:{alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#0B0810'},text:{color:'white',fontSize:16,fontWeight:'700'},meta:{color:'#DDD',fontSize:13},header:{position:'absolute',left:14,right:14,flexDirection:'row',alignItems:'center',gap:10},title:{color:'white',fontSize:20,fontWeight:'900',flex:1,textShadowColor:'#000',textShadowRadius:6},side:{position:'absolute',right:12,alignItems:'center',gap:20},action:{alignItems:'center',gap:3},count:{color:'white',fontWeight:'800',fontSize:13,textShadowColor:'#000',textShadowRadius:4},info:{position:'absolute',left:16,right:90,gap:6},name:{color:'white',fontWeight:'900',fontSize:16,textShadowColor:'#000',textShadowRadius:4},caption:{color:'white',fontSize:15,textShadowColor:'#000',textShadowRadius:4}});
