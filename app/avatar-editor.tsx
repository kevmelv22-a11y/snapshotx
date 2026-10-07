import React, {useState} from 'react';
import {Alert,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MapExplorer} from '../components/MapAvatar';
import {SizedFigure} from '../components/avatar/OwnAvatar';
import {avatarOptions,defaultAvatar,readAvatarAppearance,type AvatarAppearance} from '../lib/avatar';
import {APPEARANCE_FIELDS,isAppearanceField,mergeAppearance,outfitMatchesAppearance,type AppearanceField} from '../lib/avatar/appearance';
import type {Outfit} from '../lib/avatar/outfit';
import {supabase} from '../lib/supabase';
import {useSession} from '../hooks/useSession';
import {useOwnOutfit} from '../hooks/useWardrobeSync';
import {useWardrobe} from '../stores/wardrobe';

type Category=keyof AvatarAppearance;
type Mode='mode'|'kast'|'avatar';
const modeCategories:Category[]=['top','bottoms','shoes','accessory'];
const faceCategories:Category[]=['skin','hair','hairstyle'];
const categoryTitle:Record<Category,string>={skin:'Huidskleur',hair:'Haarkleur',hairstyle:'Kapsel',top:'Bovenkleding',bottoms:'Broeken en rokken',shoes:'Schoenen',accessory:'Accessoires'};
/** Undo/redo entry: the classic appearance plus which appearance fields were picked in this session. */
type Step={a:AvatarAppearance;touched:AppearanceField[]};
const touch=(touched:AppearanceField[],fields:readonly AppearanceField[])=>[...new Set([...touched,...fields])];

/** Preview figure: the saved Bitmoji-kast outfit with the touched classic appearance fields on top, else the classic art. */
function Figure({uid,outfit,appearance,touched,size,own=false}:{uid:string|undefined;outfit:Outfit|null;appearance:AvatarAppearance;touched:readonly AppearanceField[];size:number;own?:boolean}){
  if(outfit)return <SizedFigure outfit={mergeAppearance(outfit,appearance,touched)} width={size}/>;
  return <MapExplorer id={uid||'me'} appearance={appearance} size={size} own={own}/>;
}

const icons:Record<Category,React.ComponentProps<typeof Ionicons>['name']>={skin:'happy-outline',hair:'color-palette-outline',hairstyle:'cut-outline',top:'shirt-outline',bottoms:'options-outline',shoes:'walk-outline',accessory:'sparkles-outline'};

