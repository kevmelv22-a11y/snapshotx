import React from 'react';
import Svg, {Circle, Ellipse, G, Path, Rect} from 'react-native-svg';
import type {AvatarAppearance} from '../lib/avatar';

type Props = {id: string; size?: number; selected?: boolean; appearance?: AvatarAppearance};
const SKIN = ['#EBC5A3', '#F2BE91', '#CE9E79', '#A9775D', '#744737'];
const HAIR = ['#24212F', '#4D302C', '#70442E', '#BC873D', '#A8512C'];
const TOP = ['#8D51D0', '#E47B69', '#304E85', '#DDB764', '#26232C', '#6ABCAA'];
const BOTTOMS = ['#292631', '#B2B2BC', '#5E3A91', '#333142'];
const SHOES = ['#F7F5FA', '#25232B', '#FFE436'];

// SnapShot X's own small "space explorer" portraits. The ID only chooses a
// palette and hairstyle; no photo or third-party avatar asset is downloaded.
export function MapAvatar({id, size = 54, selected = false, appearance}: Props) {
  const hash = [...id].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const skies = ['#513A91', '#315B86', '#77486B', '#386963', '#775C37'];
  const suits = ['#9B62D9', '#47A3BD', '#E47B9E', '#6CC7A0', '#DDB764'];
  const skins = SKIN;
  const hair = HAIR;
  const variant = hash % skies.length;
  const tuft = (hash >>> 4) % 3;
  return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Snaplion ruimte-avatar">
    <Circle cx="32" cy="32" r="31" fill={skies[variant]} stroke={selected ? '#FFE436' : '#E6A2EE'} strokeWidth="3"/>
    <Circle cx="13" cy="15" r="1.5" fill="#FFFFFF" opacity="0.8"/>
    <Circle cx="50" cy="21" r="1" fill="#FFFFFF" opacity="0.7"/>
    <Circle cx="45" cy="8" r="1" fill="#FFFFFF" opacity="0.7"/>
    <Path d="M3 61c2-14 13-20 29-20s27 6 29 20" fill={appearance ? TOP[appearance.top] : suits[variant]}/>
    <Path d="M21 45l11 10 11-10" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.7"/>
    <Rect x="27" y="38" width="10" height="10" rx="4" fill={appearance ? skins[appearance.skin] : skins[variant]}/>
    <Ellipse cx="32" cy="29" rx="16" ry="19" fill={appearance ? skins[appearance.skin] : skins[variant]}/>
    <Path d={tuft === 0 ? 'M16 26c-2-15 6-20 17-20 13 0 18 8 15 21-6-2-8-8-11-10-4 6-11 8-21 9Z' : tuft === 1 ? 'M16 27C15 13 22 8 32 8c11 0 17 7 16 19-7-7-13-9-16-9s-9 2-16 9Z' : 'M15 27c0-13 7-20 18-20 10 0 17 7 16 20-6-1-12-5-15-10-5 7-12 9-19 10Z'} fill={appearance ? hair[appearance.hair] : hair[variant]}/>
    {appearance?.hairstyle === 3 && <Path d="M18 23q7-16 27-13 10 2 15 14-22-8-42-1Z" fill="#29274C"/>}
    <G fill="#251F2F"><Circle cx="26" cy="30" r="1.7"/><Circle cx="38" cy="30" r="1.7"/></G>
    <Path d="M28 38q4 3 8 0" fill="none" stroke="#8B555A" strokeWidth="1.5" strokeLinecap="round"/>
    <Path d="M15 27q-3 9 0 15M49 27q3 9 0 15" fill="none" stroke="#D9BDFF" strokeWidth="2" opacity="0.8"/>
    {appearance?.accessory === 3 && <Path d="M20 29h11m2 0h11M20 27q5-3 11 0v6q-5 5-11-1Zm13 0q5-3 11 0v5q-5 6-11 1Z" stroke="#252235" strokeWidth="2" fill="none"/>}
    <Circle cx="32" cy="58" r="2" fill="#FFE436"/>
  </Svg>;
}

