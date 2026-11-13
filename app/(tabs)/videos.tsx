import React from 'react';
import {View} from 'react-native';
import {SpotlightScreen} from '../../components/spotlight/SpotlightScreen';
import {useTabSwipe} from '../../hooks/useTabSwipe';
/** Spotlight tab (Snapchat): the vertical public feed full screen; swipe right goes back to Verhalen. */
export default function Videos(){const swipe=useTabSwipe('videos');return <View style={{flex:1,backgroundColor:'#000'}} {...swipe}><SpotlightScreen embedded/></View>}
