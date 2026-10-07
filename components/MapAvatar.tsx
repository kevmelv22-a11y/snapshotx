import React from 'react';
import Svg, {Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import type {AvatarAppearance} from '../lib/avatar';
import {CLASSIC_HAIR, CLASSIC_SKIN} from '../lib/avatar/appearance';

type Props = {id: string; size?: number; selected?: boolean; appearance?: AvatarAppearance};
const SKIN: readonly string[] = CLASSIC_SKIN;
const HAIR: readonly string[] = CLASSIC_HAIR;
const TOP = ['#8D51D0', '#57765E', '#304E85', '#DDB764', '#26232C', '#6ABCAA'];
const BOTTOMS = ['#292631', '#B2B2BC', '#5E3A91', '#333142'];
const SHOES = ['#F7F5FA', '#25232B', '#FFE436'];
const SKIES = ['#513A91', '#315B86', '#77486B', '#386963', '#775C37'];
const SUITS = ['#9B62D9', '#47A3BD', '#E47B9E', '#6CC7A0', '#DDB764'];

function hashId(id: string, seed: number) {
  return [...id].reduce((value, letter) => (value * 33 + letter.charCodeAt(0)) >>> 0, seed);
}

/** Original, shaded SnapLion character. One renderer is shared by the map, profile and wardrobe. */
export function MapAvatar({id, size = 54, selected = false, appearance}: Props) {
  const hash = hashId(id, 7);
  const skin = appearance ? SKIN[appearance.skin] : SKIN[hash % SKIN.length];
  const hair = appearance ? HAIR[appearance.hair] : HAIR[(hash >>> 4) % HAIR.length];
  const shirt = appearance ? TOP[appearance.top] : SUITS[hash % SUITS.length];
  const sky = SKIES[hash % SKIES.length];
  const hairstyle = appearance?.hairstyle ?? ((hash >>> 5) % 3);
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="SnapLion-avatarpreview">
    <Defs>
      <LinearGradient id="face" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFF1DC"/><Stop offset=".42" stopColor={skin}/><Stop offset="1" stopColor="#B97259"/></LinearGradient>
      <LinearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFF0BB" stopOpacity=".85"/><Stop offset=".27" stopColor={hair}/><Stop offset="1" stopColor="#241C28"/></LinearGradient>
      <LinearGradient id="shirt" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#171821"/><Stop offset=".5" stopColor={shirt}/><Stop offset="1" stopColor="#211D2C"/></LinearGradient>
      <RadialGradient id="sky" cx=".36" cy=".2" r=".9"><Stop offset="0" stopColor="#9E85CA"/><Stop offset="1" stopColor={sky}/></RadialGradient>
    </Defs>
    <Circle cx="32" cy="32" r="31" fill="url(#sky)" stroke={selected ? '#FFE436' : '#E6A2EE'} strokeWidth="3"/>
    <Circle cx="12" cy="15" r="1" fill="#fff" opacity=".8"/><Circle cx="51" cy="19" r=".8" fill="#fff" opacity=".8"/>
    <Path d="M4 62c2-14 12-20 28-20s26 6 28 20Z" fill="url(#shirt)"/>
    <Path d="m23 43 9 8 9-8 4 18H19Z" fill="#E9E5EF"/>
    <Path d="m28 49 4 4 4-4-2 13h-4Z" fill="#A82C42"/>
    <Rect x="27" y="36" width="10" height="11" rx="4" fill="url(#face)"/>
    <Ellipse cx="32" cy="28" rx="16" ry="19" fill="url(#face)"/>
    <Ellipse cx="17" cy="30" rx="2" ry="5" fill={skin}/><Ellipse cx="47" cy="30" rx="2" ry="5" fill={skin}/>
    {hairstyle === 2 ? <Path d="M16 27Q12 9 26 8q3-6 11-3 15-3 13 12 5 4 1 12-6-5-9-13-10 11-26 11Z" fill="url(#hair)"/> : hairstyle === 1 ? <Path d="M16 28Q13 8 29 7q13-5 20 6 7 10 2 17-9-3-13-14-8 10-22 12Z" fill="url(#hair)"/> : <Path d="M16 27Q14 6 32 6q20 0 17 22-7-3-12-13-7 10-21 12Z" fill="url(#hair)"/>}
    <Path d="M22 12q8-6 17-2" fill="none" stroke="#FFE5A2" strokeWidth="1.7" opacity=".85" strokeLinecap="round"/>
    <Path d="M22 26q4-3 8-.5M35 25.5q4-3 8 .5" fill="none" stroke="#3A2630" strokeWidth="1.7" strokeLinecap="round"/>
    <Ellipse cx="27" cy="30" rx="3.5" ry="3" fill="#FFF"/><Ellipse cx="38" cy="30" rx="3.5" ry="3" fill="#FFF"/>
    <Circle cx="28" cy="30" r="1.7" fill="#362735"/><Circle cx="37" cy="30" r="1.7" fill="#362735"/><Circle cx="28.5" cy="29.5" r=".55" fill="#fff"/><Circle cx="37.5" cy="29.5" r=".55" fill="#fff"/>
    <Path d="m32 31-1.2 5q1.2 1.2 2.7 0" fill="none" stroke="#B67561" strokeWidth="1" strokeLinecap="round"/>
    <Path d="M27 39q5 4 10 0" fill="none" stroke="#914D51" strokeWidth="1.8" strokeLinecap="round"/><Path d="M29 39.5q3 1 6 0" fill="none" stroke="#F8C2AD" strokeWidth=".9" strokeLinecap="round"/>
    {appearance?.accessory === 4 && <G><Path d="M17 19Q18 8 32 7Q46 7 47 18L43 21Q31 17 20 22Z" fill="#26384D" stroke="#8190A3" strokeWidth=".8"/><Path d="M18 18Q31 15 47 18L52 21Q50 23 46 22Q31 18 18 23Z" fill="#334B66" stroke="#8190A3" strokeWidth=".7"/></G>}
    {appearance?.accessory === 3 && <G fill="none" stroke="#231D2C" strokeWidth="1.5"><Rect x="21" y="27" width="11" height="7" rx="3"/><Rect x="33" y="27" width="11" height="7" rx="3"/><Path d="M32 29h2"/></G>}
    {appearance?.accessory === 1 && <Path d="m32 5 1.6 3.4 3.7.5-2.7 2.6.7 3.7-3.3-1.8-3.3 1.8.7-3.7-2.7-2.6 3.7-.5Z" fill="#FFE436" stroke="#FFF3AC" strokeWidth=".7"/>}
  </Svg>;
}

/** Full-body, shaded character. All clothing choices affect this same preview. */
export function MapExplorer({id, own = false, appearance, size = 82}: {id: string; own?: boolean; appearance?: AvatarAppearance; size?: number}) {
  const hash = hashId(id, 9);
  const item = hash % SKIN.length;
  const skin = appearance ? SKIN[appearance.skin] : SKIN[item];
  const hair = appearance ? HAIR[appearance.hair] : HAIR[(hash >>> 4) % HAIR.length];
  const top = appearance ? TOP[appearance.top] : SUITS[hash % SUITS.length];
  const trouser = appearance ? BOTTOMS[appearance.bottoms] : '#292631';
  const shoes = appearance ? SHOES[appearance.shoes] : own ? '#FFE436' : '#F7F5FA';
  const hairstyle = appearance?.hairstyle ?? ((hash >>> 5) % 3);
  const suit = appearance?.top === 2 || appearance?.top === 4;
  const dress = appearance?.bottoms === 3;
  return <Svg width={size} height={size * 119 / 82} viewBox="0 0 82 119" accessibilityLabel={own ? 'Mijn aangepaste avatar' : 'SnapLion-avatar'}>
    <Defs>
      <LinearGradient id="body" x1="0" y1="0" x2="1" y2=".2"><Stop offset="0" stopColor="#171720"/><Stop offset=".34" stopColor={top}/><Stop offset=".7" stopColor={top}/><Stop offset="1" stopColor="#171720"/></LinearGradient>
      <LinearGradient id="skin" x1="0" y1="0" x2="1" y2=".7"><Stop offset="0" stopColor="#FFF0D7"/><Stop offset=".48" stopColor={skin}/><Stop offset="1" stopColor="#A96955"/></LinearGradient>
      <LinearGradient id="locks" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFE2A0" stopOpacity=".9"/><Stop offset=".28" stopColor={hair}/><Stop offset="1" stopColor="#17141E"/></LinearGradient>
      <LinearGradient id="legs" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#171720"/><Stop offset=".5" stopColor={trouser}/><Stop offset="1" stopColor="#171720"/></LinearGradient>
      <LinearGradient id="shoe" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="1" stopColor={shoes}/></LinearGradient>
    </Defs>
    <Ellipse cx="41" cy="115" rx="29" ry="3" fill="#09080E" opacity=".38"/>
    {!dress && <G stroke="url(#legs)" strokeWidth="11" strokeLinecap="round"><Path d="m31 78-1 27"/><Path d="m51 78 1 27"/></G>}
    {dress && <Path d="M22 73q19 7 38 0l10 34H12Z" fill="url(#body)" stroke="#FFFFFF" strokeOpacity=".2" strokeWidth="1"/>}
    <Path d="M19 104q-9 7-5 11h21q3-5-3-10Z" fill="#171720"/><Path d="M46 104q-5 6-2 11h23q4-4-5-11Z" fill="#171720"/>
    <Path d="M14 113q9 3 21 0M44 113q10 3 24 0" fill="none" stroke="#7B7483" strokeWidth="1.2"/>
    <Ellipse cx="24" cy="110" rx="11" ry="3.6" fill="url(#shoe)"/><Ellipse cx="57" cy="110" rx="11" ry="3.6" fill="url(#shoe)"/>
    <Rect x="35" y="39" width="12" height="16" rx="5" fill="url(#skin)"/>
    <Path d="M17 53q3-14 24-14t24 14l5 24q-11 9-29 9T12 77Z" fill="url(#body)" stroke="#FFFFFF" strokeOpacity=".2" strokeWidth=".7"/>
    <Path d="M17 55 8 77M65 55l9 22" fill="none" stroke="url(#body)" strokeWidth="9" strokeLinecap="round"/>
    <Path d="M8 76q-2 5 1 8M74 76q2 5-1 8" fill="none" stroke="url(#skin)" strokeWidth="5" strokeLinecap="round"/>
    <Path d="M36 42 41 55 47 42 51 48 45 72 41 65 37 72 31 48Z" fill="#181721" stroke="#FFFFFF" strokeOpacity=".18" strokeWidth=".7"/>
    <Path d="m38 47 3 7 3-7-3-3Z" fill="#F2EAF1"/>
    {suit?<><Path d="m38 50-5 3 5 3 3-3Zm6 0 5 3-5 3-3-3Z" fill="#14131B" stroke="#68616C" strokeWidth=".7"/><Circle cx="41" cy="53" r="1.5" fill="#B52F43"/></>:<Path d="m39 50 2 2 2-2-2 14Z" fill="#B52F43"/>}
    {suit && <><Path d="m20 49 11-7 7 17-8 7Z" fill="#201D28" stroke="#807887" strokeWidth=".7"/><Path d="m61 49-11-7-7 17 8 7Z" fill="#201D28" stroke="#807887" strokeWidth=".7"/><Path d="M52 58h7v2h-7Z" fill="#D54452"/><Circle cx="42" cy="70" r="1" fill="#C9B9C4"/></>}
    <Path d="M20 57q10 6 21 3M62 57q-10 6-21 3" fill="none" stroke="#FFFFFF" strokeOpacity=".16" strokeWidth="1"/>
    <Ellipse cx="41" cy="25" rx="18" ry="20" fill="url(#skin)"/>
    <Ellipse cx="23" cy="29" rx="2.5" ry="5" fill={skin}/><Ellipse cx="59" cy="29" rx="2.5" ry="5" fill={skin}/>
    {hairstyle===2?<Path d="M22 24Q15 7 29 5q5-7 13-2 12-5 17 7 7 11 2 19-7-5-12-15-9 11-27 10Z" fill="url(#locks)"/>:hairstyle===1?<Path d="M22 24Q19 5 34 4q12-3 20 8 7 9 3 19-8-3-12-15-8 10-23 11Z" fill="url(#locks)"/>:<Path d="M22 23Q19 4 41 4q22 0 19 23-9-3-13-15-9 10-25 12Z" fill="url(#locks)"/>}
    <Path d="M29 10q8-6 19-3" fill="none" stroke="#FFE7B0" strokeWidth="2" strokeLinecap="round" opacity=".85"/>
    {appearance?.accessory===4&&<G><Path d="M22 16Q25 5 41 5Q56 5 60 16L55 19Q41 15 26 20Z" fill="#26384D" stroke="#8190A3" strokeWidth=".8"/><Path d="M22 16Q40 12 60 16L66 20Q63 22 58 21Q40 17 22 21Z" fill="#334B66" stroke="#8190A3" strokeWidth=".7"/></G>}
    <Ellipse cx="30" cy="34" rx="4" ry="1.7" fill="#C87978" opacity=".18"/><Ellipse cx="50" cy="34" rx="4" ry="1.7" fill="#C87978" opacity=".18"/><Path d="M29 24q4-3 8-.5m4 0q4-3 8 .5" fill="none" stroke="#35232C" strokeWidth="1.8" strokeLinecap="round"/>
    <Ellipse cx="33" cy="28" rx="3.8" ry="3" fill="#FFF"/><Ellipse cx="47" cy="28" rx="3.8" ry="3" fill="#FFF"/>
    <Circle cx="34" cy="28" r="1.8" fill="#2B2330"/><Circle cx="46" cy="28" r="1.8" fill="#2B2330"/>
    <Path d="m40 30-1 5q1 1 2 0" fill="none" stroke="#B67360" strokeWidth="1.2" strokeLinecap="round"/><Path d="M36 39q5 4 10 0" fill="none" stroke="#8E4C54" strokeWidth="2" strokeLinecap="round"/>
    {appearance?.accessory===3&&<G fill="none" stroke="#211D2A" strokeWidth="1.5"><Rect x="27" y="25" width="11" height="7" rx="3"/><Rect x="42" y="25" width="11" height="7" rx="3"/><Path d="M38 27h4"/></G>}
    {appearance?.accessory===1&&<Path d="m41 4 1.5 3 3.4.5-2.5 2.4.6 3.4-3-1.7-3 1.7.6-3.4-2.5-2.4 3.4-.5Z" fill="#FFE436" stroke="#FFF2A0" strokeWidth=".6"/>}
  </Svg>;
}

