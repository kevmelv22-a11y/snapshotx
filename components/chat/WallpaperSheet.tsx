import React from 'react';
import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C} from '../../lib/theme';
import {Locked,WallpaperPicker} from '../plus/PlusParts';
import {WALLPAPER_COPY,wallpaperLabel} from '../../lib/chat-wallpaper';
import type {WallpaperId} from '../../lib/plus';

/** Snapchat+ "Chat-achtergrond" picker: shared wallpaper for everyone in the chat; only X+ members can change it. */
export function WallpaperSheet({visible,current,plus,busy=false,onPick,onUpgrade,onClose}:{visible:boolean;current:WallpaperId;plus:boolean;busy?:boolean;onPick:(id:WallpaperId)=>void;onUpgrade:()=>void;onClose:()=>void}){
  const insets=useSafeAreaInsets();
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} testID="wallpaper-backdrop">
      <Pressable onPress={()=>{}} style={[s.sheet,{paddingBottom:Math.max(20,insets.bottom)}]} testID="wallpaper-sheet">
        <View style={s.top}><Text style={s.title}>{WALLPAPER_COPY.title}</Text><Pressable onPress={onClose} accessibilityLabel="Sluiten" hitSlop={10}><Ionicons name="close" size={24} color={C.text}/></Pressable></View>
        <Text style={s.current} testID="wallpaper-current">Nu: {current==='none'?'geen achtergrond':wallpaperLabel(current)}</Text>
        <Text style={s.hint}>{WALLPAPER_COPY.hint}</Text>
        {!plus&&<View testID="wallpaper-locked"><Text style={s.lockText}>{WALLPAPER_COPY.locked}</Text><Locked onUpgrade={onUpgrade}/></View>}
        <View style={{opacity:busy?.6:1}} pointerEvents={busy?'none':'auto'}><WallpaperPicker value={current} locked={!plus} onChange={id=>onPick(id as WallpaperId)}/></View>
        {plus&&current!=='none'&&<Pressable style={s.clear} onPress={()=>onPick('none')} disabled={busy} testID="wallpaper-clear"><Ionicons name="trash-outline" size={18} color="#FF8FA3"/><Text style={s.clearText}>{WALLPAPER_COPY.clear}</Text></Pressable>}
      </Pressable>
    </Pressable>
  </Modal>;
}
const s=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'#000a',justifyContent:'flex-end'},
  sheet:{width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:C.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,gap:10},
  top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:C.text,fontSize:19,fontWeight:'800'},
  current:{color:C.yellow,fontSize:13,fontWeight:'800'},hint:{color:C.muted,fontSize:13},lockText:{color:C.text,fontSize:13,marginBottom:6},
  clear:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,borderRadius:16,backgroundColor:'#2E1A2A',marginTop:4},clearText:{color:'#FF8FA3',fontWeight:'800',fontSize:15},
});
