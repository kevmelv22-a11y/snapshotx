import React,{useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {C} from '../../lib/theme';
import {Hint} from '../UI';
import type {Message} from '../../lib/types';
import {RETENTION_SHORT,retentionHint,summarizeReactions,type Reaction,type RetentionMode,type StreakState} from '../../lib/chat-features';
import {ReactionChips,ReactionPicker,StreakBadge,StreakWarning,SystemLine,TypingIndicator} from './ChatParts';

/** Header row: title, streak, retention toggle, video call. Shared by the real chat and the dev harness. */
export function ChatHeaderBar({title,streak,retention,onRetention,onCall,avatar,fixedRetention}:{title:string;streak:StreakState;retention:RetentionMode;onRetention?:()=>void;onCall:()=>void;/** Optional avatar shown left of the title (step 8). */avatar?:React.ReactNode;fixedRetention?:boolean}){
  return <View style={s.header}>
    {avatar}
    <Text style={s.title} numberOfLines={1}>{title}</Text>
    <StreakBadge streak={streak}/>
    <View style={{flex:1}}/>
    {onRetention?<Pressable onPress={onRetention} accessibilityLabel="Verwijderinstelling" style={s.pill}><Text style={s.pillText}>⏱ {RETENTION_SHORT[retention]}</Text></Pressable>:fixedRetention?<View accessibilityLabel="Vaste verwijderinstelling: 24 uur" style={s.pill}><Text style={s.pillText}>⏱ 24u · vast</Text></View>:null}
    <Pressable onPress={onCall} accessibilityLabel="Videobellen" style={s.callBtn}><Text style={{fontSize:20}}>📹</Text></Pressable>
  </View>;
}

export type ChatViewProps={
  rows:Message[];me:string;reactions:Reaction[];retention:RetentionMode;viewedAt:Record<string,number>;now:number;
  streak:StreakState;typing:string|null;
  renderContent:(m:Message,mine:boolean)=>React.ReactNode;
  onReact:(messageId:string,emoji:string)=>void;
  extraActions?:(m:Message,mine:boolean)=>{label:string;onPress:()=>void}[];
  pickerFor?:string|null;
};
/** Message list (inverted, newest first): bubbles, system lines, reaction chips, retention hints, typing row. */
export function ChatView(p:ChatViewProps){
  const [picker,setPicker]=useState<string|null>(p.pickerFor??null);
  const target=p.rows.find(m=>m.id===picker);
  const current=target?p.reactions.find(r=>r.messageId===target.id&&r.userId===p.me)?.emoji:null;
  return <View style={{flex:1}}>
    <StreakWarning streak={p.streak}/>
    <FlatList data={p.rows} inverted keyExtractor={x=>x.id} contentContainerStyle={{padding:15}}
      ListHeaderComponent={<TypingIndicator text={p.typing}/>} ListHeaderComponentStyle={{marginHorizontal:-15}}
      renderItem={({item})=>{
        if(item.kind==='system')return <SystemLine text={item.body??''} icon={item.body?.includes('screenshot')?'📸':item.body?.includes('gesprek')?'📹':'⏱'}/>;
        const mine=item.sender_id===p.me;
        const hint=retentionHint(p.retention,mine?null:p.viewedAt[item.id]??null,p.now,!!item.saved);
        return <View>
          <Pressable onLongPress={()=>setPicker(item.id)} delayLongPress={300} style={[s.bubble,mine?s.mine:s.theirs]}>
            {p.renderContent(item,mine)}
            <Text style={s.time}>{hint?`${hint} · `:''}{new Date(item.created_at).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</Text>
          </Pressable>
          <ReactionChips mine={mine} items={summarizeReactions(p.reactions,item.id,p.me)}/>
        </View>;
      }}/>
    {/* Empty state lives OUTSIDE the inverted list: an inverted FlatList renders ListEmptyComponent upside down on iOS. */}
    {p.rows.length===0&&<View pointerEvents="none" style={s.empty} testID="chat-empty"><Hint>Stuur het eerste bericht ✦</Hint></View>}
    <ReactionPicker visible={!!target} current={current} onClose={()=>setPicker(null)} onPick={e=>target&&p.onReact(target.id,e)} actions={target&&p.extraActions?p.extraActions(target,target.sender_id===p.me):[]}/>
  </View>;
}
const s=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:14,paddingVertical:10,backgroundColor:C.surface,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  title:{color:C.text,fontSize:17,fontWeight:'700',maxWidth:150},pill:{backgroundColor:C.elevated,borderRadius:14,paddingHorizontal:10,paddingVertical:5},pillText:{color:C.text,fontSize:12},callBtn:{padding:4},
  bubble:{maxWidth:'83%',borderRadius:18,padding:12,marginVertical:5},mine:{alignSelf:'flex-end',backgroundColor:'#273A7B'},theirs:{alignSelf:'flex-start',backgroundColor:C.elevated},
  empty:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center',padding:15},
  time:{color:C.muted,fontSize:10,alignSelf:'flex-end',marginTop:6},
});
