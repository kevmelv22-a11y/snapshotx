import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {Stack,useLocalSearchParams} from 'expo-router';
import {StoryViewer,type ViewerStory} from '../components/stories/StoryViewer';
import {StoryRing} from '../components/stories/StoryRing';
import {expiresAtFor,groupStories,ringState,viewersFor} from '../lib/stories';

/** Dev-only harness for step 5 stories with mock data (no Supabase). ?scene=rings|viewer|paused|viewers|reply */
const NOW=Date.parse('2026-10-13T12:00:00Z'),H=3600000,ME='me';
const COLORS:Record<string,string>={me:'#3A1C71',aria:'#D76D77',bram:'#1D976C',cas:'#2F80ED',dewi:'#F2994A',old:'#555'};
const mk=(id:string,owner:string,hAgo:number,caption:string|null):ViewerStory=>({id,owner_id:owner,media_type:'photo',media_path:'mock',caption,created_at:new Date(NOW-hAgo*H).toISOString(),expires_at:expiresAtFor(NOW-hAgo*H)});
const STORIES=[mk('m1',ME,3,'Koffie op het terras ☕'),mk('m2',ME,1,'Zonsondergang 🌅'),mk('a1',ARIA(),5,'Festival!'),mk('a2',ARIA(),2,null),mk('a3',ARIA(),0.4,'Nog even dansen 💃'),mk('b1','bram',8,'Fietstocht 🚲'),mk('c1','cas',4,'Nieuwe sneakers'),mk('d1','dewi',12,'Strand 🏖️'),mk('x1','old',26,'verlopen')];
function ARIA(){return 'aria'}
const NAMES:Record<string,string>={me:'Kevin',aria:'Aria',bram:'Bram',cas:'Cas',dewi:'Dewi',v1:'Lotte',v2:'Sem',v3:'Noor',v4:'Finn',v5:'Yara'};
const SEEN=new Set(['c1','a1']);
const VIEWS=['v1','v2','v3','v4','v5'].map((v,i)=>({story_id:'m2',viewer_id:v,viewed_at:new Date(NOW-(i*9+2)*60000).toISOString()}));
const REACTIONS=[{story_id:'m2',user_id:'v2',emoji:'😍'},{story_id:'m2',user_id:'v4',emoji:'🔥'}];
const media=(s:ViewerStory)=><View style={[StyleSheet.absoluteFill,{backgroundColor:COLORS[s.owner_id],alignItems:'center',justifyContent:'center'}]}><Text style={{fontSize:90}}>{{m1:'☕',m2:'🌅',a1:'🎶',a2:'🌃',a3:'💃',b1:'🚲',c1:'👟',d1:'🏖️'}[s.id]}</Text><Text style={{color:'#FFFFFF88',marginTop:12}}>mock-foto {s.id}</Text></View>;
export default function DevStories(){
 const {scene='rings'}=useLocalSearchParams<{scene?:string}>();
 const groups=groupStories(STORIES,SEEN,NOW,ME);
 const now=()=>NOW;
 if(scene==='rings')return <View style={s.root}><Stack.Screen options={{title:'Dev: verhalen'}}/><Text style={s.h}>Verhalen</Text><View style={{gap:14,padding:14,flexDirection:'row',flexWrap:'wrap',width:'100%'}}>{groups.map(g=><View key={g.ownerId} style={{alignItems:'center',width:96}}><StoryRing state={ringState(g)} size={78}><View style={[s.av,{backgroundColor:COLORS[g.ownerId]}]}><Text style={s.avT}>{NAMES[g.ownerId][0]}</Text></View></StoryRing><Text style={s.n}>{g.ownerId===ME?'Mijn verhaal':NAMES[g.ownerId]}</Text><Text style={s.m}>{g.stories.length} · {ringState(g)==='unseen'?'nieuw':'bekeken'}</Text></View>)}<View style={{alignItems:'center',width:96}}><StoryRing state={ringState(undefined)} size={78}><View style={[s.av,{backgroundColor:'#444'}]}><Text style={s.avT}>E</Text></View></StoryRing><Text style={s.n}>Emma</Text><Text style={s.m}>geen verhaal</Text></View></View><Text style={s.m2}>Paars = nieuw, grijs = bekeken, geen ring = geen verhaal. Verlopen (&gt;24 u) verhaal van "old" is weggefilterd.</Text></View>;
 const own=scene==='viewers';const gi=own?0:groups.findIndex(g=>g.ownerId==='aria');
 return <View style={{flex:1}}><Stack.Screen options={{headerShown:false}}/><StoryViewer key={scene} groups={groups} initialGroup={gi} seen={own?new Set(['m1']):SEEN} meId={ME} names={NAMES} now={now} renderMedia={media} onClose={()=>{}}
  initialPaused={scene!=='viewer'} initialProgress={scene==='viewer'?0:0.45} initialViewersOpen={own} initialReplyOpen={scene==='reply'}
  loadViewers={async st=>viewersFor(st.id,VIEWS,REACTIONS,ME)} onReply={async()=>null}/></View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#120D1C',paddingTop:30},h:{color:'white',fontSize:26,fontWeight:'900',marginLeft:16},av:{width:78,height:78,borderRadius:39,alignItems:'center',justifyContent:'center'},avT:{color:'white',fontSize:30,fontWeight:'900'},n:{color:'white',fontWeight:'700',marginTop:6},m:{color:'#AAA',fontSize:12},m2:{color:'#CCC',margin:16}});
