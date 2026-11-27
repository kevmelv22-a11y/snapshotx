import React from 'react';
import {useLocalSearchParams} from 'expo-router';
import {SpotlightScreen} from '../components/spotlight/SpotlightScreen';
/** Uitgelicht (full screen, with back button). The same feed is the Spotlight tab. `?id=` (shared card in chat) = that snap first. */
export default function Uitgelicht(){const {id}=useLocalSearchParams<{id?:string}>();return <SpotlightScreen startId={typeof id==='string'?id:undefined}/>}
