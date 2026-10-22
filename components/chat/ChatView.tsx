import React,{useEffect,useRef,useState} from 'react';
import {FlatList,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {isGroupChangeText} from '../../lib/group-chat';
import {Hint} from '../UI';
import type {Message} from '../../lib/types';
import {RETENTION_SHORT,retentionHint,summarizeReactions,type Reaction,type RetentionMode,type StreakState} from '../../lib/chat-features';
import {dayDivider,dividerStarts,type ChatStatus} from '../../lib/chat-status';
import {StatusIcon} from './StatusIcon';
import {colorFor,runStarts,senderColors,senderLabel} from '../../lib/chat-senders';
import {QuoteBlock,SwipeToReply} from './ChatReply';
import {QUOTE_GONE,canReply,parseReply,quotedIndex,type ReplyRef} from '../../lib/chat-replies';
import {ReactionChips,ReactionPicker,StreakBadge,StreakWarning,SystemLine,TypingIndicator} from './ChatParts';

/** Header row: title, streak, retention toggle, video call. Shared by the real chat and the dev harness. */
export function ChatHeaderBar({title,streak,retention,onRetention,onCall,avatar,onInfo,memberCount,onBack,onProfile,topInset=0}:{onBack?:()=>void;/** 1:1 chats: tap avatar/name → friendship profile. */onProfile?:()=>void;topInset?:number;title:string;streak:StreakState;retention:RetentionMode;onRetention:()=>void;onCall:()=>void;/** Optional avatar shown left of the title (step 8). */avatar?:React.ReactNode;/** Group chats: opens "Groepsinfo" (title tap + 👥 button). */onInfo?:()=>void;memberCount?:number}){
  return <View style={[s.header,{paddingTop:10+topInset}]}>
    {onBack&&<Pressable onPress={onBack} accessibilityLabel="Terug" hitSlop={10} style={{marginRight:-2}}><Ionicons name="chevron-back" size={26} color={C.text}/></Pressable>}
    {onProfile&&!onInfo?<Pressable onPress={onProfile} accessibilityLabel={`Vriendschapsprofiel van ${title}`} testID="chat-profile-link" style={s.who}>{avatar}<Text style={s.title} numberOfLines={1}>{title}</Text></Pressable>:avatar}
    {onProfile&&!onInfo?null:onInfo?<Pressable onPress={onInfo} accessibilityLabel={`Groepsinfo van ${title}`} style={{flexShrink:1}}><Text style={s.title} numberOfLines={1}>{title}</Text>{!!memberCount&&<Text style={s.sub}>{memberCount} leden · tik voor info</Text>}</Pressable>:<Text style={s.title} numberOfLines={1}>{title}</Text>}
    <StreakBadge streak={streak}/>
    <View style={{flex:1}}/>
    <Pressable onPress={onRetention} accessibilityLabel="Verwijderinstelling" style={s.pill}><Text style={s.pillText}>⏱ {RETENTION_SHORT[retention]}</Text></Pressable>
    <Pressable onPress={onCall} accessibilityLabel="Videobellen" style={s.callBtn}><Text style={{fontSize:20}}>📹</Text></Pressable>
    {onInfo&&<Pressable onPress={onInfo} accessibilityLabel="Groepsinfo" testID="group-info-button" style={s.infoBtn}><Ionicons name="people" size={19} color={C.text}/></Pressable>}
  </View>;
}

export type ChatViewProps={
  rows:Message[];me:string;reactions:Reaction[];retention:RetentionMode;viewedAt:Record<string,number>;now:number;
  streak:StreakState;typing:string|null;
  renderContent:(m:Message,mine:boolean)=>React.ReactNode;
  onReact:(messageId:string,emoji:string)=>void;
  extraActions?:(m:Message,mine:boolean)=>{label:string;onPress:()=>void}[];
  /** Snapchat-style sender identity: display name + small avatar per sender id, and the thread's member ids (for stable colours). */
  nameOf?:(senderId:string)=>string|null;avatarOf?:(senderId:string)=>React.ReactNode;memberIds?:string[];
  pickerFor?:string|null;
  /** Snapchat read receipt under my newest message: ➤ Bezorgd / ▷ Geopend. */
  receipt?:{messageId:string;status:ChatStatus}|null;
  /** Quoted reply (swipe right on a message). Replies render a quote above their text; tap it to jump to the original. */
  onReply?:(m:Message)=>void;
};
/** Message list (inverted, newest first): bubbles, system lines, reaction chips, retention hints, typing row. */
export function ChatView(p:ChatViewProps){
  const [picker,setPicker]=useState<string|null>(p.pickerFor??null);
  const target=p.rows.find(m=>m.id===picker);
  const colors=senderColors(p.memberIds??p.rows.map(m=>m.sender_id),p.me),starts=runStarts(p.rows);
  const offset=-new Date(p.now).getTimezoneOffset(),days=dividerStarts(p.rows,offset);
  const divider=(m:Message)=>days.has(m.id)?<Text style={s.day} testID="day-divider">{dayDivider(Date.parse(m.created_at),p.now,offset)}</Text>:null;
  const current=target?p.reactions.find(r=>r.messageId===target.id&&r.userId===p.me)?.emoji:null;
  // Tap a quote: scroll to the original and flash it; if it already disappeared, say so briefly.
  const list=useRef<FlatList<Message>>(null),[flash,setFlash]=useState<string|null>(null),[gone,setGone]=useState(false);
  useEffect(()=>{if(!flash&&!gone)return;const t=setTimeout(()=>{setFlash(null);setGone(false)},1600);return()=>clearTimeout(t)},[flash,gone]);
  const jump=(ref:ReplyRef)=>{const i=quotedIndex(p.rows,ref);if(i<0){setGone(true);return}list.current?.scrollToIndex({index:i,viewPosition:.5,animated:true});setFlash(ref.id)};
  return <View style={{flex:1}}>
    <StreakWarning streak={p.streak}/>
    <FlatList ref={list} onScrollToIndexFailed={e=>{list.current?.scrollToOffset({offset:e.averageItemLength*e.index,animated:true});setTimeout(()=>list.current?.scrollToIndex({index:e.index,viewPosition:.5,animated:true}),250)}} data={p.rows} inverted keyboardShouldPersistTaps="handled" keyExtractor={x=>x.id} contentContainerStyle={{padding:15}}
      ListHeaderComponent={<TypingIndicator text={p.typing}/>} ListHeaderComponentStyle={{marginHorizontal:-15}}
      renderItem={({item})=>{
        if(item.kind==='system')return <View>{divider(item)}<SystemLine text={item.body??''} icon={isGroupChangeText(item.body)?'👥':item.body?.includes('screenshot')?'📸':item.body?.includes('gesprek')?'📹':'⏱'}/></View>;
        const mine=item.sender_id===p.me,color=colorFor(item.sender_id,colors),start=starts.has(item.id)||days.has(item.id);
        const hint=retentionHint(p.retention,mine?null:p.viewedAt[item.id]??null,p.now,!!item.saved);
        const time=new Date(item.created_at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
        const open=()=>setPicker(item.id);
        // Web: right-click opens the same menu as a long-press (mobile).
        const web=Platform.OS==='web'?{onContextMenu:(e:{preventDefault:()=>void})=>{e.preventDefault();open()}}:{};
        const reply=parseReply(item.body),shown=reply?{...item,body:reply.text}:item;
        return <View style={start?s.runStart:undefined} testID={start?`run-${item.sender_id===p.me?'me':item.sender_id}`:undefined}>
          {divider(item)}
          {start&&<View style={s.senderRow}>{p.avatarOf?.(item.sender_id)}<Text style={[s.sender,{color}]} testID="sender-label">{senderLabel(item.sender_id,p.me,p.nameOf?.(item.sender_id))}</Text><Text style={s.runTime}>{time}</Text></View>}
          <SwipeToReply enabled={!!p.onReply&&canReply(item)} onReply={()=>p.onReply?.(item)}>
          <Pressable onLongPress={open} delayLongPress={300} {...web} accessibilityHint="Veeg naar rechts om te antwoorden; lang indrukken voor reacties, melden en blokkeren" style={[s.msg,{borderLeftColor:color},flash===item.id&&s.flash]} testID={mine?'msg-mine':'msg-theirs'}>
            {reply&&<QuoteBlock label={senderLabel(reply.ref.senderId,p.me,p.nameOf?.(reply.ref.senderId))} color={colorFor(reply.ref.senderId,colors)} excerpt={reply.ref.excerpt} onPress={()=>jump(reply.ref)}/>}
            {p.renderContent(shown,mine)}
            {!!hint&&<Text style={s.time}>{hint}</Text>}
          </Pressable>
          </SwipeToReply>
          <ReactionChips mine={false} items={summarizeReactions(p.reactions,item.id,p.me)}/>
          {p.receipt?.messageId===item.id&&<View style={s.receipt} testID="chat-receipt"><StatusIcon status={p.receipt.status} size={11}/><Text style={s.receiptText}>{p.receipt.status.label}</Text></View>}
        </View>;
      }}/>
    {/* Empty state lives OUTSIDE the inverted list: an inverted FlatList renders ListEmptyComponent upside down on iOS. */}
    {gone&&<View pointerEvents="none" style={s.toast} testID="quote-gone"><Text style={s.toastText}>{QUOTE_GONE}</Text></View>}
    {p.rows.length===0&&<View pointerEvents="none" style={s.empty} testID="chat-empty"><Hint>Stuur het eerste bericht ✦</Hint></View>}
    <ReactionPicker visible={!!target} current={current} onClose={()=>setPicker(null)} onPick={e=>target&&p.onReact(target.id,e)} actions={target&&p.extraActions?p.extraActions(target,target.sender_id===p.me):[]}/>
  </View>;
}
const s=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,backgroundColor:C.surface,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  title:{color:C.text,fontSize:17,fontWeight:'700',maxWidth:150},who:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:1},pill:{backgroundColor:C.elevated,borderRadius:14,paddingHorizontal:10,paddingVertical:5},pillText:{color:C.text,fontSize:12},callBtn:{padding:4},infoBtn:{width:34,height:34,borderRadius:17,backgroundColor:'#51427980',alignItems:'center',justifyContent:'center'},sub:{color:C.muted,fontSize:11,marginTop:1},
  runStart:{marginTop:12},senderRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:3},sender:{fontSize:12,fontWeight:'800',letterSpacing:.6},runTime:{color:C.muted,fontSize:10,marginLeft:2},
  msg:{borderLeftWidth:3,paddingLeft:10,paddingVertical:3,marginLeft:2,alignSelf:'stretch'},
  empty:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center',padding:15},
  time:{color:C.muted,fontSize:10,marginTop:2},flash:{backgroundColor:'#ffffff1f',borderRadius:6},
  toast:{position:'absolute',top:12,alignSelf:'center',backgroundColor:C.elevated,borderRadius:14,paddingHorizontal:14,paddingVertical:8},toastText:{color:C.text,fontSize:13},
  day:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:1,textAlign:'center',marginTop:16,marginBottom:2},
  receipt:{flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-end',marginTop:4},receiptText:{color:C.muted,fontSize:11,fontWeight:'700'},
});
