import React from 'react';
import Svg, {Circle, Ellipse, G, Path, Rect} from 'react-native-svg';

type Props = {id: string; size?: number; selected?: boolean};

// SnapShot X's own small "space explorer" portraits. The ID only chooses a
// palette and hairstyle; no photo or third-party avatar asset is downloaded.
export function MapAvatar({id, size = 54, selected = false}: Props) {
  const hash = [...id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const skies = ['#513A91', '#315B86', '#77486B', '#386963', '#775C37'];
  const suits = ['#9B62D9', '#47A3BD', '#E47B9E', '#6CC7A0', '#DDB764'];
  const skins = ['#EBC5A3', '#B57A5D', '#F4D5B5', '#895A4C', '#CE9E79'];
  const hair = ['#2D203D', '#251F2F', '#70442E', '#35202A', '#47444D'];
  const variant = hash % skies.length;
  const tuft = (hash >>> 4) % 3;
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="SnapShot X ruimte-avatar">
    <Circle cx="32" cy="32" r="31" fill={skies[variant]} stroke={selected ? '#FFE436' : '#FFFFFF'} strokeWidth="2"/>
    <Circle cx="13" cy="15" r="1.5" fill="#FFFFFF" opacity="0.8"/>
    <Circle cx="50" cy="21" r="1" fill="#FFFFFF" opacity="0.7"/>
    <Circle cx="45" cy="8" r="1" fill="#FFFFFF" opacity="0.7"/>
    <Path d="M3 61c2-14 13-20 29-20s27 6 29 20" fill={suits[variant]}/>
    <Path d="M21 45l11 10 11-10" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.7"/>
    <Rect x="27" y="38" width="10" height="10" rx="4" fill={skins[variant]}/>
    <Ellipse cx="32" cy="29" rx="16" ry="19" fill={skins[variant]}/>
    <Path d={tuft === 0 ? 'M16 26c-2-15 6-20 17-20 13 0 18 8 15 21-6-2-8-8-11-10-4 6-11 8-21 9Z' : tuft === 1 ? 'M16 27C15 13 22 8 32 8c11 0 17 7 16 19-7-7-13-9-16-9s-9 2-16 9Z' : 'M15 27c0-13 7-20 18-20 10 0 17 7 16 20-6-1-12-5-15-10-5 7-12 9-19 10Z'} fill={hair[variant]}/>
    <G fill="#251F2F"><Circle cx="26" cy="30" r="1.7"/><Circle cx="38" cy="30" r="1.7"/></G>
    <Path d="M28 38q4 3 8 0" fill="none" stroke="#8B555A" strokeWidth="1.5" strokeLinecap="round"/>
    <Path d="M15 27q-3 9 0 15M49 27q3 9 0 15" fill="none" stroke="#D9BDFF" strokeWidth="2" opacity="0.8"/>
    <Circle cx="32" cy="58" r="2" fill="#FFE436"/>
  </Svg>;
}
