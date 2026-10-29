import React,{useEffect,useState} from 'react';
import {Modal,Platform,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {useNow} from '../hooks/useNow';
import {useCountdowns,useMyCountdowns} from '../stores/countdowns';
import {COUNTDOWN_EMOJIS,COUNTDOWN_MAX,COUNTDOWN_PRESETS,TITLE_MAX,formatDutchDate,remainingClock,remainingLabel,shareText,sortCountdowns,validateDraft,type Countdown,type CountdownDraft} from '../lib/countdowns';
const purple='#AE16C7',DAY=86400000;

const emptyDraft=(now:number):CountdownDraft=>({title:'',emoji:'🎉',...formatDutchDate(new Date(new Date(now+7*DAY).setHours(20,0,0,0)).getTime())});

/** Snapchat "Afteltimers" (Mijn profiel › Afteltimers): live countdowns to your own events, add/edit/share/delete. */
export default function Countdowns(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets(),now=useNow(1000);
 const list=useMyCountdowns(uid),{add,update,remove,prune}=useCountdowns();
 const [editing,setEditing]=useState<Countdown|'new'|null>(null),[draft,setDraft]=useState<CountdownDraft>(()=>emptyDraft(Date.now()));
 const [error,setError]=useState<{field:string;text:string}|null>(null),[confirmDelete,setConfirmDelete]=useState<string|null>(null),[notice,setNotice]=useState('');
 useEffect(()=>{if(uid)prune(uid,Date.now())},[uid,prune]);
 const sorted=sortCountdowns(list,now);
 function open(c:Countdown|'new'){setError(null);setConfirmDelete(null);setEditing(c);setDraft(c==='new'?emptyDraft(Date.now()):{title:c.title,emoji:c.emoji,...formatDutchDate(c.at)})}
 function save(){if(!uid||!editing)return;const t=Date.now(),r=validateDraft(draft,t,editing==='new'?list.length:0);if(!r.ok){setError({field:r.field,text:r.error});return}
  if(editing==='new'){add(uid,r.value,t);setNotice(`Afteltimer "${r.value.title}" toegevoegd aan je profiel.`)}else{update(uid,editing.id,r.value);setNotice('Afteltimer bijgewerkt.')}setEditing(null)}
 function del(c:Countdown){if(!uid)return;if(confirmDelete!==c.id){setConfirmDelete(c.id);return}remove(uid,c.id);setConfirmDelete(null);setEditing(null);setNotice(`"${c.title}" verwijderd.`)}
 async function share(c:Countdown){const message=shareText(c,now);try{if(Platform.OS==='web'){const nav=(globalThis as {navigator?:{share?:(d:{text:string})=>Promise<void>;clipboard?:{writeText:(t:string)=>Promise<void>}}}).navigator;if(nav?.share)await nav.share({text:message});else{await nav?.clipboard?.writeText(message);setNotice('Gekopieerd: '+message)}}else await Share.share({message})}catch{/* user closed the share sheet */}}
 const quick=(label:string,ms:number)=><Pressable key={label} style={s.chip} onPress={()=>{setDraft(d=>({...d,...formatDutchDate(ms)}));setError(null)}}><Text style={s.chipText}>{label}</Text></Pressable>;
 const base=new Date(now);
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Afteltimers</Text><Pressable onPress={()=>open('new')} accessibilityLabel="Nieuwe afteltimer" testID="countdown-add"><Ionicons name="add-circle" color="white" size={29}/></Pressable></View>
 <ScrollView contentContainerStyle={s.content}>
  {sorted.map(c=>{const done=c.at<=now;return <Pressable key={c.id} style={[s.card,done&&s.cardDone]} onPress={()=>open(c)} accessibilityLabel={`${c.title}, ${remainingLabel(c.at,now)}`} testID={`countdown-${c.id}`}>
   <View style={s.cardTop}><Text style={s.emoji}>{c.emoji}</Text><View style={s.rowBody}><Text style={s.cardTitle} numberOfLines={1}>{c.title}</Text><Text style={s.when}>{new Date(c.at).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}{formatDutchDate(c.at).time!=='00:00'?` · ${formatDutchDate(c.at).time}`:''}</Text></View><Pressable onPress={()=>void share(c)} hitSlop={8} accessibilityLabel={`${c.title} delen`}><Ionicons name="share-outline" size={22} color="#E7C8F2"/></Pressable></View>
   <Text style={[s.clock,done&&s.clockDone]}>{done?(remainingLabel(c.at,now)==='Nu!'?'🎉 Het is zover!':'Afgelopen'):remainingClock(c.at,now)}</Text>
   {!done&&<Text style={s.left}>{remainingLabel(c.at,now)}</Text>}
  </Pressable>})}
  {!sorted.length&&<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="time-outline" size={42} color="#E7C8F2"/></View><Text style={s.emptyTitle}>Nog geen afteltimers</Text><Text style={s.description}>Tel af naar je verjaardag, vakantie of een concert. Je timers staan op je profiel.</Text><Pressable style={s.primary} onPress={()=>open('new')} testID="countdown-add-empty"><Text style={s.primaryText}>Afteltimer maken</Text></Pressable></View>}
  {!!sorted.length&&<Pressable style={[s.addRow,list.length>=COUNTDOWN_MAX&&{opacity:0.5}]} onPress={()=>open('new')}><Ionicons name="add" size={22} color="white"/><Text style={s.rowText}>Nieuwe afteltimer</Text></Pressable>}
  {!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}
  <Text style={s.foot}>Afteltimers worden op dit toestel bewaard en verdwijnen een week nadat ze zijn afgelopen. Maximaal {COUNTDOWN_MAX} timers.</Text>
 </ScrollView>
 <Modal visible={!!editing} transparent animationType="slide" onRequestClose={()=>setEditing(null)}><Pressable style={s.shade} onPress={()=>setEditing(null)}><Pressable style={[s.sheet,{paddingBottom:Math.max(insets.bottom,18)}]} onPress={e=>e.stopPropagation()}>
  <View style={s.sheetHead}><Pressable onPress={()=>setEditing(null)} testID="countdown-cancel"><Text style={s.cancel}>Annuleren</Text></Pressable><Text style={s.sheetTitle}>{editing==='new'?'Nieuwe afteltimer':'Afteltimer bewerken'}</Text><Pressable onPress={save} testID="countdown-save"><Text style={s.done}>Klaar</Text></Pressable></View>
  <ScrollView keyboardShouldPersistTaps="handled">
   {editing==='new'&&<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>{COUNTDOWN_PRESETS.map(p=><Pressable key={p.title} style={s.chip} onPress={()=>{setDraft(d=>({...d,title:p.title,emoji:p.emoji}));setError(null)}}><Text style={s.chipText}>{p.emoji} {p.title}</Text></Pressable>)}</ScrollView>}
   <Text style={s.label}>Naam</Text>
   <View style={[s.inputRow,error?.field==='title'&&s.inputBad]}><Text style={s.inputEmoji}>{draft.emoji}</Text><TextInput value={draft.title} onChangeText={v=>{setDraft(d=>({...d,title:v}));setError(null)}} maxLength={TITLE_MAX} placeholder="Bijv. Vakantie naar Spanje" placeholderTextColor="#8E879E" style={s.input} testID="countdown-title" accessibilityLabel="Naam afteltimer"/><Text style={s.count}>{draft.title.length}/{TITLE_MAX}</Text></View>
   <Text style={s.label}>Emoji</Text>
   <View style={s.emojiGrid}>{COUNTDOWN_EMOJIS.map(e=><Pressable key={e} onPress={()=>setDraft(d=>({...d,emoji:e}))} style={[s.emojiCell,draft.emoji===e&&s.emojiOn]} accessibilityLabel={`Emoji ${e}`}><Text style={{fontSize:24}}>{e}</Text></Pressable>)}</View>
   <Text style={s.label}>Datum en tijd</Text>
   <View style={{flexDirection:'row',gap:10}}><TextInput value={draft.date} onChangeText={v=>{setDraft(d=>({...d,date:v}));setError(null)}} placeholder="dd-mm-jjjj" placeholderTextColor="#8E879E" style={[s.input,s.box,{flex:1.6,minWidth:0,width:0},error?.field==='date'&&s.inputBad]} keyboardType="numbers-and-punctuation" maxLength={10} testID="countdown-date" accessibilityLabel="Datum"/><TextInput value={draft.time} onChangeText={v=>{setDraft(d=>({...d,time:v}));setError(null)}} placeholder="uu:mm" placeholderTextColor="#8E879E" style={[s.input,s.box,{flex:1,minWidth:0,width:0},error?.field==='date'&&s.inputBad]} keyboardType="numbers-and-punctuation" maxLength={5} testID="countdown-time" accessibilityLabel="Tijd"/></View>
   <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:8}}>{quick('Morgen',new Date(base.getFullYear(),base.getMonth(),base.getDate()+1,20).getTime())}{quick('Over 1 week',new Date(base.getFullYear(),base.getMonth(),base.getDate()+7,20).getTime())}{quick('Over 1 maand',new Date(base.getFullYear(),base.getMonth()+1,base.getDate(),20).getTime())}{quick('Oudejaarsavond',new Date(base.getFullYear(),11,31,23,59).getTime())}</View>
   {!!error&&<Text style={s.error} testID="countdown-error">{error.text}</Text>}
   {(()=>{const r=validateDraft(draft,now,0);return r.ok?<Text style={s.preview}>{remainingLabel(r.value.at,now)} · {remainingClock(r.value.at,now)}</Text>:null})()}
   {editing&&editing!=='new'&&<Pressable style={[s.delete,confirmDelete===editing.id&&s.deleteSure]} onPress={()=>del(editing)} testID="countdown-delete"><Ionicons name="trash-outline" size={19} color="#FF8A8A"/><Text style={s.deleteText}>{confirmDelete===editing.id?'Tik nogmaals om te verwijderen':'Afteltimer verwijderen'}</Text></Pressable>}
  </ScrollView>
 </Pressable></Pressable></Modal></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:55},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:17,fontWeight:'700'},description:{color:'#AAA6B5',fontSize:14,marginTop:6,textAlign:'center',lineHeight:20},
 card:{backgroundColor:'#2B253CD0',borderRadius:20,padding:16,marginBottom:12,borderWidth:1,borderColor:'#AE16C755'},cardDone:{opacity:0.6,borderColor:'#FFFFFF22'},cardTop:{flexDirection:'row',alignItems:'center',gap:12},emoji:{fontSize:34},cardTitle:{color:'white',fontSize:19,fontWeight:'800'},when:{color:'#AAA6B5',fontSize:13,marginTop:2,textTransform:'capitalize'},clock:{color:'white',fontSize:34,fontWeight:'900',marginTop:12,letterSpacing:1,fontVariant:['tabular-nums']},clockDone:{fontSize:24},left:{color:'#E7C8F2',fontSize:14,fontWeight:'700',marginTop:2},
 empty:{alignItems:'center',paddingTop:50,paddingHorizontal:20},emptyIcon:{width:84,height:84,borderRadius:42,backgroundColor:'#2B253C',alignItems:'center',justifyContent:'center',marginBottom:14},emptyTitle:{color:'white',fontSize:20,fontWeight:'800'},primary:{backgroundColor:purple,borderRadius:24,paddingHorizontal:26,paddingVertical:13,marginTop:20},primaryText:{color:'white',fontWeight:'800',fontSize:16},
 addRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderRadius:16,paddingVertical:14,borderWidth:1,borderColor:'#FFFFFF33',borderStyle:'dashed'},notice:{backgroundColor:'#322641',borderRadius:14,padding:14,marginTop:16},noticeText:{color:'white'},foot:{color:'#8E879E',fontSize:13,lineHeight:18,marginTop:22},
 shade:{flex:1,backgroundColor:'#000A',justifyContent:'flex-end'},sheet:{backgroundColor:'#1C1628',borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,maxHeight:'90%'},sheetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},sheetTitle:{color:'white',fontSize:18,fontWeight:'800'},cancel:{color:'#AAA6B5',fontSize:16},done:{color:'#E7A6F5',fontSize:16,fontWeight:'800'},
 chip:{backgroundColor:'#2B253C',borderRadius:18,paddingHorizontal:12,paddingVertical:8,marginRight:8,marginBottom:8},chipText:{color:'#E8E2ED',fontSize:14,fontWeight:'600'},label:{color:'#AAA6B5',fontSize:13,fontWeight:'700',marginTop:8,marginBottom:6,textTransform:'uppercase'},
 inputRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#2B253C',borderRadius:14,paddingHorizontal:12,borderWidth:1,borderColor:'transparent'},inputBad:{borderColor:'#FF8A8A'},inputEmoji:{fontSize:22,marginRight:8},input:{flex:1,minWidth:0,color:'white',fontSize:17,paddingVertical:12},box:{backgroundColor:'#2B253C',borderRadius:14,paddingHorizontal:14,borderWidth:1,borderColor:'transparent'},count:{color:'#8E879E',fontSize:12},
 emojiGrid:{flexDirection:'row',flexWrap:'wrap',gap:6},emojiCell:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#2B253C'},emojiOn:{backgroundColor:purple},
 error:{color:'#FF8A8A',marginTop:10},preview:{color:'#E7C8F2',marginTop:12,fontWeight:'700'},delete:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:22,paddingVertical:13,borderRadius:14,backgroundColor:'#3A1F2A'},deleteSure:{backgroundColor:'#5A1F2A'},deleteText:{color:'#FF8A8A',fontWeight:'800'}});
