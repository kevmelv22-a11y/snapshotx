import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Circle, Defs, Ellipse, G, Line, Mask, Path, Rect} from 'react-native-svg';
import type {PhotoFilterId} from '../lib/photo-filters';

/** Original, fixed-position photo artwork. This does not detect or track faces. */
export function PhotoLookOverlay({filterId, preview = false}: {filterId: PhotoFilterId; preview?: boolean}) {
  if (!['dog', 'cat', 'rabbit', 'balaclava', 'sunglasses', 'crown', 'hearts'].includes(filterId)) return null;

  return <View pointerEvents="none" style={preview ? styles.preview : styles.onPhoto}>
    <Svg width="100%" height="100%" viewBox="0 0 300 330">
      {filterId === 'dog' && <G>
        <Path d="M62 82 Q12 37 30 153 Q43 178 86 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
        <Path d="M238 82 Q288 37 270 153 Q257 178 214 141 Z" fill="#9A5A31" stroke="#503020" strokeWidth="5"/>
        <Path d="M52 98 Q34 74 43 137 L69 126 Z M248 98 Q266 74 257 137 L231 126 Z" fill="#DFA783"/>
        <Ellipse cx="150" cy="210" rx="33" ry="23" fill="#B97850" opacity=".82"/>
        <Path d="M133 203 Q150 189 167 203 Q169 222 150 226 Q131 222 133 203 Z" fill="#39231F"/>
        <Path d="M150 226 Q150 241 137 241 M150 226 Q150 241 163 241" stroke="#39231F" strokeWidth="4" fill="none" strokeLinecap="round"/>
      </G>}
      {filterId === 'cat' && <G>
        <Path d="M54 139 L61 34 Q66 25 77 42 L115 83 M246 139 L239 34 Q234 25 223 42 L185 83" fill="#5D405F" stroke="#E5A6CD" strokeWidth="7" strokeLinejoin="round"/>
        <Path d="M73 64 L80 111 L106 91 M227 64 L220 111 L194 91" fill="#F4A5C6"/>
        <Path d="M139 213 Q150 204 161 213 L150 225 Z" fill="#EC93AC"/>
        <Line x1="121" y1="228" x2="50" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
        <Line x1="121" y1="235" x2="54" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
        <Line x1="179" y1="228" x2="250" y2="215" stroke="#F9F0F3" strokeWidth="4"/>
        <Line x1="179" y1="235" x2="246" y2="244" stroke="#F9F0F3" strokeWidth="4"/>
      </G>}
      {filterId === 'rabbit' && <G>
        <Path d="M81 115 Q43 -34 70 16 Q105 32 113 112 M219 115 Q257 -34 230 16 Q195 32 187 112" fill="#E9E4F0" stroke="#BDB2CE" strokeWidth="5"/>
        <Path d="M82 94 Q63 12 76 34 L98 105 M218 94 Q237 12 224 34 L202 105" fill="#F6AECF"/>
        <Ellipse cx="150" cy="216" rx="13" ry="9" fill="#F3A0C4"/>
        <Path d="M150 225 L150 239 M135 238 Q150 248 165 238" stroke="#F3A0C4" strokeWidth="4" fill="none" strokeLinecap="round"/>
      </G>}
      {filterId === 'balaclava' && <G>
        <Defs><Mask id="sx-balaclava-cutouts"><Rect x="0" y="0" width="300" height="330" fill="white"/>
          <Ellipse cx="105" cy="167" rx="36" ry="25" fill="black"/><Ellipse cx="195" cy="167" rx="36" ry="25" fill="black"/>
          <Ellipse cx="150" cy="247" rx="32" ry="17" fill="black"/></Mask></Defs>
        <Path d="M60 91 Q150 13 240 91 Q278 151 247 273 Q216 317 150 320 Q84 317 53 273 Q22 151 60 91 Z"
          fill="#171722" stroke="#515167" strokeWidth="6" mask="url(#sx-balaclava-cutouts)"/>
        <Path d="M72 113 Q150 54 228 113" stroke="#696979" strokeWidth="5" fill="none" opacity=".65"/>
      </G>}
      {filterId === 'sunglasses' && <G>
        <Path d="M52 154 L105 157 Q137 154 140 178 Q138 212 107 219 Q68 221 58 188 Z M248 154 L195 157 Q163 154 160 178 Q162 212 193 219 Q232 221 242 188 Z"
          fill="#181924" stroke="#D6B365" strokeWidth="7"/>
        <Path d="M140 173 Q150 164 160 173 M52 162 L27 150 M248 162 L273 150" fill="none" stroke="#D6B365" strokeWidth="8" strokeLinecap="round"/>
        <Path d="M70 175 L113 169 M181 175 L224 169" stroke="#8B8FAE" opacity=".55" strokeWidth="5"/>
      </G>}
      {filterId === 'crown' && <G>
        <Path d="M50 113 L38 34 L94 71 L150 13 L206 71 L262 34 L250 113 Z" fill="#FFC83D" stroke="#9C6A1B" strokeWidth="6" strokeLinejoin="round"/>
        <Rect x="50" y="110" width="200" height="24" rx="8" fill="#EAAA22" stroke="#9C6A1B" strokeWidth="5"/>
        <Circle cx="150" cy="91" r="12" fill="#C92A79"/><Circle cx="84" cy="97" r="8" fill="#7545C4"/><Circle cx="216" cy="97" r="8" fill="#7545C4"/>
      </G>}
      {filterId === 'hearts' && <G fill="#F451A6" stroke="#FFF0F8" strokeWidth="3">
        <Path d="M54 118 C23 83 7 125 54 155 C101 125 85 83 54 118 Z"/>
        <Path d="M245 91 C215 56 198 99 245 129 C292 99 275 56 245 91 Z"/>
        <Path d="M240 232 C216 204 201 239 240 266 C279 239 264 204 240 232 Z"/>
        <Path d="M89 254 C71 231 54 259 89 281 C124 259 107 231 89 254 Z"/>
      </G>}
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  onPhoto: {position: 'absolute', top: '12%', left: '10%', width: '80%', aspectRatio: 300 / 330},
  preview: {position: 'absolute', top: 1, left: 3, width: '90%', aspectRatio: 300 / 330},
});
