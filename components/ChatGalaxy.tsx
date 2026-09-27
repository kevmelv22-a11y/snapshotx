import React from 'react';
import {useWindowDimensions} from 'react-native';
import Svg,{Circle,Defs,Ellipse,LinearGradient,RadialGradient,Rect,Stop} from 'react-native-svg';

const stars=Array.from({length:82},(_,i)=>({
  x:((i*73+17)%101)/100,
  y:((i*47+31)%101)/100,
  r:i%7===0?1.15:.55,
  opacity:i%5===0?.45:.18,
}));

export function ChatGalaxy(){const {width,height}=useWindowDimensions();return <Svg pointerEvents="none" width={width} height={height} style={{position:'absolute',top:0,left:0}}>
  <Defs>
    <LinearGradient id="night" x1="0" y1="0" x2="0.3" y2="1"><Stop offset="0" stopColor="#21123C"/><Stop offset="0.4" stopColor="#111126"/><Stop offset="0.83" stopColor="#08090E"/><Stop offset="1" stopColor="#06070C"/></LinearGradient>
    <RadialGradient id="nebula"><Stop offset="0" stopColor="#8446BC" stopOpacity=".32"/><Stop offset="1" stopColor="#52208F" stopOpacity="0"/></RadialGradient>
    <RadialGradient id="blue"><Stop offset="0" stopColor="#2B6FA9" stopOpacity=".22"/><Stop offset="1" stopColor="#2B6FA9" stopOpacity="0"/></RadialGradient>
  </Defs>
  <Rect width={width} height={height} fill="url(#night)"/>
  <Ellipse cx={width*.67} cy={height*.19} rx={width*.62} ry={height*.30} fill="url(#nebula)"/>
  <Ellipse cx={width*.25} cy={height*.42} rx={width*.55} ry={height*.24} fill="url(#blue)"/>
  {stars.map((star,i)=><Circle key={i} cx={star.x*width} cy={star.y*height*.82} r={star.r} fill="#E8D8FF" opacity={star.opacity}/>)}
 </Svg>}
