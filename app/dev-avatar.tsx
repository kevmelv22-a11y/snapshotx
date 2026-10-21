import React from 'react';
import {ScrollView,StyleSheet,Text,View} from 'react-native';
import {Stack,useLocalSearchParams} from 'expo-router';
import Svg,{Circle,Defs,LinearGradient,Path,Rect,Stop} from 'react-native-svg';
import {C} from '../lib/theme';
import type {Message} from '../lib/types';
import {applyLook,DEFAULT_OUTFIT,type Outfit} from '../lib/avatar/outfit';
import {MODE_HERO_ITEMS} from '../lib/avatar/modeLooks';
import {AVATAR_POSES,AVATAR_STICKERS,chatStickerBody,editorToken,stickerFromChatBody} from '../lib/avatar/poses';
import {computeStreak} from '../lib/chat-features';
import {PosedAvatar,AvatarStickerArt,BUST_VIEWBOX} from '../components/avatar/PosedAvatar';
import {AvatarStoryRing} from '../components/avatar/AvatarStoryRing';
import {ChatAvatarSticker} from '../components/avatar/AvatarStickerSheet';
import {FriendAvatar} from '../components/avatar/FriendAvatar';
import {PosePicker} from '../components/avatar/PosePicker';
import {ModeScreen} from '../components/avatar/ModeScreen';
import {ProfileHome,YellowAvatarCircle} from '../components/profile/ProfileHome';
import {ChatHeaderBar,ChatView} from '../components/chat/ChatView';
import {SnapEditorLayers,SnapEditorTools,useSnapEditor} from '../components/SnapEditor';
import {AvatarStickerGallery} from './avatar/stickers';

/** Dev-only harness for roadmap step 8 (avatar) with local mock data. No Supabase.
 *  ?scene=profile|mode|poses|stickers|chat|editor|rings|kastposes  (default poses). */
const ME:Outfit={...applyLook({...DEFAULT_OUTFIT,hairStyle:'curly'},MODE_HERO_ITEMS),colors:{hair:'#4A2C1C',skin:'#D29468'}};
const ARIA:Outfit={...applyLook(DEFAULT_OUTFIT,{top:'top-trivo-heart-tee',outerwear:null,bottom:'bottom-rossano-plaid-skirt',shoes:'shoes-klompz-pink'}),hairStyle:'long',colors:{hair:'#D9B35F',skin:'#F3CDB0'}};
const NOOR:Outfit={...applyLook(DEFAULT_OUTFIT,{top:'top-nike-black-tee',outerwear:null,hat:'hat-nike-cap',bottom:'bottom-blueberry-jeans'}),hairStyle:'wavy',colors:{hair:'#B4532A'}};
const LIEN:Outfit={...applyLook(DEFAULT_OUTFIT,{top:'top-rossano-silk-shirt',outerwear:null,bottom:'bottom-strideon-black-cargo'}),hairStyle:'long',colors:{hair:'#1E1A19',skin:'#C47E55'}};
const SEM:Outfit={...applyLook(DEFAULT_OUTFIT,{top:'top-strideon-neon-tee',outerwear:'outer-trivo-track-jacket'}),hairStyle:'afro',colors:{hair:'#1E1A19',skin:'#74432A'}};
const noop=()=>{};

export default function DevAvatar(){
  const {scene='poses'}=useLocalSearchParams<{scene?:string}>();
  if(!__DEV__)return null;
  return <View style={{flex:1,backgroundColor:C.bg}}><Stack.Screen options={{headerShown:false}}/>
    {scene==='profile'?<ProfileHome username="kv.savage" score={84732} ownOutfit={ME} storyCount={0} sharingLocation
      hero={<YellowAvatarCircle size={230}><PosedAvatar outfit={ME} pose="stand" width={230} height={230} viewBox={BUST_VIEWBOX}/></YellowAvatarCircle>}
      friends={[{id:'aria',name:'Aria',outfit:ARIA,ring:'unseen'},{id:'lien',name:'Lien',outfit:LIEN,ring:'seen'},{id:'noor',name:'Noor',outfit:NOOR,ring:'unseen'},{id:'sem',name:'Sem',outfit:SEM}]}
      onMenu={noop} onSettings={noop} onAvatar={noop} onStory={noop} onFriends={noop} onMap={noop} onTimers={noop}/>
    :scene==='mode'?<ModeScreen outfit={ME} selectedLook={null} onPickLook={noop} onMore={noop} onClose={noop} onTab={noop}/>
    :scene==='stickers'?<AvatarStickerGallery outfit={ME}/>
    :scene==='chat'?<DevChat/>
    :scene==='editor'?<DevEditor/>
    :scene==='rings'?<Rings/>
    :scene==='kastposes'?<View style={{flex:1,backgroundColor:'#1C1C1E',padding:12}}><PosePicker outfit={ME} value="wave" onChange={noop} showStickerLink/></View>
    :<Poses/>}
  </View>;
}

