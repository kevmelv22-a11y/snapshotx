import React,{useState} from 'react';
import {FlatList,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {isGroupChangeText} from '../../lib/group-chat';
import {Hint} from '../UI';
import type {Message} from '../../lib/types';
import {RETENTION_SHORT,retentionHint,summarizeReactions,type Reaction,type RetentionMode,type StreakState} from '../../lib/chat-features';
import {colorFor,runStarts,senderColors,senderLabel} from '../../lib/chat-senders';
import {ReactionChips,ReactionPicker,StreakBadge,StreakWarning,SystemLine,TypingIndicator} from './ChatParts';

/** Header row: title, streak, retention toggle, video call. Shared by the real chat and the dev harness. */
export function ChatHeaderBar({title,streak,retention,onRetention,onCall,avatar,onInfo,memberCount,onBack,topInset=0}:{onBack?:()=>void;topInset?:number;title:string;streak:StreakState;retention:RetentionMode;onRetention:()=>void;onCall:()=>void;/** Optional avatar shown left of the title (step 8). */avatar?:React.ReactNode;/** Group chats: opens "Groepsinfo" (title tap + 👥 button). */onInfo?:()=>void;memberCount?:number}){
  return <View style={[s.header,{paddingTop:10+topInset}]}>
    {onBack&&<Pressable onPress={onBack} accessibilityLabel="Terug" hitSlop={10} style={{marginRight:-2}}><Ionicons name="chevron-back" size={26} color={C.text}/></Pressable>}
    {avatar}
    {onInfo?<Pressable onPress={onInfo} accessibilityLabel={`Groepsinfo van ${title}`} style={{flexShrink:1}}><Text style={s.title} numberOfLines={1}>{title}</Text>{!!memberCount&&<Text style={s.sub}>{memberCount} leden · tik voor info</Text>}</Pressable>:<Text style={s.title} numberOfLines={1}>{title}</Text>}
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
};
/** Message list (inverted, newest first): bubbles, system lines, reaction chips, retention hints, typing row. */
export function ChatView(p:ChatViewProps){
  const [picker,setPicker]=useState<string|null>(p.pickerFor??null);
  const target=p.rows.find(m=>m.id===picker);
  const colors=senderColors(p.memberIds??p.rows.map(m=>m.sender_id),p.me),starts=runStarts(p.rows);
  const current=target?p.reactions.find(r=>r.messageId===target.id&&r.userId===p.me)?.emoji:null;
  return <View style={{flex:1}}>
    <StreakWarning streak={p.streak}/>
    <FlatList data={p.rows} inverted keyExtractor={x=>x.id} contentContainerStyle={{padding:15}}
      ListHeaderComponent={<TypingIndicator text={p.typing}/>} ListHeaderComponentStyle={{marginHorizontal:-15}}
      renderItem={({item})=>{
        if(item.kind==='system')return <SystemLine text={item.body??''} icon={isGroupChangeText(item.body)?'👥':item.body?.includes('screenshot')?'📸':item.body?.includes('gesprek')?'📹':'⏱'}/>;
        const mine=item.sender_id===p.me,color=colorFor(item.sender_id,colors),start=starts.has(item.id);
        const hint=retentionHint(p.retention,mine?null:p.viewedAt[item.id]??null,p.now,!!item.saved);
        const time=new Date(item.created_at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
        const open=()=>setPicker(item.id);
        // Web: right-click opens the same menu as a long-press (mobile).
        const web=Platform.OS==='web'?{onContextMenu:(e:{preventDefault:()=>void})=>{e.preventDefault();open()}}:{};
        return <View style={start?s.runStart:undefined} testID={start?`run-${item.sender_id===p.me?'me':item.sender_id}`:undefined}>
          {start&&<View style={s.senderRow}>{p.avatarOf?.(item.sender_id)}<Text style={[s.sender,{color}]} testID="sender-label">{senderLabel(item.sender_id,p.me,p.nameOf?.(item.sender_id))}</Text><Text style={s.runTime}>{time}</Text></View>}
          <Pressable onLongPress={open} delayLongPress={300} {...web} accessibilityHint="Lang indrukken voor reacties, melden en blokkeren" style={[s.msg,{borderLeftColor:color}]} testID={mine?'msg-mine':'msg-theirs'}>
            {p.renderContent(item,mine)}
            {!!hint&&<Text style={s.time}>{hint}</Text>}
          </Pressable>
          <ReactionChips mine={false} items={summarizeReactions(p.reactions,item.id,p.me)}/>
        </View>;
      }}/>
    {/* Empty state lives OUTSIDE the inverted list: an inverted FlatList renders ListEmptyComponent upside down on iOS. */}
    {p.rows.length===0&&<View pointerEvents="none" style={s.empty} testID="chat-empty"><Hint>Stuur het eerste bericht ✦</Hint></View>}
    <ReactionPicker visible={!!target} current={current} onClose={()=>setPicker(null)} onPick={e=>target&&p.onReact(target.id,e)} actions={target&&p.extraActions?p.extraActions(target,target.sender_id===p.me):[]}/>
  </View>;
}
const s=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,backgroundColor:C.surface,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  title:{color:C.text,fontSize:17,fontWeight:'700',maxWidth:150},pill:{backgroundColor:C.elevated,borderRadius:14,paddingHorizontal:10,paddingVertical:5},pillText:{color:C.text,fontSize:12},callBtn:{padding:4},infoBtn:{width:34,height:34,borderRadius:17,backgroundColor:'#51427980',alignItems:'center',justifyContent:'center'},sub:{color:C.muted,fontSize:11,marginTop:1},
  runStart:{marginTop:12},senderRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:3},sender:{fontSize:12,fontWeight:'800',letterSpacing:.6},runTime:{color:C.muted,fontSize:10,marginLeft:2},
  msg:{borderLeftWidth:3,paddingLeft:10,paddingVertical:3,marginLeft:2,alignSelf:'stretch'},
  empty:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center',padding:15},
  time:{color:C.muted,fontSize:10,marginTop:2},
});
