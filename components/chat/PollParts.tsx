import React,{useState} from 'react';
import {KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {POLL_LABEL,POLL_MAX_OPTIONS,POLL_MIN_OPTIONS,POLL_OPTION_MAX,POLL_QUESTION_MAX,pollBody,showResults,votesLabel,type Poll,type PollResult} from '../../lib/chat-polls';

/** Snapchat-style poll card inside a chat bubble: tap an answer to vote; after voting each answer shows a bar, % and voters. */
export function PollBubble({poll,result,senderId,me,color,onVote,avatarOf}:{poll:Poll;result:PollResult;senderId:string;me:string;color:string;onVote:(option:number)=>void;avatarOf?:(id:string)=>React.ReactNode}){
  const reveal=showResults(result,senderId,me);
  return <View style={s.card} testID="poll">
    <View style={s.head}><Ionicons name="stats-chart" size={14} color={color}/><Text style={[s.kicker,{color}]}>PEILING</Text></View>
    <Text style={s.question} testID="poll-question">{poll.question}</Text>
    {result.options.map(o=><Pressable key={o.index} onPress={()=>onVote(o.index)} testID={`poll-option-${o.index}`} accessibilityRole="button" accessibilityState={{selected:o.mine}} accessibilityLabel={`${o.label}${reveal?`, ${o.pct} procent`:''}${o.mine?', jouw stem':''}`} style={[s.option,o.mine&&{borderColor:color}]}>
      {reveal&&<View style={[s.fill,{width:`${o.pct}%`,backgroundColor:o.mine?color+'55':'#ffffff1c'}]}/>}
      <View style={s.row}>
        <View style={[s.radio,o.mine&&{borderColor:color,backgroundColor:color}]}>{o.mine&&<Ionicons name="checkmark" size={12} color="#000"/>}</View>
        <Text style={[s.label,o.leading&&reveal&&s.lead]} numberOfLines={2}>{o.label}</Text>
        {reveal&&<View style={s.voters}>{o.voters.slice(0,3).map(v=><View key={v} style={s.voter}>{avatarOf?.(v)}</View>)}</View>}
        {reveal&&<Text style={s.pct} testID={`poll-pct-${o.index}`}>{o.pct}%</Text>}
      </View>
    </Pressable>)}
    <Text style={s.foot} testID="poll-total">{votesLabel(result.total)}{result.myVote!==null?' · tik nogmaals om je stem in te trekken':` · ${POLL_LABEL.tapToVote}`}</Text>
  </View>;
}

/** "Peiling maken" sheet: question + 2–5 answers. Calls onSend with the ready message body. */
export function PollComposer({visible,onClose,onSend}:{visible:boolean;onClose:()=>void;onSend:(body:string)=>void}){
  const [q,setQ]=useState(''),[opts,setOpts]=useState<string[]>(['','']),[error,setError]=useState<string|null>(null);
  const reset=()=>{setQ('');setOpts(['','']);setError(null)};
  const close=()=>{reset();onClose()};
  const send=()=>{const r=pollBody(q,opts);if(!r.ok){setError(r.error);return}onSend(r.body);reset()};
  const ready=q.trim()&&opts.filter(o=>o.trim()).length>=POLL_MIN_OPTIONS;
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Sluiten"/>
      <View style={s.sheet} testID="poll-composer">
        <View style={s.sheetHead}><Pressable onPress={close} hitSlop={10} accessibilityLabel="Annuleren" testID="poll-cancel"><Ionicons name="close" size={24} color={C.text}/></Pressable><Text style={s.title}>{POLL_LABEL.create}</Text><View style={{width:24}}/></View>
        <TextInput style={[s.input,s.qInput]} value={q} onChangeText={v=>{setQ(v);setError(null)}} placeholder={POLL_LABEL.question} placeholderTextColor={C.muted} maxLength={POLL_QUESTION_MAX} testID="poll-question-input" multiline autoFocus/>
        {opts.map((o,i)=><View key={i} style={s.optRow}>
          <TextInput style={[s.input,{flex:1}]} value={o} onChangeText={v=>{setOpts(x=>x.map((y,j)=>j===i?v:y));setError(null)}} placeholder={POLL_LABEL.option(i)} placeholderTextColor={C.muted} maxLength={POLL_OPTION_MAX} testID={`poll-option-input-${i}`}/>
          {opts.length>POLL_MIN_OPTIONS&&<Pressable onPress={()=>setOpts(x=>x.filter((_,j)=>j!==i))} hitSlop={8} accessibilityLabel={`Antwoord ${i+1} verwijderen`} testID={`poll-remove-${i}`}><Ionicons name="remove-circle" size={22} color={C.muted}/></Pressable>}
        </View>)}
        {opts.length<POLL_MAX_OPTIONS&&<Pressable onPress={()=>setOpts(x=>[...x,''])} style={s.add} testID="poll-add-option"><Ionicons name="add-circle" size={20} color={C.yellow}/><Text style={s.addText}>{POLL_LABEL.add}</Text></Pressable>}
        {!!error&&<Text style={s.error} testID="poll-error">{error}</Text>}
        <Pressable onPress={send} style={[s.send,!ready&&{opacity:.45}]} accessibilityLabel={POLL_LABEL.send} testID="poll-send"><Text style={s.sendText}>{POLL_LABEL.send} ➤</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const s=StyleSheet.create({
  card:{backgroundColor:'#ffffff0d',borderRadius:14,padding:12,marginVertical:3,maxWidth:320,gap:7},
  head:{flexDirection:'row',alignItems:'center',gap:6},kicker:{fontSize:11,fontWeight:'900',letterSpacing:1.2},
  question:{color:C.text,fontSize:16,fontWeight:'800',marginBottom:2},
  option:{borderRadius:12,borderWidth:1.5,borderColor:'#ffffff26',overflow:'hidden',minHeight:42,justifyContent:'center'},
  fill:{position:'absolute',left:0,top:0,bottom:0},
  row:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:10,paddingVertical:9},
  radio:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:C.muted,alignItems:'center',justifyContent:'center'},
  label:{flex:1,color:C.text,fontSize:14,fontWeight:'600'},lead:{fontWeight:'900'},
  voters:{flexDirection:'row'},voter:{marginLeft:-6},
  pct:{color:C.text,fontSize:13,fontWeight:'800',minWidth:38,textAlign:'right',fontVariant:['tabular-nums']},
  foot:{color:C.muted,fontSize:11,fontWeight:'600'},
  backdrop:{flex:1,backgroundColor:'#000a',justifyContent:'flex-end'},
  sheet:{backgroundColor:C.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,gap:10},
  sheetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},title:{color:C.text,fontSize:18,fontWeight:'800'},
  input:{color:C.text,backgroundColor:C.elevated,borderRadius:14,paddingHorizontal:14,paddingVertical:11,fontSize:15},qInput:{fontSize:17,fontWeight:'700',minHeight:52},
  optRow:{flexDirection:'row',alignItems:'center',gap:8},
  add:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:6},addText:{color:C.yellow,fontSize:14,fontWeight:'700'},
  error:{color:C.danger,fontSize:13},
  send:{backgroundColor:C.yellow,borderRadius:24,paddingVertical:13,alignItems:'center',marginTop:4},sendText:{color:'#000',fontSize:16,fontWeight:'900'},
});
