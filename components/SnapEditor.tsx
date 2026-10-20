import React,{useRef,useState} from 'react';
import {Pressable,StyleSheet,Switch,Text,TextInput,View,type GestureResponderEvent} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {C} from '../lib/theme';
import {DEFAULT_OUTFIT,type Outfit} from '../lib/avatar/outfit';
import {AVATAR_STICKERS,editorToken,stickerFromEditorToken} from '../lib/avatar/poses';
import {AvatarStickerArt} from './avatar/PosedAvatar';
import {
  BRUSH_COLORS,BRUSH_SIZES,DEFAULT_TIMING,STICKER_BASE_SIZE,STICKER_EMOJI,TEXT_STYLES,TIMER_OPTIONS,
  addSticker,applyGesture,bringToFront,clampUnit,extendStroke,isOverTrash,nextTextStyle,pinchOf,removeSticker,resolveTextStyle,
  sanitizeText,startStroke,strokeToPath,timerLabel,timingSummary,undoStroke,updateSticker,
  type Pinch,type Point,type SnapText,type SnapTiming,type Sticker,type Stroke,
} from '../lib/snap-edit';

export type EditorTool='none'|'draw'|'sticker'|'text'|'timer';
export type SnapEditorState=ReturnType<typeof useSnapEditor>;

/** All editor state for one snap. `timing` is what gets stored on the snap message. */
export function useSnapEditor(initial?:Partial<{strokes:Stroke[];stickers:Sticker[];text:SnapText|null;timing:SnapTiming;tool:EditorTool;/** Outfit used for avatar stickers (default outfit when not given). */avatarOutfit:Outfit|null}>){
  const [tool,setTool]=useState<EditorTool>(initial?.tool??'none');
  const [strokes,setStrokes]=useState<Stroke[]>(initial?.strokes??[]);
  const [color,setColor]=useState<string>(BRUSH_COLORS[2]);
  const [brush,setBrush]=useState<number>(BRUSH_SIZES[1]);
  const [stickers,setStickers]=useState<Sticker[]>(initial?.stickers??[]);
  const [text,setText]=useState<SnapText|null>(initial?.text??null);
  const [timing,setTiming]=useState<SnapTiming>(initial?.timing??DEFAULT_TIMING);
  const [dragging,setDragging]=useState<{id:string;overTrash:boolean}|null>(null);
  const [size,setSize]=useState({width:0,height:0});
  const seq=useRef(0);
  /** Window position of the canvas, so finger positions (pageX/Y) can be mapped to canvas coordinates. */
  const origin=useRef<Point>({x:0,y:0});
  const toggle=(t:EditorTool)=>setTool(v=>v===t?'none':t);
  const addEmoji=(emoji:string)=>{seq.current+=1;setStickers(l=>addSticker(l,emoji,`s${Date.now()}-${seq.current}`,{x:size.width/2,y:size.height*0.4}));setTool('none')};
  return {avatarOutfit:initial?.avatarOutfit??DEFAULT_OUTFIT,tool,setTool,toggle,strokes,setStrokes,color,setColor,brush,setBrush,stickers,setStickers,text,setText,timing,setTiming,dragging,setDragging,size,setSize,origin,addEmoji,
    undo:()=>setStrokes(undoStroke),edit:{strokes,stickers,text,timing}};
}

/** Web: stop the browser from treating pinches/drags on the canvas as page zoom/scroll (no-op on native). */
const NO_BROWSER_GESTURES={touchAction:'none'} as object;
const pt=(t:{pageX:number;pageY:number}):Point=>({x:t.pageX,y:t.pageY});
const trashPos=(size:{width:number;height:number}):Point=>({x:size.width/2,y:size.height-150});
/** Snapchat-style delete: the finger (not the sticker centre) is released over the bin. */
const fingerOverTrash=(e:GestureResponderEvent,ed:{origin:{current:Point};size:{width:number;height:number}})=>{const n=e.nativeEvent;const t=n.touches?.[0]??n.changedTouches?.[0]??n;return isOverTrash({x:t.pageX-ed.origin.current.x,y:t.pageY-ed.origin.current.y},trashPos(ed.size))};

