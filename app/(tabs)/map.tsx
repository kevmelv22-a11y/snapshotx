import React from 'react';
import {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import MapScreen from '../map';
export default function MapTab(){const insets=useSafeAreaInsets();return <View style={{flex:1,paddingTop:insets.top,backgroundColor:'#08090E'}}><MapScreen/></View>}
