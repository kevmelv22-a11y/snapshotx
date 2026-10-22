import React from 'react';
import Svg,{Path,Rect} from 'react-native-svg';
import {STATUS_COLOR,type ChatStatus} from '../../lib/chat-status';

/** Snapchat status glyph: ➤ sent / ■ received / crossed arrows screenshot / bubble idle; filled = not opened yet. */
export function StatusIcon({status,size=14}:{status:Pick<ChatStatus,'tone'|'shape'|'filled'>;size?:number}){
  const c=STATUS_COLOR[status.tone],fill=status.filled?c:'none',sw=2.2;
  const label=`status-${status.shape}-${status.tone}-${status.filled?'filled':'outline'}`;
  return <Svg width={size} height={size} viewBox="0 0 24 24" testID={label} accessibilityLabel={label}>
    {status.shape==='arrow'&&<Path d="M3.5 3.5 L21 12 L3.5 20.5 L7.5 12 Z" fill={fill} stroke={c} strokeWidth={sw} strokeLinejoin="round"/>}
    {status.shape==='square'&&<Rect x={3.5} y={3.5} width={17} height={17} rx={3} fill={fill} stroke={c} strokeWidth={sw}/>}
    {status.shape==='screenshot'&&<><Path d="M3 7 L17 7 M13 3 L17 7 L13 11" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/><Path d="M21 17 L7 17 M11 13 L7 17 L11 21" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/></>}
    {status.shape==='bubble'&&<Path d="M4 5.5 h16 a1.5 1.5 0 0 1 1.5 1.5 v9 a1.5 1.5 0 0 1 -1.5 1.5 h-9 l-4.5 3.5 v-3.5 h-2.5 a1.5 1.5 0 0 1 -1.5 -1.5 v-9 a1.5 1.5 0 0 1 1.5 -1.5 z" fill="none" stroke={c} strokeWidth={2}/>}
  </Svg>;
}