/** Overlay layers. Place inside the ViewShot (on top of the photo/video) so they are baked into the snap. */
export function SnapEditorLayers({ed}:{ed:SnapEditorState}){
  const {strokes,tool,size}=ed;
  const root=useRef<View>(null);
  return <View ref={root} style={[StyleSheet.absoluteFill,{overflow:'hidden'},NO_BROWSER_GESTURES]} onLayout={e=>{ed.setSize({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height});root.current?.measureInWindow((x,y)=>{ed.origin.current={x,y}})}}>
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>{strokes.map((s,i)=><Path key={i} d={strokeToPath(s.points)} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}</Svg>
    {tool==='draw'&&<View testID="draw-surface" style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
      onResponderGrant={e=>{const {locationX:x,locationY:y}=e.nativeEvent;ed.setStrokes(v=>startStroke(v,{x,y},ed.color,ed.brush))}}
      onResponderMove={e=>{const {locationX:x,locationY:y}=e.nativeEvent;ed.setStrokes(v=>extendStroke(v,{x,y}))}}/>}
    <SnapTextLayer ed={ed}/>
    {ed.stickers.map(s=><StickerView key={s.id} sticker={s} ed={ed}/>)}
    {ed.dragging&&<View pointerEvents="none" style={[st.trash,{left:trashPos(size).x-30,top:trashPos(size).y-30},ed.dragging.overTrash&&st.trashHot]}><Text style={st.trashIcon}>🗑</Text></View>}
  </View>;
}

function StickerView({sticker,ed}:{sticker:Sticker;ed:SnapEditorState}){
  const g=useRef<{start:Sticker;from:Pinch|Point;count:number}|null>(null);
  const begin=(e:GestureResponderEvent,cur:Sticker)=>{const t=e.nativeEvent.touches;g.current={start:cur,from:t.length>=2?pinchOf(pt(t[0]),pt(t[1])):pt(t[0]??e.nativeEvent),count:Math.min(2,t.length||1)}};
  const live=ed.stickers.find(x=>x.id===sticker.id)??sticker;
  const active=ed.tool==='none'||ed.tool==='sticker';
  const fs=STICKER_BASE_SIZE;
  return <View testID={`sticker-${sticker.emoji}`} pointerEvents={active?'auto':'none'}
    style={[st.sticker,NO_BROWSER_GESTURES,{left:sticker.x-fs*0.65,top:sticker.y-fs*0.65,width:fs*1.3,height:fs*1.3,transform:[{scale:sticker.scale},{rotate:`${sticker.rotation}rad`}]}]}
    onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true} onResponderTerminationRequest={()=>false}
    onResponderGrant={e=>{ed.setStickers(l=>bringToFront(l,sticker.id));begin(e,live);ed.setDragging({id:sticker.id,overTrash:false})}}
    onResponderMove={e=>{const c=g.current;if(!c)return;const t=e.nativeEvent.touches;const n=Math.min(2,t.length||1);
      if(n!==c.count){begin(e,ed.stickers.find(x=>x.id===sticker.id)??live);return}
      const to=n>=2?pinchOf(pt(t[0]),pt(t[1])):pt(t[0]??e.nativeEvent);const next=applyGesture(c.start,c.from,to);
      ed.setStickers(l=>updateSticker(l,sticker.id,next));ed.setDragging({id:sticker.id,overTrash:fingerOverTrash(e,ed)})}}
    onResponderRelease={e=>{if(fingerOverTrash(e,ed))ed.setStickers(l=>removeSticker(l,sticker.id));g.current=null;ed.setDragging(null)}}>
    {(()=>{const a=stickerFromEditorToken(sticker.emoji);return a?<AvatarStickerArt outfit={ed.avatarOutfit} sticker={a} size={fs*1.3}/>:<Text style={{fontSize:fs,lineHeight:fs*1.25,textAlign:'center'}}>{sticker.emoji}</Text>})()}
  </View>;
}

function SnapTextLayer({ed}:{ed:SnapEditorState}){
  const {text,tool,size}=ed;const drag=useRef<{y0:number;x0:number;py:number;px:number}|null>(null);
  if(!text&&tool!=='text')return null;
  const t=text??{text:'',style:'caption' as const,color:BRUSH_COLORS[0],x:0.5,y:0.55};
  const r=resolveTextStyle(t);const editing=tool==='text';
  const box=[st.textBox,{top:t.y*size.height},r.fullWidth?{left:0,right:0,backgroundColor:r.backgroundColor,paddingVertical:8,paddingHorizontal:12}:{left:16,right:16,alignItems:'center' as const}];
  const label=[{fontSize:r.fontSize,color:r.color,fontWeight:'800' as const,textAlign:'center' as const},t.style==='big'&&st.bigShadow,t.style==='background'&&{backgroundColor:r.backgroundColor,borderRadius:12,paddingHorizontal:14,paddingVertical:6,overflow:'hidden' as const}];
  if(editing)return <View style={box}><TextInput testID="snap-text-input" autoFocus multiline submitBehavior="blurAndSubmit" value={t.text} onChangeText={v=>ed.setText({...t,text:sanitizeText(v)})} placeholder="Typ iets…" placeholderTextColor="#ffffffaa" style={[label,{minWidth:120,outlineStyle:'none'} as object]} onSubmitEditing={()=>ed.setTool('none')} returnKeyType="done"/></View>;
  if(!t.text.trim())return null;
  return <View style={box} onStartShouldSetResponder={()=>true} onMoveShouldSetResponder={()=>true}
    onResponderGrant={e=>{drag.current={y0:t.y,x0:t.x,py:e.nativeEvent.pageY,px:e.nativeEvent.pageX}}}
    onResponderMove={e=>{const d=drag.current;if(!d||!size.height)return;ed.setText({...t,y:clampUnit(d.y0+(e.nativeEvent.pageY-d.py)/size.height)})}}
    onResponderRelease={e=>{const d=drag.current;drag.current=null;if(d&&Math.abs(e.nativeEvent.pageY-d.py)<4)ed.setTool('text')}}>
    <Text style={label}>{t.text}</Text>
  </View>;
}