export default function AvatarEditor(){
  const {session}=useSession();
  const uid=session?.user.id;
  const insets=useSafeAreaInsets();
  const {height}=useWindowDimensions();
  // Saved Bitmoji-kast outfit (null = none): clothes come from it, this editor only adds skin/hair/hairstyle.
  const outfit=useOwnOutfit(uid);
  const [mode,setMode]=useState<Mode>(()=>outfit?'avatar':'mode');
  const [category,setCategory]=useState<Category>(()=>outfit?'skin':'top');
  const [draft,setDraft]=useState<AvatarAppearance>(()=>readAvatarAppearance(session?.user.user_metadata?.snaplion_avatar));
  // Appearance fields picked in this session; only these override the outfit (an untouched field keeps the kast value).
  const [touched,setTouched]=useState<AppearanceField[]>([]);
  const [history,setHistory]=useState<Step[]>([]);
  const [future,setFuture]=useState<Step[]>([]);
  const [looks,setLooks]=useState<AvatarAppearance[]>(()=>{
    const saved=session?.user.user_metadata?.snaplion_wardrobe;
    return Array.isArray(saved)?saved.slice(0,12).map(readAvatarAppearance):[];
  });
  const [reverse,setReverse]=useState(false);
  const [onlySelected,setOnlySelected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');

  function change(next:AvatarAppearance,fields:readonly AppearanceField[]=[]){
    const nextTouched=touch(touched,fields);
    if(JSON.stringify(next)===JSON.stringify(draft)&&nextTouched.length===touched.length)return;
    setHistory(previous=>[...previous.slice(-19),{a:draft,touched}]);
    setFuture([]);
    setDraft(next);setTouched(nextTouched);
  }
  function undo(){if(!history.length)return;const previous=history[history.length-1];setHistory(history.slice(0,-1));setFuture(v=>[...v,{a:draft,touched}]);setDraft(previous.a);setTouched(previous.touched)}
  function redo(){if(!future.length)return;const next=future[future.length-1];setFuture(future.slice(0,-1));setHistory(v=>[...v,{a:draft,touched}]);setDraft(next.a);setTouched(next.touched)}
  async function save(close=true,wardrobe=looks){
    if(!uid||busy)return;
    setBusy(true);
    const {error}=await supabase.auth.updateUser({data:{snaplion_avatar:draft,snaplion_wardrobe:wardrobe}});
    setBusy(false);
    if(error)setNotice(`Opslaan mislukt: ${error.message}`);
    else {
      // Keep the own avatar consistent: touched skin/hair/hairstyle go into the saved kast outfit (latest edit wins).
      if(close&&touched.length)useWardrobe.getState().applyAppearance(uid,draft,touched);
      setLooks(wardrobe);if(close)router.back();else setNotice('Look opgeslagen in je kast.');}
  }
  function discard(){
    const original=readAvatarAppearance(session?.user.user_metadata?.snaplion_avatar);
    if(JSON.stringify(original)===JSON.stringify(draft)&&!touched.length){router.back();return}
    Alert.alert('Wijzigingen weggooien?','Je avatar is nog niet opgeslagen.',[
      {text:'Verder bewerken',style:'cancel'},
      {text:'Weggooien',style:'destructive',onPress:()=>router.back()},
    ]);
  }
  function saveLook(){
    const next=[draft,...looks.filter(look=>JSON.stringify(look)!==JSON.stringify(draft))].slice(0,12);
    void save(false,next);
  }

  const categories=mode==='avatar'?faceCategories:modeCategories;
  const options=avatarOptions[category];
  const order=Array.from(options.keys());
  if(reverse)order.reverse();
  const displayed=onlySelected?order.filter(index=>index===draft[category]):order;

  return <View style={s.root}>
    <View style={[s.stage,{paddingTop:insets.top+10}]}>
      <View style={s.topbar}>
        <Pressable style={s.close} onPress={discard} accessibilityLabel="Editor sluiten"><Ionicons name="close" size={28} color="#fff"/></Pressable>
        <Text style={s.brand}>SNAPLION</Text>
        <Pressable style={s.save} onPress={()=>void save()} disabled={busy} accessibilityLabel="Avatar opslaan"><Text style={s.saveText}>{busy?'Opslaan…':'Opslaan'}</Text></Pressable>
      </View>
      <View style={s.preview}>
        <View style={s.heroAvatar}><Figure uid={uid} outfit={outfit} appearance={draft} touched={touched} size={Math.min(175,Math.max(125,(height-insets.top-insets.bottom)*0.2))} own/></View>
        <Text style={s.previewCaption}>{outfit?'Jouw avatar · outfit uit je Bitmoji-kast':'Jouw avatar · past direct mee aan'}</Text>
      </View>
      <View style={s.history}>
        <Pressable style={[s.historyButton,!history.length&&s.disabled]} onPress={undo} disabled={!history.length} accessibilityLabel="Ongedaan maken"><Ionicons name="arrow-undo" size={26} color="#fff"/></Pressable>
        <Pressable style={[s.historyButton,!future.length&&s.disabled]} onPress={redo} disabled={!future.length} accessibilityLabel="Opnieuw uitvoeren"><Ionicons name="arrow-redo" size={26} color="#fff"/></Pressable>
      </View>
    </View>
    <View style={[s.sheet,{paddingBottom:Math.max(insets.bottom,12)}]}>
      <View style={s.handle}/>
      <View style={s.tabs}>
        {([['mode','Mode','shirt-outline'],['kast','Kast','heart-outline'],['avatar','Avatar','person-circle-outline']] as const).map(([id,label,icon])=><Pressable key={id} style={[s.tab,mode===id&&s.tabActive]} onPress={()=>{setMode(id);if(id==='avatar')setCategory('skin');if(id==='mode')setCategory('top')}} accessibilityLabel={label}><Ionicons name={icon} size={24} color={mode===id?'#211C2A':'#73707D'}/><Text style={[s.tabText,mode===id&&s.tabTextActive]}>{label}</Text></Pressable>)}
      </View>
      {mode==='kast'?<ScrollView contentContainerStyle={s.catalog}>
        <Text style={s.sectionTitle}>Mijn opgeslagen looks</Text>
        <Pressable style={s.wardrobeSave} onPress={saveLook} disabled={busy}><Ionicons name="bookmark-outline" color="#fff" size={20}/><Text style={s.wardrobeText}>Huidige look bewaren</Text></Pressable>
        {!looks.length&&<Text style={s.empty}>Nog geen looks bewaard. Pas je avatar aan en bewaar je eerste look.</Text>}
        <View style={s.grid}>{looks.map((look,index)=><Pressable key={index} style={s.card} onPress={()=>change(look,APPEARANCE_FIELDS)} accessibilityLabel={`Opgeslagen look ${index+1} aantrekken`}><Figure uid={uid} outfit={outfit} appearance={look} touched={APPEARANCE_FIELDS} size={75}/><Text style={s.cardLabel}>Look {index+1}</Text></Pressable>)}</View>
      </ScrollView>:mode==='mode'&&outfit?<ScrollView contentContainerStyle={s.catalog}>
        <View style={s.kastInfo}>
          <Ionicons name="shirt-outline" size={26} color="#69368C"/>
          <Text style={s.kastTitle}>Je kleding komt uit je Bitmoji-kast</Text>
          <Text style={s.kastBody}>Je hebt een outfit opgeslagen in de kast, dus die kleren zie je overal op je avatar. Huidskleur, haarkleur en kapsel pas je hier aan bij Avatar; die wijzigingen komen ook op je kast-avatar.</Text>
          <Pressable style={s.wardrobeSave} onPress={()=>router.push('/avatar/kast')} accessibilityLabel="Open de Bitmoji-kast"><Ionicons name="shirt" color="#fff" size={18}/><Text style={s.wardrobeText}>Open de kast</Text></Pressable>
        </View>
      </ScrollView>:<>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryBar}>
          {categories.map(id=><Pressable key={id} style={[s.category,category===id&&s.categoryActive]} onPress={()=>{setCategory(id);setOnlySelected(false)}} accessibilityLabel={categoryTitle[id]}><Ionicons name={icons[id]} size={22} color={category===id?'#221E2B':'#9A97A3'}/><Text style={s.categoryText}>{categoryTitle[id]}</Text></Pressable>)}
        </ScrollView>
        <View style={s.toolbar}>
          <Pressable style={s.tool} onPress={()=>change({...draft,[category]:defaultAvatar[category]},isAppearanceField(category)?[category]:[])}><Text style={s.toolText}>Standaard</Text></Pressable>
          <Pressable style={s.tool} onPress={()=>setReverse(v=>!v)}><Ionicons name="swap-vertical" size={18} color="#45404E"/><Text style={s.toolText}>Sorteren</Text></Pressable>
          <Pressable style={[s.tool,onlySelected&&s.toolActive]} onPress={()=>setOnlySelected(v=>!v)}><Ionicons name="options-outline" size={18} color="#45404E"/><Text style={s.toolText}>Filter</Text></Pressable>
        </View>
        <Text style={s.sectionTitle}>{categoryTitle[category]}</Text>
        <ScrollView contentContainerStyle={s.catalog}>
          <View style={s.grid}>{displayed.map(index=>{
            const look={...draft,[category]:index};
            const field=isAppearanceField(category)?category:null;
            // With a kast outfit, an untouched field shows what the outfit has (it may be a kast-only colour/style).
            const picked=outfit&&field&&!touched.includes(field)?outfitMatchesAppearance(outfit,field,index):index===draft[category];
            return <Pressable key={index} style={[s.card,picked&&s.cardSelected]} onPress={()=>change(look,field?[field]:[])} accessibilityLabel={`${options[index]} kiezen`}><Figure uid={uid} outfit={outfit} appearance={look} touched={field?touch(touched,[field]):touched} size={70}/><Text style={s.cardLabel} numberOfLines={2}>{options[index]}</Text>{picked&&<Ionicons name="checkmark-circle" color="#8F39B5" size={20} style={s.check}/>}</Pressable>;
          })}</View>
        </ScrollView>
      </>}
      {!!notice&&<Pressable onPress={()=>setNotice('')} style={s.notice}><Text style={s.noticeText}>{notice} ×</Text></Pressable>}
    </View>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:'#EDEAF4'},stage:{flex:1,minHeight:250,backgroundColor:'#D9D6E4'},topbar:{height:54,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},close:{width:46,height:46,borderRadius:23,backgroundColor:'#777585',justifyContent:'center',alignItems:'center'},brand:{fontSize:16,color:'#332640',fontWeight:'900',letterSpacing:1},save:{backgroundColor:'#fff',borderRadius:25,paddingHorizontal:20,paddingVertical:10},saveText:{color:'#282430',fontSize:15,fontWeight:'800'},preview:{flex:1,alignItems:'center',justifyContent:'center',paddingTop:2},heroAvatar:{width:'76%',maxWidth:290,height:250,alignItems:'center',justifyContent:'center'},previewCaption:{position:'absolute',left:15,bottom:12,color:'#5E5A66',fontSize:9,fontWeight:'700'},history:{flexDirection:'row',gap:5,margin:12},historyButton:{height:40,width:40,borderRadius:20,backgroundColor:'#898692',alignItems:'center',justifyContent:'center'},disabled:{opacity:0.4},sheet:{height:'51%',minHeight:330,borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:'#FAFAFC',overflow:'hidden'},handle:{height:5,width:50,backgroundColor:'#DCDDE1',borderRadius:3,alignSelf:'center',marginVertical:8},tabs:{height:65,flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#E2E2E8'},tab:{flex:1,alignItems:'center',justifyContent:'center',gap:2},tabActive:{borderBottomWidth:3,borderBottomColor:'#33213D'},tabText:{color:'#777481',fontSize:13,fontWeight:'700'},tabTextActive:{color:'#24202A'},categoryBar:{height:65,alignItems:'center',paddingHorizontal:10,gap:9},category:{minWidth:95,alignItems:'center',gap:3,paddingHorizontal:8,paddingVertical:7,borderBottomWidth:2,borderBottomColor:'transparent'},categoryActive:{borderBottomColor:'#2F2936'},categoryText:{color:'#57525F',fontSize:11,fontWeight:'700'},toolbar:{flexDirection:'row',paddingHorizontal:10,gap:7},tool:{flex:1,height:35,borderRadius:20,backgroundColor:'#ECECF0',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3},toolActive:{backgroundColor:'#E6CEF1'},toolText:{fontSize:12,fontWeight:'700',color:'#45404E'},sectionTitle:{fontSize:17,fontWeight:'900',color:'#24202A',marginHorizontal:16,marginTop:10,marginBottom:9},catalog:{paddingBottom:30,paddingHorizontal:13},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},card:{width:'31%',minHeight:150,backgroundColor:'#EEEFF3',borderRadius:15,alignItems:'center',justifyContent:'center',padding:6,borderWidth:2,borderColor:'transparent'},cardSelected:{borderColor:'#AE57DB'},cardLabel:{fontSize:12,fontWeight:'700',color:'#41404A',textAlign:'center',marginTop:3},check:{position:'absolute',top:5,right:5},wardrobeSave:{height:43,backgroundColor:'#69368C',borderRadius:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginVertical:8},wardrobeText:{color:'#fff',fontWeight:'800'},empty:{fontSize:14,color:'#66616E',marginVertical:14},kastInfo:{marginTop:14,padding:16,borderRadius:18,backgroundColor:'#F1E8F6',gap:8},kastTitle:{fontSize:17,fontWeight:'900',color:'#24202A'},kastBody:{fontSize:14,lineHeight:20,color:'#4E4858'},notice:{position:'absolute',bottom:5,left:14,right:14,padding:10,borderRadius:12,backgroundColor:'#3D254B'},noticeText:{color:'#fff',fontSize:12},
});


