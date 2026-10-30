import React,{useMemo,useState} from 'react';
import {Linking,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Constants from 'expo-constants';
import {router,Stack,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GalaxyScreen} from '../components/GalaxyScreen';
import {useSession} from '../hooks/useSession';
import {useOwnProfile} from '../hooks/useOwnProfile';
import {SUPPORT_EMAIL} from '../lib/legal';
import {CRISIS_LINES,HELP_CATEGORIES,SUPPORT_TOPICS,findArticle,searchHelp,supportMailto,type HelpArticle,type SupportTopicId} from '../lib/help-center';

const purple='#AE16C7',PUBLIC_ROUTES=new Set(['/privacy','/voorwaarden']);
type IconName=React.ComponentProps<typeof Ionicons>['name'];

/** Help en support (Snapchat "Ondersteuning"): searchable FAQ, crisis numbers, pre-filled support mail. Works signed out too (public /help). */
export default function Help(){
 const insets=useSafeAreaInsets(),{session}=useSession(),{profile}=useOwnProfile(),params=useLocalSearchParams<{artikel?:string}>();
 const initial=params.artikel?findArticle(String(params.artikel)):null;
 const [query,setQuery]=useState(''),[openCat,setOpenCat]=useState<string|null>(initial?.category.id??null),[openArt,setOpenArt]=useState<string|null>(initial?.article.id??null);
 const [topic,setTopic]=useState<SupportTopicId>('account'),[message,setMessage]=useState(''),[notice,setNotice]=useState('');
 const hits=useMemo(()=>searchHelp(query),[query]);
 const back=()=>router.canGoBack()?router.back():router.replace('/');
 const call=(tel:string,number:string)=>{void Linking.openURL(tel).catch(()=>setNotice(`Bel ${number}`))};
 const mail=()=>{const url=supportMailto({topic,message,handle:profile?.handle||undefined,version:Constants.expoConfig?.version,platform:Platform.OS==='web'?'web':`${Platform.OS} ${String(Platform.Version)}`});void Linking.openURL(url).then(()=>setNotice('Je mail-app is geopend. Verstuur de mail om ons te bereiken.')).catch(()=>setNotice(`Geen mail-app gevonden. Mail ons via ${SUPPORT_EMAIL}`))};
 const article=(a:HelpArticle,catTitle?:string)=>{const open=openArt===a.id,canAct=!!a.action&&(!!session||PUBLIC_ROUTES.has(a.action.route));return <View key={a.id} style={s.article}>
  <Pressable onPress={()=>setOpenArt(open?null:a.id)} style={s.qRow} accessibilityRole="button" accessibilityState={{expanded:open}} testID={`help-q-${a.id}`}><View style={{flex:1}}>{!!catTitle&&<Text style={s.catHint}>{catTitle}</Text>}<Text style={s.q}>{a.q}</Text></View><Ionicons name={open?'chevron-up':'chevron-down'} size={18} color="#AAA4B4"/></Pressable>
  {open&&<View style={s.answer} testID={`help-a-${a.id}`}>{a.a.map((p,i)=><Text key={i} style={s.aText}>{p}</Text>)}{canAct&&a.action&&<Pressable style={s.action} onPress={()=>router.push(a.action!.route as never)}><Text style={s.actionText}>{a.action.label}</Text><Ionicons name="arrow-forward" size={15} color="white"/></Pressable>}</View>}
 </View>};
 return <GalaxyScreen><Stack.Screen options={{headerShown:false,title:'Help'}}/>
  <View style={[s.header,{marginTop:Math.max(insets.top,14)}]}><Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Terug" hitSlop={10}><Ionicons name="chevron-back" color="white" size={27}/></Pressable><Text style={s.title} accessibilityRole="header">Help en support</Text><View style={{width:27}}/></View>
  <ScrollView contentContainerStyle={[s.content,{paddingBottom:Math.max(insets.bottom,20)+40}]} keyboardShouldPersistTaps="handled" testID="help-screen">
   <View style={s.search}><Ionicons name="search" size={20} color="#DDD1E9"/><TextInput value={query} onChangeText={setQuery} placeholder="Waar heb je hulp bij nodig?" placeholderTextColor="#ABA5B5" style={s.input} testID="help-search"/>{!!query&&<Pressable onPress={()=>setQuery('')} accessibilityLabel="Wissen"><Ionicons name="close-circle" size={20} color="#BEB7C6"/></Pressable>}</View>
   {query.trim()?<View>{hits.length?<><Text style={s.section}>{hits.length===1?'1 resultaat':`${hits.length} resultaten`}</Text>{hits.map(h=>article(h.article,h.category.title))}</>:<Text style={s.empty}>Niets gevonden. Probeer een ander woord of neem hieronder contact met ons op.</Text>}</View>:<>
    <View style={s.crisis} testID="help-crisis"><View style={s.crisisHead}><Ionicons name="heart" size={20} color="#FF7AA8"/><Text style={s.crisisTitle}>Ben je in gevaar of gaat het niet goed?</Text></View><Text style={s.crisisText}>Je hoeft het niet alleen te doen. Bel of chat gratis en anoniem.</Text><View style={s.lines}>{CRISIS_LINES.map(l=><Pressable key={l.number} style={s.line} onPress={()=>call(l.tel,l.number)} accessibilityRole="button" accessibilityLabel={`${l.label}: bel ${l.number}`}><Text style={s.lineNum}>{l.number}</Text><Text style={s.lineLabel}>{l.label}</Text></Pressable>)}</View></View>
    <Text style={s.section}>Onderwerpen</Text>
    {HELP_CATEGORIES.map(c=>{const open=openCat===c.id;return <View key={c.id} style={s.cat}><Pressable style={s.catRow} onPress={()=>{setOpenCat(open?null:c.id);setOpenArt(null)}} accessibilityRole="button" accessibilityState={{expanded:open}} testID={`help-cat-${c.id}`}><Ionicons name={c.icon as IconName} size={21} color="#DDC9EB"/><Text style={s.catTitle}>{c.title}</Text><Text style={s.count}>{c.articles.length}</Text><Ionicons name={open?'chevron-up':'chevron-forward'} size={19} color="#AAA4B4"/></Pressable>{open&&<View style={s.catBody}>{c.articles.map(a=>article(a))}</View>}</View>})}
   </>}
   <Text style={s.section}>Contact opnemen</Text>
   <View style={s.contact} testID="help-contact"><Text style={s.contactText}>Staat je vraag er niet bij? Kies een onderwerp en stuur ons een mail. We reageren zo snel mogelijk.</Text>
    <View style={s.chips}>{SUPPORT_TOPICS.map(t=><Pressable key={t.id} onPress={()=>setTopic(t.id)} style={[s.chip,topic===t.id&&s.chipOn]} accessibilityRole="radio" accessibilityState={{selected:topic===t.id}}><Text style={[s.chipText,topic===t.id&&s.chipTextOn]}>{t.label}</Text></Pressable>)}</View>
    <TextInput value={message} onChangeText={setMessage} placeholder="Beschrijf je vraag (optioneel)" placeholderTextColor="#ABA5B5" multiline maxLength={1000} style={s.msg} testID="help-message"/>
    <Pressable style={s.send} onPress={mail} accessibilityRole="button" testID="help-send"><Ionicons name="mail" size={18} color="white"/><Text style={s.sendText}>E-mail opstellen</Text></Pressable>
    <Text style={s.addr}>{SUPPORT_EMAIL}</Text>
   </View>
   {!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice}  ×</Text></Pressable>}
   <View style={s.legal}><Pressable onPress={()=>router.push('/privacy')}><Text style={s.legalLink}>Privacybeleid</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={()=>router.push('/voorwaarden')}><Text style={s.legalLink}>Gebruiksvoorwaarden</Text></Pressable></View>
  </ScrollView>
 </GalaxyScreen>;
}
const s=StyleSheet.create({header:{height:52,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:21,fontWeight:'800'},content:{padding:18},
 search:{backgroundColor:'#2B253CB8',height:49,borderRadius:24,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9,marginBottom:14},input:{color:'white',fontSize:16,flex:1},
 section:{color:'white',fontSize:18,fontWeight:'800',marginTop:16,marginBottom:8},empty:{color:'#B8B1BF',marginTop:16,lineHeight:21},
 crisis:{backgroundColor:'#3A1630CC',borderRadius:16,padding:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'#FF7AA866'},crisisHead:{flexDirection:'row',alignItems:'center',gap:8},crisisTitle:{color:'white',fontSize:16,fontWeight:'800',flex:1},crisisText:{color:'#E6D6E2',fontSize:14,marginTop:6},lines:{flexDirection:'row',gap:8,marginTop:10,flexWrap:'wrap'},line:{backgroundColor:'#00000055',borderRadius:12,paddingVertical:8,paddingHorizontal:10,flexGrow:1,minWidth:92},lineNum:{color:'white',fontWeight:'800',fontSize:15},lineLabel:{color:'#D9C7D4',fontSize:12,marginTop:2},
 cat:{backgroundColor:'#1A142599',borderRadius:14,marginBottom:6,borderWidth:StyleSheet.hairlineWidth,borderColor:'#ACA2C74A',overflow:'hidden'},catRow:{minHeight:58,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14},catTitle:{color:'#E8E2ED',fontSize:17,flex:1},count:{color:'#8E879E',fontSize:13},catBody:{paddingHorizontal:8,paddingBottom:8},
 article:{backgroundColor:'#231B30AA',borderRadius:12,marginTop:6},qRow:{flexDirection:'row',alignItems:'center',gap:10,padding:12},catHint:{color:'#B892D0',fontSize:12,marginBottom:2},q:{color:'white',fontSize:15,fontWeight:'700'},answer:{paddingHorizontal:12,paddingBottom:12,gap:6},aText:{color:'#D6D0DE',fontSize:15,lineHeight:21},action:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',backgroundColor:purple,borderRadius:18,paddingHorizontal:14,paddingVertical:8,marginTop:4},actionText:{color:'white',fontWeight:'800'},
 contact:{backgroundColor:'#1A142599',borderRadius:14,padding:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'#ACA2C74A'},contactText:{color:'#D6D0DE',fontSize:15,lineHeight:21},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},chip:{borderRadius:16,paddingHorizontal:11,paddingVertical:7,backgroundColor:'#2B253C'},chipOn:{backgroundColor:purple},chipText:{color:'#D6D0DE',fontSize:13},chipTextOn:{color:'white',fontWeight:'800'},
 msg:{backgroundColor:'#272036C7',borderRadius:14,padding:12,color:'white',fontSize:15,minHeight:80,marginTop:10,textAlignVertical:'top'},send:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:purple,borderRadius:22,paddingVertical:12,marginTop:10},sendText:{color:'white',fontWeight:'800',fontSize:16},addr:{color:'#AAA6B5',textAlign:'center',marginTop:8,fontSize:13},
 notice:{backgroundColor:'#322641',borderRadius:14,padding:14,marginTop:14},noticeText:{color:'white'},legal:{flexDirection:'row',justifyContent:'center',gap:8,marginTop:20},legalLink:{color:'#C9B3DD',fontSize:13,textDecorationLine:'underline'},dot:{color:'#8E879E'}});
