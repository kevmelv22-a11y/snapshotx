import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,KeyboardAvoidingView,Modal,Platform,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Stack,router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useConfirmDialog} from '../components/ConfirmDialog';
import {useSession} from '../hooks/useSession';
import {DEMO_MODE,supabase} from '../lib/supabase';
import {kavBehavior} from '../lib/keyboard';
import {AI_DISCLAIMER,AI_MAX_CHARS,AI_REPORT_REASONS,aiReportRow,type AiReportReason,AI_NAME,AI_SUGGESTIONS,AI_WELCOME,aiErrorText,aiMessage,cleanInput,demoReply,turnsForRequest,type AiMessage} from '../lib/my-ai';
import {useMyAi} from '../stores/myAi';

const EMPTY:AiMessage[]=[];
/** Mijn AI: Snapchat My AI-style chat with an AI buddy (edge function `my-ai`; history on this device only). */
export default function MyAiScreen(){
 const {session}=useSession(),uid=session?.user.id??'',insets=useSafeAreaInsets(),confirm=useConfirmDialog();
 const history=useMyAi(s=>uid?s.byUser[uid]??EMPTY:EMPTY),add=useMyAi(s=>s.add),markFailed=useMyAi(s=>s.markFailed),clear=useMyAi(s=>s.clear);
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[reporting,setReporting]=useState<string|null>(null),[reportMsg,setReportMsg]=useState('');
 const list=useRef<FlatList<AiMessage>>(null);
 useEffect(()=>{const t=setTimeout(()=>list.current?.scrollToEnd({animated:true}),60);return()=>clearTimeout(t)},[history.length,busy]);
 async function ask(raw:string){const q=cleanInput(raw);if(!q||busy||!uid)return;setText('');setNotice('');const mine=aiMessage('user',q);add(uid,mine);setBusy(true);
  try{
   if(DEMO_MODE){await new Promise(r=>setTimeout(r,700));add(uid,aiMessage('assistant',demoReply(q)));return}
   const {data,error}=await supabase.functions.invoke('my-ai',{body:{messages:turnsForRequest([...history,mine])}});
   if(error){const ctx=(error as {context?:Response}).context;let code:string|undefined;try{code=(await ctx?.json())?.error}catch{}markFailed(uid,mine.id);setNotice(aiErrorText(code,ctx?.status));return}
   const reply=typeof (data as {reply?:unknown})?.reply==='string'?(data as {reply:string}).reply:'';
   if(!reply){markFailed(uid,mine.id);setNotice(aiErrorText(null));return}
   add(uid,aiMessage('assistant',reply));
  }catch{markFailed(uid,mine.id);setNotice(aiErrorText(null))}finally{setBusy(false)}}
 async function report(reason:AiReportReason){if(!reporting||!uid)return;const row=aiReportRow(uid,reason,history,reporting);if(!row){setReporting(null);return}const {error}=await supabase.from('sx_ai_reports').insert(row);setReportMsg(error?'Melden lukte niet. Probeer het later opnieuw.':'Bedankt! We bekijken je melding.')}
 const clearChat=()=>confirm.ask({title:'Chat met Mijn AI wissen?',message:'De berichten worden van dit apparaat verwijderd.',confirmLabel:'Wissen',destructive:true},()=>{if(uid)clear(uid);return null});
 const data:AiMessage[]=[{id:'welcome',role:'assistant',content:AI_WELCOME,at:0},...history];
 return <GalaxyScreen readable><Stack.Screen options={{headerShown:false}}/>
  <KeyboardAvoidingView style={{flex:1}} behavior={kavBehavior(Platform.OS)}>
  <View style={[s.header,{paddingTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/chats')} accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" size={27} color="white"/></Pressable>
   <View style={s.headMid}><View style={s.bot}><Text style={s.botEmoji}>✨</Text></View><View><Text style={s.title}>{AI_NAME}</Text><Text style={s.sub}>AI-chatbot · geen mens</Text></View></View>
   <Pressable onPress={clearChat} accessibilityLabel="Chat wissen" hitSlop={10} testID="ai-clear"><Ionicons name="trash-outline" size={22} color="#D8D2E0"/></Pressable></View>
  <FlatList ref={list} data={data} keyExtractor={m=>m.id} contentContainerStyle={s.list} testID="ai-list"
   ListHeaderComponent={<Text style={s.disclaimer}>{AI_DISCLAIMER}</Text>}
   renderItem={({item})=>item.role==='user'?<View style={[s.bubble,s.mine,item.failed&&s.failed]}><Text style={s.text}>{item.content}</Text>{item.failed&&<Pressable onPress={()=>void ask(item.content)} accessibilityLabel="Opnieuw proberen"><Text style={s.retry}>Niet verstuurd · tik om opnieuw te proberen</Text></Pressable>}</View>
    :<View style={s.aiRow}><View style={s.botSmall}><Text style={{fontSize:13}}>✨</Text></View><Pressable onLongPress={()=>item.id!=='welcome'&&(setReportMsg(''),setReporting(item.id))} delayLongPress={350} style={[s.bubble,s.ai]}><Text style={s.text}>{item.content}</Text></Pressable>{item.id!=='welcome'&&<Pressable onPress={()=>{setReportMsg('');setReporting(item.id)}} hitSlop={8} accessibilityLabel="AI-antwoord melden" testID="ai-report"><Ionicons name="flag-outline" size={15} color="#8E879A"/></Pressable>}</View>}
   ListFooterComponent={<>{busy&&<View style={s.aiRow}><View style={s.botSmall}><Text style={{fontSize:13}}>✨</Text></View><View style={[s.bubble,s.ai,{flexDirection:'row',gap:8,alignItems:'center'}]}><ActivityIndicator color="#FFFC00" size="small"/><Text style={s.typing}>Mijn AI typt…</Text></View></View>}
    {!history.length&&!busy&&<View style={s.suggestions}>{AI_SUGGESTIONS.map(q=><Pressable key={q} style={s.chip} onPress={()=>void ask(q)} testID="ai-suggestion"><Text style={s.chipText}>{q}</Text></Pressable>)}</View>}
    {!!notice&&<Text style={s.notice} testID="ai-notice">{notice}</Text>}</>}/>
  <View style={[s.inputRow,{paddingBottom:Math.max(10,insets.bottom)}]}><TextInput value={text} onChangeText={setText} placeholder="Stuur een bericht naar Mijn AI" placeholderTextColor="#8E879A" style={s.input} maxLength={AI_MAX_CHARS} multiline testID="ai-input"/>
   <Pressable onPress={()=>void ask(text)} disabled={busy||!text.trim()} style={[s.send,(busy||!text.trim())&&{opacity:.5}]} accessibilityLabel="Versturen" testID="ai-send"><Ionicons name="send" size={20} color="#140F22"/></Pressable></View>
  </KeyboardAvoidingView>
  <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={()=>setReporting(null)}><Pressable style={s.shade} onPress={()=>setReporting(null)}><Pressable onPress={()=>{}} style={[s.sheet,{paddingBottom:Math.max(20,insets.bottom)}]} testID="ai-report-sheet"><Text style={s.sheetTitle}>AI-antwoord melden</Text>{reportMsg?<><Text style={s.sheetText}>{reportMsg}</Text><Pressable style={s.sheetBtn} onPress={()=>setReporting(null)}><Text style={s.sheetBtnText}>Sluiten</Text></Pressable></>:<><Text style={s.sheetText}>Wat is er mis met dit antwoord? Het antwoord en je vraag ervoor worden meegestuurd.</Text>{AI_REPORT_REASONS.map(x=><Pressable key={x.id} style={s.reason} onPress={()=>void report(x.id)} testID={`ai-report-${x.id}`}><Text style={s.reasonText}>{x.label}</Text><Ionicons name="chevron-forward" size={18} color="#AAA4B4"/></Pressable>)}</>}</Pressable></Pressable></Modal>
  {confirm.dialog}
 </GalaxyScreen>;
}
const s=StyleSheet.create({header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:10,gap:10},headMid:{flex:1,flexDirection:'row',alignItems:'center',gap:10},bot:{width:40,height:40,borderRadius:20,backgroundColor:'#5B2DB8',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#FFFC00'},botEmoji:{fontSize:20},botSmall:{width:26,height:26,borderRadius:13,backgroundColor:'#5B2DB8',alignItems:'center',justifyContent:'center'},title:{color:'white',fontSize:19,fontWeight:'900'},sub:{color:'#C9C2D0',fontSize:12},list:{padding:14,gap:10},disclaimer:{color:'#A9A2B5',fontSize:12,lineHeight:17,textAlign:'center',marginBottom:6,paddingHorizontal:10},aiRow:{flexDirection:'row',alignItems:'flex-end',gap:7,maxWidth:'88%'},bubble:{borderRadius:18,paddingHorizontal:14,paddingVertical:10,maxWidth:'82%'},mine:{alignSelf:'flex-end',backgroundColor:'#0F7BD9'},failed:{backgroundColor:'#5A2A3A'},ai:{backgroundColor:'#2A2140',flexShrink:1,maxWidth:'100%'},text:{color:'white',fontSize:16,lineHeight:22},retry:{color:'#FFB3C1',fontSize:12,marginTop:4,fontWeight:'700'},typing:{color:'#D8D2E0',fontSize:14},suggestions:{gap:8,marginTop:8},chip:{alignSelf:'flex-start',backgroundColor:'#2A2140',borderWidth:1,borderColor:'#FFFC0055',borderRadius:18,paddingHorizontal:13,paddingVertical:9},chipText:{color:'#FFFC00',fontWeight:'700',fontSize:14},notice:{color:'#FFD37A',fontWeight:'700',textAlign:'center',marginTop:8},inputRow:{flexDirection:'row',alignItems:'flex-end',gap:8,paddingHorizontal:12,paddingTop:8,backgroundColor:'#120D1FE6'},input:{flex:1,backgroundColor:'#2A2140',color:'white',borderRadius:20,paddingHorizontal:15,paddingVertical:10,fontSize:16,maxHeight:120},shade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{backgroundColor:'#1D1730',borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,gap:8},sheetTitle:{color:'white',fontSize:18,fontWeight:'900'},sheetText:{color:'#D8D2E0',fontSize:14,lineHeight:20},reason:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#ffffff14'},reasonText:{color:'white',fontSize:16,fontWeight:'700'},sheetBtn:{alignSelf:'center',marginTop:10,backgroundColor:'#FFFC00',borderRadius:20,paddingHorizontal:22,paddingVertical:10},sheetBtnText:{color:'#140F22',fontWeight:'900'},send:{width:44,height:44,borderRadius:22,backgroundColor:'#FFFC00',alignItems:'center',justifyContent:'center'}});
