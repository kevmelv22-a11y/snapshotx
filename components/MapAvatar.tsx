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
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Snaplion ruimte-avatar">
    <Circle cx="32" cy="32" r="31" fill={skies[variant]} stroke={selected ? '#FFE436' : '#E6A2EE'} strokeWidth="3"/>
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

// The marker artwork is an original full-body companion to MapAvatar. Friends
// get deterministic colors and accessories without copying any Bitmoji asset.
export function MapExplorer({id, own = false}: {id: string; own?: boolean}) {
  const hash = [...id].reduce((value, letter) => (value * 33 + letter.charCodeAt(0)) >>> 0, 9);
  const outfits = ['#DE618A', '#EF8550', '#6C55CB', '#DFB956', '#4CA7A0'];
  const skins = ['#ECC5A4', '#B87F62', '#F1D5BD', '#855646', '#D49D72'];
  const hair = ['#2B2332', '#4D302C', '#342535', '#332C30', '#5E3A29'];
  const item = hash % outfits.length;
  const cap = (hash >>> 5) % 2 === 0;
  return <Svg width={82} height={119} viewBox="0 0 82 119" accessibilityLabel={own ? 'Mijn Snaplion personage' : 'Snaplion vriend op de kaart'}>
    <Ellipse cx="41" cy="114" rx="30" ry="4" fill="#05050A" opacity="0.55"/>
    <Path d="M26 77l-2 29M55 77l2 29" stroke="#292631" strokeWidth="12" strokeLinecap="round"/>
    <Ellipse cx="24" cy="108" rx="12" ry="5" fill={own ? '#FFE436' : '#F7F5FA'}/>
    <Ellipse cx="58" cy="108" rx="12" ry="5" fill={own ? '#FFE436' : '#F7F5FA'}/>
    <Path d="M16 52q3-12 25-12t25 12l4 28q-12 11-29 11T12 80Z" fill={outfits[item]}/>
    <Path d="M12 55l-5 20M70 55l5 20" stroke={outfits[item]} strokeWidth="10" strokeLinecap="round"/>
    <Circle cx="7" cy="79" r="5" fill={skins[item]}/><Circle cx="75" cy="79" r="5" fill={skins[item]}/>
    <Ellipse cx="41" cy="30" rx="21" ry="23" fill={skins[item]}/>
    <Path d="M19 27Q17 5 41 5q25 0 22 23-7-3-12-12-11 10-32 11Z" fill={hair[item]}/>
    {cap && <Path d="M21 18Q28 4 46 7q14 2 18 15l-10 2q-17-8-33-3Z" fill="#2E2B53"/>}
    <Circle cx="33" cy="31" r="2.2" fill="#29212A"/><Circle cx="49" cy="31" r="2.2" fill="#29212A"/>
    <Path d="M35 40q6 5 12 0" fill="none" stroke="#8E4C54" strokeWidth="2" strokeLinecap="round"/>
    <Ellipse cx="41" cy="67" rx="13" ry="7" fill="#231C38" opacity="0.12"/>
    <Circle cx="41" cy="65" r="3" fill="#FFE436"/>
  </Svg>;
}