// The marker artwork is an original full-body companion to MapAvatar. Friends
// get deterministic colors and accessories without copying any Bitmoji asset.
export function MapExplorer({id, own = false, appearance, size = 82}: {id: string; own?: boolean; appearance?: AvatarAppearance; size?: number}) {
  const hash = [...id].reduce((value, letter) => (value * 33 + letter.charCodeAt(0)) >>> 0, 9);
  const outfits = ['#DE618A', '#EF8550', '#6C55CB', '#DFB956', '#4CA7A0'];
  const skins = SKIN;
  const hair = HAIR;
  const item = hash % outfits.length;
  const cap = (hash >>> 5) % 2 === 0;
  const top = appearance ? TOP[appearance.top] : outfits[item];
  const skin = appearance ? skins[appearance.skin] : skins[item];
  const hairstyle = appearance?.hairstyle ?? (cap ? 3 : 0);
  return <Svg width={size} height={size * 119 / 82} viewBox="0 0 82 119" accessibilityLabel={own ? 'Mijn Snaplion personage' : 'Snaplion vriend op de kaart'}>
    <Ellipse cx="41" cy="114" rx="30" ry="4" fill="#05050A" opacity="0.55"/>
    {appearance?.accessory === 2 && <G fill="#42334E"><Path d="M23 50Q3 20 0 34q2 20 22 28Z"/><Path d="M59 50q20-30 23-16-2 20-22 28Z"/></G>}
    {appearance?.bottoms === 3 ? <Path d="M18 73q23 9 46 0l5 20H13Z" fill={BOTTOMS[3]}/> : <Path d="M26 77l-2 29M55 77l2 29" stroke={appearance ? BOTTOMS[appearance.bottoms] : '#292631'} strokeWidth="12" strokeLinecap="round"/>}
    <Ellipse cx="24" cy="108" rx="12" ry="5" fill={appearance ? SHOES[appearance.shoes] : own ? '#FFE436' : '#F7F5FA'}/>
    <Ellipse cx="58" cy="108" rx="12" ry="5" fill={appearance ? SHOES[appearance.shoes] : own ? '#FFE436' : '#F7F5FA'}/>
    <Path d="M16 52q3-12 25-12t25 12l4 28q-12 11-29 11T12 80Z" fill={top}/>
    {appearance?.top === 4 && <Path d="M35 45l6 19 6-19M32 43l9 11 9-11" stroke="#CF3F50" strokeWidth="3" fill="none"/>}
    <Path d="M12 55l-5 20M70 55l5 20" stroke={top} strokeWidth="10" strokeLinecap="round"/>
    <Circle cx="7" cy="79" r="5" fill={skin}/><Circle cx="75" cy="79" r="5" fill={skin}/>
    <Ellipse cx="41" cy="30" rx="21" ry="23" fill={skin}/>
    <Path d={hairstyle === 2 ? 'M18 26q-6-15 5-19 6-9 15-4 10-6 17 4 12 4 8 20-7-5-12-12-11 11-33 11Z' : hairstyle === 1 ? 'M18 27Q10 4 31 5 46-2 57 11q10 10 6 24-9-8-15-20-12 10-30 12Z' : 'M19 27Q17 5 41 5q25 0 22 23-7-3-12-12-11 10-32 11Z'} fill={appearance ? hair[appearance.hair] : hair[item]}/>
    {hairstyle === 3 && <Path d="M21 18Q28 4 46 7q14 2 18 15l-10 2q-17-8-33-3Z" fill="#2E2B53"/>}
    <Circle cx="33" cy="31" r="2.2" fill="#29212A"/><Circle cx="49" cy="31" r="2.2" fill="#29212A"/>
    <Path d="M35 40q6 5 12 0" fill="none" stroke="#8E4C54" strokeWidth="2" strokeLinecap="round"/>
    {appearance?.accessory === 3 && <G fill="none" stroke="#251B32" strokeWidth="2"><Circle cx="33" cy="31" r="7"/><Circle cx="49" cy="31" r="7"/><Path d="M40 30h2"/></G>}
    {appearance?.accessory === 1 && <Path d="M41 5l2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#FFE436"/>}
    <Ellipse cx="41" cy="67" rx="13" ry="7" fill="#231C38" opacity="0.12"/>
    <Circle cx="41" cy="65" r="3" fill="#FFE436"/>
  </Svg>;
}
