import React from 'react';
import {Pressable,StyleSheet,Text,View, type ViewStyle} from 'react-native';
import {C} from '../lib/theme';
export function Page({children,style}:{children:React.ReactNode;style?:ViewStyle}) {return <View style={[s.page,style]}>{children}</View>}
export function Title({children}:{children:React.ReactNode}) {return <Text style={s.title}>{children}</Text>}
export function Button({children,onPress,secondary=false,disabled=false}:{children:React.ReactNode;onPress:()=>void;secondary?:boolean;disabled?:boolean}) {return <Pressable onPress={onPress} disabled={disabled} style={[s.button,secondary&&s.secondary,disabled&&{opacity:.5}]}><Text style={[s.buttonText,secondary&&{color:C.text}]}>{children}</Text></Pressable>}
export function Hint({children}:{children:React.ReactNode}) {return <Text style={s.hint}>{children}</Text>}
export function Avatar({name,size=44}:{name?:string;size?:number}) {return <View style={[s.avatar,{width:size,height:size,borderRadius:size/2}]}><Text style={{fontSize:size*.42,fontWeight:'900',color:C.bg}}>{(name||'X').slice(0,1).toUpperCase()}</Text></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:C.bg,padding:20},title:{fontSize:30,color:C.text,fontWeight:'900',marginBottom:14},button:{backgroundColor:C.yellow,borderRadius:28,padding:16,alignItems:'center',marginVertical:6},secondary:{backgroundColor:C.elevated},buttonText:{color:C.bg,fontSize:16,fontWeight:'800'},hint:{color:C.muted,fontSize:14,marginVertical:10},avatar:{backgroundColor:C.yellow,alignItems:'center',justifyContent:'center'}});
