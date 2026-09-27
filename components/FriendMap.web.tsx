import React from 'react';
import {Text,View} from 'react-native';
import {C} from '../lib/theme';
import type {Pin} from './FriendMap.native';
export default function FriendMap({pins}:{pins:Pin[]}){return <View style={{flex:1,padding:20}}><Text style={{color:C.text,fontSize:20}}>Snap Map werkt op iOS en Android.</Text>{pins.map(p=><Text key={p.id} style={{color:C.muted,margin:10}}>{p.name}: {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}</Text>)}</View>}
