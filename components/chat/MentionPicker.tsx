import React from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {C} from '../../lib/theme';
import {MENTION_BADGE,MENTION_PICKER_TITLE,mentionLabel,parseMentions,type MentionMember} from '../../lib/chat-mentions';

/** Member picker above the group-chat input while typing "@…" (Snapchat): avatar + name + "@Label". */
export function MentionPicker({candidates,members,colorOf,avatarOf,onPick}:{candidates:MentionMember[];members:MentionMember[];colorOf:(id:string)=>string;avatarOf:(id:string)=>React.ReactNode;onPick:(m:MentionMember)=>void}){
  if(!candidates.length)return null;
  return <View style={s.box} testID="mention-picker">
    <Text style={s.title}>{MENTION_PICKER_TITLE}</Text>
    <ScrollView style={{maxHeight:4*48}} keyboardShouldPersistTaps="always">
      {candidates.map(m=><Pressable key={m.id} onPress={()=>onPick(m)} style={({pressed})=>[s.row,pressed&&s.pressed]} testID="mention-option" accessibilityRole="button" accessibilityLabel={`Vermeld ${m.name}`}>
        {avatarOf(m.id)}
        <Text style={s.name} numberOfLines={1}>{m.name}</Text>
        <Text style={[s.handle,{color:colorOf(m.id)}]} numberOfLines={1}>@{mentionLabel(m,members)}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

/** Message text with @mentions bold in the mentioned member's colour; a mention of me gets a yellow highlight. */
export function MentionText({body,members,me,colorOf,style}:{body:string;members:MentionMember[];me:string;colorOf:(id:string)=>string;style:object}){
  const parts=parseMentions(body,members);
  const mine=parts.some(p=>p.userId===me);
  return <View>
    <Text style={style}>{parts.map((p,i)=>p.userId?<Text key={i} style={[s.mention,{color:colorOf(p.userId)},p.userId===me&&s.meMention]} testID={p.userId===me?'mention-me':'mention'}>{p.text}</Text>:<Text key={i}>{p.text}</Text>)}</Text>
    {mine&&<View style={s.badge} testID="msg-mentions-me"><Text style={s.badgeText}>{MENTION_BADGE}</Text></View>}
  </View>;
}

const s=StyleSheet.create({
  box:{backgroundColor:C.surface,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,paddingTop:8,paddingBottom:4},
  title:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:.8,paddingHorizontal:16,marginBottom:2,textTransform:'uppercase'},
  row:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,height:48},pressed:{backgroundColor:'#ffffff12'},
  name:{color:C.text,fontSize:15,fontWeight:'700',flexShrink:1},handle:{fontSize:13,fontWeight:'800',marginLeft:'auto'},
  mention:{fontWeight:'800'},meMention:{backgroundColor:'#FFFC0026',borderRadius:4},
  badge:{alignSelf:'flex-start',backgroundColor:'#FFFC00',borderRadius:8,paddingHorizontal:6,paddingVertical:1,marginTop:4},badgeText:{color:'#000',fontSize:10,fontWeight:'900'},
});
