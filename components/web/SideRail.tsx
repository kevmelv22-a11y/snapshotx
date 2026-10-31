import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Tabs} from 'expo-router';
import {SIDE_RAIL_WIDTH,railItems} from '../../lib/web-layout';
type BottomTabBarProps=Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

type Item={name:string;icon:keyof typeof Ionicons.glyphMap;label:string};

/** Narrow desktop-web side rail (Snapchat Web style): icon + tiny label, replaces the wide left tab bar. */
export function SideRail({state,navigation,items,badge}:BottomTabBarProps&{items:readonly Item[];badge?:{name:string;count:number}}){
 const active=state.routes[state.index]?.name;
 return <View style={s.rail} testID="web-side-rail">{railItems(items,state.routes.map(r=>r.name)).map(it=>{const on=it.name===active;const count=badge?.name===it.name?badge.count:0;return <Pressable key={it.name} accessibilityRole="tab" accessibilityLabel={it.label} accessibilityState={{selected:on}} onPress={()=>{const route=state.routes.find(r=>r.name===it.name);if(!route)return;const e=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});if(!on&&!e.defaultPrevented)navigation.navigate(route.name)}} style={[s.item,on&&s.on]}>
  <View><Ionicons name={it.icon} size={24} color={on?'#C43CE5':'#BFB8C6'}/>{count>0&&<View style={s.badge}><Text style={s.badgeText}>{count>99?'99+':count}</Text></View>}</View>
  <Text style={[s.label,on&&{color:'#C43CE5'}]} numberOfLines={1}>{it.label}</Text>
 </Pressable>})}</View>;
}
const s=StyleSheet.create({rail:{width:SIDE_RAIL_WIDTH,backgroundColor:'#050508',borderRightWidth:1,borderRightColor:'#4A3A56',paddingTop:16,alignItems:'center',gap:6},item:{width:SIDE_RAIL_WIDTH-16,alignItems:'center',paddingVertical:10,borderRadius:14,gap:4},on:{backgroundColor:'#2A1838'},label:{color:'#BFB8C6',fontSize:10,fontWeight:'700'},badge:{position:'absolute',top:-6,right:-12,backgroundColor:'#AF21D3',borderRadius:9,minWidth:18,height:18,alignItems:'center',justifyContent:'center',paddingHorizontal:4},badgeText:{color:'#fff',fontSize:10,fontWeight:'700'}});
