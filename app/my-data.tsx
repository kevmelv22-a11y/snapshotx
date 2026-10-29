import React,{useState} from 'react';
import {ActivityIndicator,Platform,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {supabase} from '../lib/supabase';
import {friendlyError} from '../lib/db-errors';
import {ALL_CATEGORIES,EXPORT_CATEGORIES,EXPORT_ERRORS,buildDataExport,collectMyData,exportSummary,type DataExport,type ExportCategory} from '../lib/data-export';
const purple='#AE16C7';
const ICONS:Record<ExportCategory,React.ComponentProps<typeof Ionicons>['name']>={account:'person-circle-outline',friends:'people-outline',chats:'chatbubbles-outline',stories:'albums-outline',memories:'images-outline',location:'location-outline'};

/** Save the JSON: browser download on web, share sheet (Bewaren in Bestanden, AirDrop, mail …) on iOS/Android. */
async function deliver(result:DataExport){
 const json=JSON.stringify(result.file,null,2);
 if(Platform.OS==='web'){const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=result.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10e3);return}
 const file=new File(Paths.cache,result.filename);file.create({overwrite:true});file.write(json);
 if(!(await Sharing.isAvailableAsync()))throw new Error('Delen is niet beschikbaar op dit toestel.');
 await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json',dialogTitle:'Mijn gegevens bewaren'});
}

/** Snapchat "Mijn gegevens": pick categories, get a JSON copy of your data right away (AVG inzage/overdraagbaarheid). */
export default function MyData(){
 const {session}=useSession(),uid=session?.user.id,insets=useSafeAreaInsets();
 const [chosen,setChosen]=useState<ExportCategory[]>(ALL_CATEGORIES),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState<DataExport|null>(null);
 const toggle=(k:ExportCategory)=>{setDone(null);setError('');setChosen(c=>c.includes(k)?c.filter(x=>x!==k):[...c,k])};
 const all=chosen.length===ALL_CATEGORIES.length;
 async function run(){
  if(!uid){setError(EXPORT_ERRORS.signedOut);return}if(!chosen.length){setError(EXPORT_ERRORS.none);return}
  setBusy(true);setError('');setDone(null);
  try{const source=await collectMyData(supabase,uid,chosen);const result=buildDataExport({uid,email:session?.user.email,now:new Date(),categories:chosen,source});await deliver(result);setDone(result)}
  catch(e){setError(friendlyError(e,'Gegevens downloaden'))}finally{setBusy(false)}
 }
 return <GalaxyScreen><View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={()=>router.back()} accessibilityLabel="Terug"><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title}>Mijn gegevens</Text><View style={{width:27}}/></View>
 <ScrollView contentContainerStyle={s.content}>
  <View style={s.intro}><Ionicons name="download-outline" size={26} color="#E7C8F2"/><Text style={s.introText}>Download een kopie van wat Snapshot X over jou bewaart. Kies wat je wilt ontvangen; je krijgt meteen een bestand (JSON) dat je kunt bewaren of delen.</Text></View>
  <View style={s.sectionRow}><Text style={s.section}>Wat wil je downloaden?</Text><Pressable onPress={()=>{setDone(null);setError('');setChosen(all?[]:ALL_CATEGORIES)}} testID="my-data-all"><Text style={s.all}>{all?'Niets selecteren':'Alles selecteren'}</Text></Pressable></View>
  {EXPORT_CATEGORIES.map(c=>{const on=chosen.includes(c.key);return <Pressable key={c.key} style={[s.row,on&&s.rowOn]} onPress={()=>toggle(c.key)} accessibilityRole="checkbox" accessibilityState={{checked:on}} testID={`my-data-${c.key}`}><Ionicons name={ICONS[c.key]} size={21} color="#DDC9EB"/><View style={s.rowBody}><Text style={s.rowText}>{c.label}</Text><Text style={s.description}>{c.description}</Text></View><Ionicons name={on?'checkmark-circle':'ellipse-outline'} size={25} color={on?purple:'#8E879E'}/></Pressable>})}
  {!!error&&<Text style={s.error} testID="my-data-error">{error}</Text>}
  <Pressable style={[s.button,(busy||!chosen.length)&&s.buttonOff]} disabled={busy} onPress={()=>void run()} testID="my-data-download">{busy?<ActivityIndicator color="white"/>:<><Ionicons name="cloud-download-outline" size={20} color="white"/><Text style={s.buttonText}>Gegevens downloaden</Text></>}</Pressable>
  {done&&<View style={s.done} testID="my-data-done"><View style={s.doneHead}><Ionicons name="checkmark-circle" size={24} color="#5BE49B"/><Text style={s.doneTitle}>Je gegevens staan klaar</Text></View><Text style={s.doneText}>{exportSummary(done.counts)}</Text><Text style={s.file}>{done.filename}</Text><Pressable onPress={()=>void deliver(done).catch(e=>setError(friendlyError(e,'Gegevens downloaden')))}><Text style={s.all}>{Platform.OS==='web'?'Opnieuw downloaden':'Opnieuw delen'}</Text></Pressable></View>}
  <Text style={s.foot}>Foto’s en video’s staan in het bestand als verwijzing, niet als bestand. Verlopen chats en verhalen zijn al verwijderd en staan er dus niet in. Wil je alles wissen? Ga naar Instellingen › Account verwijderen.</Text>
 </ScrollView></GalaxyScreen>
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:23,fontWeight:'800'},content:{padding:18,paddingBottom:55},intro:{flexDirection:'row',gap:12,backgroundColor:'#2B253CB8',borderRadius:18,padding:15,alignItems:'flex-start'},introText:{color:'#E8E2ED',fontSize:15,lineHeight:21,flex:1},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:20,marginBottom:8},section:{color:'white',fontSize:18,fontWeight:'800'},all:{color:'#E7A8F5',fontWeight:'700',fontSize:15},row:{minHeight:70,flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:14,backgroundColor:'#1A142599',borderRadius:14,marginBottom:6,borderWidth:1,borderColor:'transparent'},rowOn:{borderColor:'#AE16C766'},rowBody:{flex:1},rowText:{color:'#E8E2ED',fontSize:17},description:{color:'#AAA6B5',fontSize:13,marginTop:4},error:{color:'#FF8A8A',marginTop:12},button:{marginTop:18,backgroundColor:purple,borderRadius:26,height:52,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center'},buttonOff:{opacity:0.55},buttonText:{color:'white',fontWeight:'800',fontSize:16},done:{marginTop:18,backgroundColor:'#16291FCC',borderRadius:16,padding:15,gap:6,borderWidth:1,borderColor:'#5BE49B55'},doneHead:{flexDirection:'row',alignItems:'center',gap:8},doneTitle:{color:'white',fontSize:17,fontWeight:'800'},doneText:{color:'#DDEFE4',fontSize:15},file:{color:'#AAA6B5',fontSize:13},foot:{color:'#8E879E',fontSize:13,lineHeight:18,marginTop:22}});
