import React,{useState} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {formatCount} from '../../lib/spotlight';
import {COMMENT_MAX,COMMENT_PLACEHOLDER,canDeleteComment,charsLeft,commentAge,commentsTitle,normalizeComment} from '../../lib/spotlight-social';
import type {HighlightItem,HighlightSocial} from './HighlightFeed';

/** Snapchat Spotlight comments sheet: count title, comments (avatar, name, age, text, heart + count), own/creator delete, input. */
export function CommentsSheet({item,social,names,height,bottomInset,onClose}:{item:HighlightItem;social:HighlightSocial;names:Record<string,string>;height:number;bottomInset:number;onClose:()=>void}){
 const [text,setText]=useState('');
 // Order is frozen while the sheet is open (liking must not make rows jump); new comments go on top.
 const fresh=social.thread(item),[order]=useState(()=>fresh.map(c=>c.id));
 const known=new Set(order),rank=new Map(order.map((id,i)=>[id,i]));
 const thread=[...fresh.filter(c=>!known.has(c.id)),...fresh.filter(c=>known.has(c.id)).sort((a,b)=>rank.get(a.id)!-rank.get(b.id)!)],clean=normalizeComment(text),left=charsLeft(text);
 const post=()=>{if(!clean)return;social.onComment(item,clean);setText('')};
 const nameOf=(id:string)=>id===social.me?'Ik':names[id]||'Snapshotter';
 return <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS==='ios'?'padding':undefined} pointerEvents="box-none">
  <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Reacties sluiten" testID="comments-backdrop"/>
  <View style={[s.sheet,{height:Math.round(height*0.66),paddingBottom:bottomInset+8}]} testID="comments-sheet">
   <View style={s.grab}/>
   <View style={s.head}><Text style={s.title} testID="comments-title">{commentsTitle(thread.length)}</Text><Pressable onPress={onClose} accessibilityLabel="Sluiten" hitSlop={10}><Ionicons name="close" size={24} color="#222"/></Pressable></View>
   <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:16,paddingBottom:12,flexGrow:1}} keyboardShouldPersistTaps="handled">
    {!thread.length&&<View style={s.empty}><Ionicons name="chatbubble-ellipses-outline" size={40} color="#bbb"/><Text style={s.emptyText}>Wees de eerste die reageert!</Text></View>}
    {thread.map(c=><View key={c.id} style={s.row} testID={c.mine?'comment-mine':'comment'}>
     {social.avatarOf(c.user_id,36)}
     <View style={{flex:1,gap:2}}>
      <Text style={s.meta}><Text style={s.name}>{nameOf(c.user_id)}</Text>{c.user_id===item.owner_id?<Text style={s.maker}>  · Maker</Text>:null}<Text>  {commentAge(c.created_at,social.now)}</Text></Text>
      <Text style={s.body} testID="comment-body">{c.body}</Text>
      {canDeleteComment(c,social.me,item.owner_id)&&<Pressable onPress={()=>social.onDeleteComment(c)} hitSlop={6} testID="comment-delete" accessibilityLabel="Reactie verwijderen"><Text style={s.del}>Verwijderen</Text></Pressable>}
     </View>
     <Pressable style={s.like} onPress={()=>social.onLikeComment(c)} hitSlop={8} testID="comment-like" accessibilityLabel={c.liked?'Reactie niet meer leuk':'Reactie leuk vinden'}>
      <Ionicons name={c.liked?'heart':'heart-outline'} size={18} color={c.liked?'#FF4D6D':'#999'}/>{c.likes>0&&<Text style={[s.likeCount,c.liked&&{color:'#FF4D6D'}]} testID="comment-like-count">{formatCount(c.likes)}</Text>}
     </Pressable>
    </View>)}
   </ScrollView>
   <View style={s.inputRow}>
    {social.avatarOf(social.me,30)}
    <TextInput style={s.input} value={text} onChangeText={t=>setText(Array.from(t).slice(0,COMMENT_MAX+20).join(''))} placeholder={COMMENT_PLACEHOLDER} placeholderTextColor="#999" testID="comment-input" onSubmitEditing={post} returnKeyType="send" maxLength={COMMENT_MAX*2}/>
    {left<20&&<Text style={[s.left,left<0&&{color:'#E5484D'}]} testID="comment-left">{left}</Text>}
    <Pressable onPress={post} disabled={!clean||left<0} style={[s.send,(!clean||left<0)&&{opacity:.35}]} testID="comment-send" accessibilityLabel="Reactie plaatsen"><Ionicons name="arrow-up" size={18} color="white"/></Pressable>
   </View>
  </View>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({backdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'#0006'},sheet:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'white',borderTopLeftRadius:18,borderTopRightRadius:18},
 grab:{alignSelf:'center',width:38,height:5,borderRadius:3,backgroundColor:'#ddd',marginTop:8},head:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#e5e5e5'},
 title:{flex:1,textAlign:'center',fontWeight:'900',fontSize:16,color:'#111',marginLeft:24},row:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:10},meta:{color:'#888',fontSize:12},name:{color:'#111',fontWeight:'800',fontSize:13},maker:{color:'#0EADFF',fontWeight:'800'},
 body:{color:'#111',fontSize:15},del:{color:'#888',fontSize:12,fontWeight:'700',marginTop:2},like:{alignItems:'center',paddingTop:4,width:32},likeCount:{color:'#999',fontSize:11,fontWeight:'800'},
 empty:{flex:1,alignItems:'center',justifyContent:'center',gap:8,paddingTop:40},emptyText:{color:'#777',fontWeight:'700'},
 inputRow:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingTop:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#e5e5e5'},
 input:{flex:1,backgroundColor:'#f1f1f3',borderRadius:20,paddingHorizontal:14,paddingVertical:9,fontSize:15,color:'#111'},left:{color:'#888',fontSize:12,fontWeight:'800'},send:{backgroundColor:'#0EADFF',width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'}});
