import React, {useRef, useState} from 'react';
import {Modal, Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {liveScanSupported, pickAndDecodeQr} from '../lib/qr-image';

/** "Code scannen": live camera (expo-camera; on web where the browser has BarcodeDetector) + on web a photo upload decoded with jsQR. */
export function FriendCodeScanner({visible, onClose, onCode}:{visible:boolean;onClose:()=>void;onCode:(data:string)=>void}){
 const [permission,askPermission]=useCameraPermissions(),[hint,setHint]=useState(''),handled=useRef('');
 const live=liveScanSupported(),web=Platform.OS==='web';
 const hit=(data:string)=>{if(!data||handled.current===data)return;handled.current=data;setTimeout(()=>{handled.current=''},2500);onCode(data)};
 async function upload(){setHint('');const r=await pickAndDecodeQr();if(r==='cancel')return;if(!r){setHint('Geen QR-code gevonden in deze foto. Probeer een scherpere foto.');return}hit(r)}
 return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={s.modal}>
  <Text style={s.title}>Code scannen</Text>
  {visible&&live&&permission?.granted&&<CameraView style={s.scanner} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>hit(data)}/>}
  {visible&&live&&!permission?.granted&&<Pressable testID="scan-allow-camera" onPress={async()=>{const p=await askPermission();if(!p.granted)setHint(web?'Geen cameratoegang. Upload een foto van de code.':'Cameratoegang nodig om een code te scannen (Instellingen → SnapShot X → Camera).')}} style={[s.scanner,s.center]}><Ionicons name="camera-outline" size={44} color="white"/><Text style={s.text}>Camera toestaan</Text></Pressable>}
  {visible&&!live&&<View style={[s.scanner,s.center]}><Ionicons name="qr-code-outline" size={44} color="white"/><Text style={s.text}>Live scannen werkt niet in deze browser. Maak of kies een foto van de code.</Text></View>}
  {web&&<Pressable testID="scan-upload" onPress={()=>void upload()} style={s.upload}><Ionicons name="image-outline" size={20} color="#111"/><Text style={s.uploadText}>Foto van code kiezen</Text></Pressable>}
  {!!hint&&<Text style={s.hint}>{hint}</Text>}
  <Pressable onPress={onClose} style={s.close}><Text style={s.closeText}>Sluiten</Text></Pressable>
 </View></Modal>;
}
const s=StyleSheet.create({modal:{flex:1,backgroundColor:'#0B0614',alignItems:'center',justifyContent:'center',padding:24,gap:14},title:{color:'white',fontSize:22,fontWeight:'800'},
 scanner:{width:300,height:300,maxWidth:'100%',borderRadius:24,overflow:'hidden',backgroundColor:'#1D1530'},center:{alignItems:'center',justifyContent:'center',gap:10,padding:18},
 text:{color:'white',textAlign:'center',fontSize:15},upload:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:'#FFFC00',paddingHorizontal:20,paddingVertical:12,borderRadius:22},
 uploadText:{color:'#111',fontWeight:'800'},hint:{color:'#FFB4B4',textAlign:'center',maxWidth:320},close:{paddingHorizontal:26,paddingVertical:12,borderRadius:22,backgroundColor:'#2A2140'},closeText:{color:'white',fontWeight:'700'}});