function ToolButton({ed,id,icon,label}:{ed:SnapEditorState;id:EditorTool;icon:string;label:string}){const on=ed.tool===id;return <Pressable accessibilityLabel={label} onPress={()=>ed.toggle(id)} style={[st.toolBtn,on&&st.toolOn]}><Text style={[st.toolIcon,on&&{color:'#000'}]}>{icon}</Text></Pressable>}

/** Right-hand tool column plus the active tool's panel. Place outside the ViewShot. */
export function SnapEditorTools({ed,top=58,timerOnly=false}:{ed:SnapEditorState;top?:number;timerOnly?:boolean}){
  const {tool}=ed;
  const txt=ed.text??{text:'',style:'caption' as const,color:BRUSH_COLORS[0],x:0.5,y:0.55};
  return <>
    <View style={[st.column,{top}]}>
      {!timerOnly&&<><ToolButton ed={ed} id="text" icon="T" label="Tekst"/>
      <ToolButton ed={ed} id="draw" icon="✎" label="Tekenen"/>
      <ToolButton ed={ed} id="sticker" icon="☺" label="Stickers"/></>}
      <ToolButton ed={ed} id="timer" icon={ed.timing.viewSeconds===null?'∞':String(ed.timing.viewSeconds)} label="Timer"/>
      {tool==='draw'&&<Pressable accessibilityLabel="Ongedaan maken" disabled={!ed.strokes.length} onPress={ed.undo} style={[st.toolBtn,!ed.strokes.length&&{opacity:.4}]}><Text style={st.toolIcon}>↶</Text></Pressable>}
    </View>
    {tool==='draw'&&<View style={[st.palette,{top:top+5*58}]}>
      {BRUSH_COLORS.map(c=><Pressable key={c} accessibilityLabel={`Kleur ${c}`} onPress={()=>ed.setColor(c)} style={[st.swatch,{backgroundColor:c},ed.color===c&&st.swatchOn]}/>)}
      <View style={st.sep}/>
      {BRUSH_SIZES.map(w=><Pressable key={w} accessibilityLabel={`Dikte ${w}`} onPress={()=>ed.setBrush(w)} style={[st.sizeBtn,ed.brush===w&&st.sizeOn]}><View style={{width:w,height:w,borderRadius:w,backgroundColor:ed.color}}/></Pressable>)}
    </View>}
    {tool==='text'&&<View style={st.textBar}>
      <Pressable accessibilityLabel="Tekststijl" onPress={()=>ed.setText({...txt,style:nextTextStyle(txt.style)})} style={st.styleBtn}><Text style={st.styleTxt}>Aa · {TEXT_STYLES.find(s=>s.id===txt.style)?.label}</Text></Pressable>
      <Pressable accessibilityLabel="Klaar" onPress={()=>ed.setTool('none')} style={[st.styleBtn,{backgroundColor:C.yellow}]}><Text style={[st.styleTxt,{color:'#000'}]}>Klaar</Text></Pressable>
    </View>}
    {tool==='text'&&txt.style!=='caption'&&<View style={[st.palette,{top:top+4*56}]}>
      {BRUSH_COLORS.map(c=><Pressable key={c} accessibilityLabel={`Tekstkleur ${c}`} onPress={()=>ed.setText({...txt,color:c})} style={[st.swatch,{backgroundColor:c},txt.color===c&&st.swatchOn]}/>)}
    </View>}
    {tool==='sticker'&&<View style={st.sheet}>
      <Text style={st.sheetTitle}>Stickers</Text>
      <Text style={st.sub}>Mijn avatar</Text>
      <View style={[st.grid,{marginBottom:10}]}>{AVATAR_STICKERS.map(a=><Pressable key={a.id} accessibilityLabel={`Avatarsticker ${a.caption}`} onPress={()=>ed.addEmoji(editorToken(a.id))} style={st.avCell}><AvatarStickerArt outfit={ed.avatarOutfit} sticker={a} size={64}/></Pressable>)}</View>
      <Text style={st.sub}>Emoji</Text>
      <View style={st.grid}>{STICKER_EMOJI.map(e=><Pressable key={e} accessibilityLabel={`Sticker ${e}`} onPress={()=>ed.addEmoji(e)} style={st.cell}><Text style={{fontSize:34}}>{e}</Text></Pressable>)}</View>
      <Text style={st.hint}>Sleep om te verplaatsen · knijp met twee vingers om te schalen en draaien · sleep naar 🗑 om te verwijderen</Text>
    </View>}
    {tool==='timer'&&<View style={st.sheet}>
      <Text style={st.sheetTitle}>Hoe lang zichtbaar?</Text>
      <View style={st.grid}>{TIMER_OPTIONS.map(v=><Pressable key={String(v)} accessibilityLabel={`Timer ${timerLabel(v)}`} onPress={()=>ed.setTiming({...ed.timing,viewSeconds:v})} style={[st.chip,ed.timing.viewSeconds===v&&st.chipOn]}><Text style={[st.chipTxt,ed.timing.viewSeconds===v&&{color:'#000'}]}>{timerLabel(v)}</Text></Pressable>)}</View>
      <View style={st.row}><Text style={st.rowTxt}>Eenmalig bekijken</Text><Switch value={ed.timing.viewOnce} onValueChange={v=>ed.setTiming({...ed.timing,viewOnce:v})} trackColor={{true:C.yellow,false:C.border}} thumbColor="#fff"/></View>
      <Text style={st.hint}>{timingSummary(ed.timing)}</Text>
      <Pressable accessibilityLabel="Klaar" onPress={()=>ed.setTool('none')} style={[st.styleBtn,{backgroundColor:C.yellow,alignSelf:'center',marginTop:8}]}><Text style={[st.styleTxt,{color:'#000'}]}>Klaar</Text></Pressable>
    </View>}
  </>;
}