function Poses(){return <ScrollView contentContainerStyle={{flexDirection:'row',flexWrap:'wrap',gap:8,padding:10}}>{AVATAR_POSES.map(p=><View key={p.id} style={st.cell}><PosedAvatar outfit={ME} pose={p.id} width={115} height={220}/><Text style={st.lbl}>{p.label}</Text></View>)}</ScrollView>}

function Rings(){const fr:[string,Outfit,'unseen'|'seen'|'none'][]=[['Aria',ARIA,'unseen'],['Lien',LIEN,'seen'],['Noor',NOOR,'unseen'],['Sem',SEM,'none']];
  return <View style={{padding:16}}><Text style={st.h}>Stories (story-ringen met avatar)</Text><View style={{flexDirection:'row',gap:14}}>{fr.map(([n,o,r])=><View key={n} style={{alignItems:'center'}}><AvatarStoryRing outfit={o} state={r} size={76}/><Text style={[st.lbl,{color:C.text}]}>{n}</Text><Text style={st.sub}>{r==='unseen'?'nieuw':r==='seen'?'bekeken':'geen story'}</Text></View>)}</View></View>}

function DevChat(){
  const now=Date.parse('2026-10-13T12:00:00Z'),at=(m:number)=>new Date(now-m*60000).toISOString();
  const msg=(id:string,sender:string,body:string,m:number):Message=>({id,thread_id:'demo',sender_id:sender,kind:'text',body,media_path:null,view_once:false,expires_at:null,created_at:at(m)});
  const rows=[msg('m4','me',chatStickerBody('top'),1),msg('m3','aria',chatStickerBody('haha'),2),msg('m2','me','Zaterdag naar het strand?',5),msg('m1','aria',chatStickerBody('hoi'),7)];
  return <View style={{flex:1}}><ChatHeaderBar title="Aria" streak={computeStreak([],'me','aria',now,120)} retention="24h" onRetention={noop} onCall={noop} avatar={<FriendAvatar id="aria" outfit={ARIA} size={34} name="Aria"/>}/>
    <ChatView rows={rows} me="me" reactions={[]} retention="24h" viewedAt={{}} now={now} streak={computeStreak([],'me','aria',now,120)} typing={null} onReact={noop}
      renderContent={(m)=>{const s=stickerFromChatBody(m.body);return s?<ChatAvatarSticker sticker={s} outfit={m.sender_id==='me'?ME:ARIA}/>:<Text style={{color:C.text,fontSize:16}}>{m.body}</Text>}}/>
    <View style={{flexDirection:'row',alignItems:'center',backgroundColor:C.surface,padding:12}}><Text style={{fontSize:24,color:C.yellow}}>＋</Text><View style={{flex:1,backgroundColor:C.elevated,borderRadius:20,padding:12,marginHorizontal:8}}><Text style={{color:C.muted}}>Bericht…</Text></View><Text style={{fontSize:24,color:C.yellow}}>☺  🎙  ➤</Text></View>
  </View>}

function DevEditor(){
  const ed=useSnapEditor({tool:'sticker',avatarOutfit:ME,stickers:[{id:'a1',emoji:editorToken('hoi'),x:120,y:200,scale:1.3,rotation:-0.15},{id:'a2',emoji:editorToken('yes'),x:280,y:330,scale:1,rotation:0.12}]});
  return <View style={{flex:1}}><Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
    <Defs><LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#3a1c71"/><Stop offset="0.5" stopColor="#d76d77"/><Stop offset="1" stopColor="#ffaf7b"/></LinearGradient></Defs>
    <Rect width="390" height="844" fill="url(#sky)"/><Circle cx="195" cy="470" r="70" fill="#ffd166"/><Path d="M0 680 Q195 640 390 680 L390 844 L0 844 Z" fill="#e9c46a"/></Svg>
    <SnapEditorLayers ed={ed}/><SnapEditorTools ed={ed} top={20}/></View>}

const st=StyleSheet.create({cell:{width:120,alignItems:'center',backgroundColor:'#FFE11A',borderRadius:14,paddingVertical:6},lbl:{color:'#111',fontWeight:'800',fontSize:12},h:{color:C.text,fontSize:18,fontWeight:'900',marginBottom:12},sub:{color:C.muted,fontSize:11}});
void AVATAR_STICKERS;void AvatarStickerArt;
