import React from 'react';
import {Image,Pressable,StyleSheet,Text,View,type ImageStyle,type StyleProp} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {TIER_BRAND,brandWidth,isBrandTier,isSmallIconSize,type BrandTier} from '../../lib/tier-brand';
import type {Tier} from '../../lib/plus';

/** Transparent tier logos cropped from Kevin's tier-logos.png (scripts/tier-logos/crop.py). */
const WORDMARKS:Record<BrandTier,number>={plus:require('../../assets/tiers/x-wordmark.png'),lens:require('../../assets/tiers/lens-wordmark.png'),platinum:require('../../assets/tiers/platinum-wordmark.png'),family:require('../../assets/tiers/family-wordmark.png')};
/** Simplified 96x96 icons for tiny sizes (badge 22px, tabs 26px): scripts/tier-logos/small_icons.py. */
const SMALL_ICONS:Record<BrandTier,number>={plus:require('../../assets/tiers/small/plus.png'),lens:require('../../assets/tiers/small/lens.png'),platinum:require('../../assets/tiers/small/platinum.png'),family:require('../../assets/tiers/small/family.png')};
const ICONS:Record<BrandTier,number>={plus:require('../../assets/tiers/x-icon.png'),lens:require('../../assets/tiers/lens-icon.png'),platinum:require('../../assets/tiers/platinum-icon.png'),family:require('../../assets/tiers/family-icon.png')};

export function TierWordmark({tier,height=28,style}:{tier:BrandTier;height?:number;style?:StyleProp<ImageStyle>}){
  return <Image source={WORDMARKS[tier]} resizeMode="contain" accessibilityLabel={TIER_BRAND[tier].label} testID={`tier-wordmark-${tier}`} style={[{height,width:brandWidth(tier,'wordmark',height),maxWidth:'100%'},style]}/>;
}
/** Below SMALL_ICON_MAX px the simplified square icon is used; larger sizes use the full logo crop. */
export function TierIcon({tier,size=24,style,variant}:{tier:BrandTier;size?:number;style?:StyleProp<ImageStyle>;variant?:'small'|'full'}){
  if((variant??(isSmallIconSize(size)?'small':'full'))==='small')return <Image source={SMALL_ICONS[tier]} resizeMode="contain" accessibilityLabel={`${TIER_BRAND[tier].label}-logo`} testID={`tier-icon-small-${tier}`} style={[{height:size,width:size},style]}/>;
  return <Image source={ICONS[tier]} resizeMode="contain" accessibilityLabel={`${TIER_BRAND[tier].label}-logo`} testID={`tier-icon-${tier}`} style={[{height:size,width:brandWidth(tier,'icon',size)},style]}/>;
}
/** Snapchat-style "My Account" banner card: active tier's wordmark + status, or the Snapshot X upsell when not subscribed. */
export function TierBanner({tier,status,onPress}:{tier:Tier|null;status?:string;onPress:()=>void}){
  const t:BrandTier=isBrandTier(tier)?tier:'plus',member=isBrandTier(tier);
  return <Pressable onPress={onPress} style={s.banner} accessibilityRole="button" accessibilityLabel={member?`${TIER_BRAND[t].label} beheren`:'Word lid van Snapshot X+'} testID="tier-banner">
    <View style={{flex:1,gap:6}}><TierWordmark tier={t} height={46} style={{marginLeft:-6,marginVertical:-6}}/><Text style={s.sub}>{member?(status||'Actief'):'Word lid · 7 dagen gratis proberen'}</Text></View>
    <Ionicons name="chevron-forward" size={20} color="#C7C7CC"/></Pressable>;
}
const s=StyleSheet.create({banner:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#0B0B10',borderRadius:16,borderWidth:1,borderColor:'#2B2B38',padding:14,marginBottom:10},sub:{color:'#C7C7CC',fontSize:13,fontWeight:'600'}});