const st=StyleSheet.create({
  column:{position:'absolute',right:14,gap:10,alignItems:'center'},
  toolBtn:{width:46,height:46,borderRadius:23,backgroundColor:'#0007',alignItems:'center',justifyContent:'center'},
  toolOn:{backgroundColor:C.yellow},toolIcon:{color:C.text,fontSize:24,fontWeight:'800'},
  palette:{position:'absolute',right:18,gap:7,alignItems:'center',backgroundColor:'#0006',padding:6,borderRadius:20},
  swatch:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:'#fff8'},swatchSm:{width:26,height:26,borderRadius:13,borderWidth:2,borderColor:'#fff8'},swatchOn:{borderColor:'#fff',borderWidth:4,transform:[{scale:1.15}]},
  sep:{height:1,width:22,backgroundColor:'#fff5',marginVertical:3},
  sizeBtn:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},sizeOn:{backgroundColor:'#fff3',borderWidth:1,borderColor:'#fff'},
  sticker:{position:'absolute',alignItems:'center',justifyContent:'center'},
  trash:{position:'absolute',width:60,height:60,borderRadius:30,backgroundColor:'#0008',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff8'},
  trashHot:{backgroundColor:C.danger,transform:[{scale:1.25}]},trashIcon:{fontSize:28},
  textBox:{position:'absolute'},bigShadow:{textShadowColor:'#000c',textShadowRadius:6,textShadowOffset:{width:0,height:2}},
  textBar:{position:'absolute',left:12,top:20,flexDirection:'row',gap:8},
  styleBtn:{backgroundColor:'#000a',paddingHorizontal:14,paddingVertical:9,borderRadius:18},styleTxt:{color:C.text,fontWeight:'800'},
  sheet:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#101219F2',borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,paddingBottom:28},
  sub:{color:C.muted,fontSize:12,fontWeight:'800',marginBottom:4},avCell:{width:'23%',alignItems:'center',paddingVertical:2},
  sheetTitle:{color:C.text,fontSize:18,fontWeight:'900',marginBottom:10},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:6},cell:{width:'14%',alignItems:'center',paddingVertical:4},
  chip:{minWidth:52,paddingVertical:10,borderRadius:18,backgroundColor:C.elevated,alignItems:'center'},chipOn:{backgroundColor:C.yellow},chipTxt:{color:C.text,fontWeight:'800',fontSize:16},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:14},rowTxt:{color:C.text,fontSize:16,fontWeight:'700'},
  hint:{color:C.muted,textAlign:'center',marginTop:10,fontSize:12},
});
