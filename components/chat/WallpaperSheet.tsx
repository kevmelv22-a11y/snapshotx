import React from 'react';
import {ActivityIndicator,Modal,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {C} from '../../lib/theme';
import {PhotoWallpaperBackground,WallpaperPicker} from '../plus/PlusParts';
import {PHOTO_COPY,PHOTO_WALLPAPER,WALLPAPER_BLUR_RADIUS,WALLPAPER_COPY,wallpaperLabel,type ChatWallpaperId} from '../../lib/chat-wallpaper';
import type {WallpaperId} from '../../lib/plus';

/** Snapchat+ "Chat-achtergrond" picker: shared wallpaper for everyone in the chat; anyone in the chat can change it (no X+ needed). */
/** Also "Eigen foto" (Snapchat+: photo from the Camera Roll) with a Vervagen (blur) switch; the current choice is marked. */
export function WallpaperSheet({visible,current,busy=false,onPick,onClose,photo=null,onPickPhoto,onBlur}:{visible:boolean;current:ChatWallpaperId;busy?:boolean;onPick:(id:WallpaperId)=>void;onClose:()=>void;
  /** Current photo wallpaper (uri may be null while the signed URL loads). */photo?:{uri:string|null;blur:boolean}|null;onPickPhoto?:()=>void;onBlur?:(blur:boolean)=>void}){
  const insets=useSafeAreaInsets(),isPhoto=current===PHOTO_WALLPAPER&&!!photo;
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} testID="wallpaper-backdrop">
      <Pressable onPress={()=>{}} style={[s.sheet,{paddingBottom:Math.max(20,insets.bottom)}]} testID="wallpaper-sheet">
        <View style={s.top}><Text style={s.title}>{WALLPAPER_COPY.title}</Text><Pressable onPress={onClose} accessibilityLabel="Sluiten" hitSlop={10}><Ionicons name="close" size={24} color={C.text}/></Pressable></View>
        <Text style={s.current} testID="wallpaper-current">Nu: {current==='none'?'geen achtergrond':wallpaperLabel(current)}{isPhoto&&photo?.blur?' (vervaagd)':''}</Text>
        <Text style={s.hint}>{WALLPAPER_COPY.hint}</Text>
        <View style={{opacity:busy?.6:1}} pointerEvents={busy?'none':'auto'}><WallpaperPicker value={current} onChange={id=>onPick(id as WallpaperId)}/></View>
        {!!onPickPhoto&&<View style={[s.photoRow,{opacity:busy?.6:1}]} pointerEvents={busy?'none':'auto'}>
          <Pressable onPress={onPickPhoto} style={[s.photoTile,isPhoto&&s.photoOn]} testID="wallpaper-photo" accessibilityRole="radio" accessibilityLabel={`Achtergrond ${PHOTO_COPY.label}`} accessibilityState={{checked:isPhoto}}>
            {isPhoto&&photo?.uri?<PhotoWallpaperBackground uri={photo.uri} blur={photo.blur} blurRadius={WALLPAPER_BLUR_RADIUS/3}/>:<Ionicons name="images-outline" size={24} color={C.muted}/>}
            {busy&&<ActivityIndicator color={C.yellow} style={StyleSheet.absoluteFill}/>}
            {isPhoto&&<Ionicons name="checkmark-circle" size={18} color={C.yellow} style={s.checkIco}/>}
          </Pressable>
          <View style={{flex:1,gap:8}}>
            <Text style={[s.photoTitle,isPhoto&&{color:C.yellow}]}>{PHOTO_COPY.label}</Text>
            <Pressable onPress={onPickPhoto} style={s.photoBtn} testID="wallpaper-photo-pick"><Ionicons name="images" size={16} color={C.bg}/><Text style={s.photoBtnText}>{isPhoto?PHOTO_COPY.change:PHOTO_COPY.pick}</Text></Pressable>
            {isPhoto&&!!onBlur&&<View style={s.blurRow}><View style={{flex:1}}><Text style={s.blurTitle}>{PHOTO_COPY.blur}</Text><Text style={s.blurHint}>{PHOTO_COPY.blurHint}</Text></View>
              <Switch value={!!photo?.blur} onValueChange={onBlur} disabled={busy} trackColor={{true:C.yellow,false:C.border}} thumbColor="#fff" testID="wallpaper-blur" accessibilityLabel={PHOTO_COPY.blur}/></View>}
          </View>
        </View>}
        {current!=='none'&&<Pressable style={s.clear} onPress={()=>onPick('none')} disabled={busy} testID="wallpaper-clear"><Ionicons name="trash-outline" size={18} color="#FF8FA3"/><Text style={s.clearText}>{WALLPAPER_COPY.clear}</Text></Pressable>}
      </Pressable>
    </Pressable>
  </Modal>;
}
const s=StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'#000a',justifyContent:'flex-end'},
  sheet:{width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:C.surface,borderTopLeftRadius:22,borderTopRightRadius:22,padding:18,gap:10},
  top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:C.text,fontSize:19,fontWeight:'800'},
  current:{color:C.yellow,fontSize:13,fontWeight:'800'},hint:{color:C.muted,fontSize:13},
  photoRow:{flexDirection:'row',gap:12,alignItems:'flex-start',marginTop:2},photoTile:{width:64,height:96,borderRadius:12,borderWidth:1,borderColor:C.border,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:'#000'},photoOn:{borderWidth:3,borderColor:C.yellow},
  checkIco:{position:'absolute',bottom:2,right:2},photoTitle:{color:C.text,fontWeight:'800',fontSize:15},
  photoBtn:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',backgroundColor:C.yellow,borderRadius:16,paddingHorizontal:12,paddingVertical:7},photoBtnText:{color:C.bg,fontWeight:'800',fontSize:13},
  blurRow:{flexDirection:'row',alignItems:'center',gap:8},blurTitle:{color:C.text,fontWeight:'700',fontSize:14},blurHint:{color:C.muted,fontSize:12},
  clear:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,borderRadius:16,backgroundColor:'#2E1A2A',marginTop:4},clearText:{color:'#FF8FA3',fontWeight:'800',fontSize:15},
});
