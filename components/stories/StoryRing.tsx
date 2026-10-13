import React from 'react';
import {View} from 'react-native';
import type {RingState} from '../../lib/stories';
/** Ring around an avatar: gradient-ish purple when unseen, grey when seen, none without stories. */
export function StoryRing({state,size,children}:{state:RingState;size:number;children:React.ReactNode}){
 const color=state==='unseen'?'#B04CFF':state==='seen'?'#5F5A66':'transparent';
 return <View accessibilityLabel={state==='unseen'?'Nieuw verhaal':state==='seen'?'Verhaal bekeken':undefined} style={{width:size+10,height:size+10,borderRadius:(size+10)/2,borderWidth:3,borderColor:color,alignItems:'center',justifyContent:'center'}}>{children}</View>;
}
