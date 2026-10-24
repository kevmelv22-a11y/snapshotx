import React from 'react';
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { CategoryTab } from '../../lib/avatar/outfit';

/** Silhouette icons the icon fonts don't have (broek, jurk, jas). */
function Silhouette({ d, color, size }: { d: string; color: string; size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={d} fill={color}/></Svg>;
}
const PANTS = 'M6 2h12l1.2 20h-5L12 9.5 9.8 22h-5Z';
const DRESS = 'M9 2h1.4l1.6 3 1.6-3H15l-.6 5.2 1.4 3.4L19.5 21q-7.5 2-15 0l3.7-10.4 1.4-3.4Z';
const JACKET = 'M8.6 2.5 12 5l3.4-2.5 4.6 2.2 1.8 13.6-3 .8-.9-8.2V21h-5.2V7.5L12 6.4l-.7 1.1V21H6.1v-9.9l-.9 8.2-3-.8L4 4.7Z';

export function CategoryIcon({ tab, color, size = 26 }: { tab: CategoryTab; color: string; size?: number }) {
  switch (tab) {
    case 'featured': return <Ionicons name="flash" size={size} color={color}/>;
    case 'all': return <MaterialCommunityIcons name="hanger" size={size + 2} color={color}/>;
    case 'top': return <Ionicons name="shirt" size={size} color={color}/>;
    case 'bottom': return <Silhouette d={PANTS} color={color} size={size}/>;
    case 'dress': return <Silhouette d={DRESS} color={color} size={size}/>;
    case 'shoes': return <MaterialCommunityIcons name="shoe-sneaker" size={size + 2} color={color}/>;
    case 'socks': return <FontAwesome6 name="socks" size={size - 4} color={color}/>;
    case 'bag': return <Ionicons name="bag-handle" size={size} color={color}/>;
    case 'outerwear': return <Silhouette d={JACKET} color={color} size={size}/>;
    case 'hat': return <MaterialCommunityIcons name="hat-fedora" size={size + 2} color={color}/>;
    case 'accessory': return <Ionicons name="mic" size={size} color={color}/>;
    case 'glasses': return <MaterialCommunityIcons name="sunglasses" size={size + 2} color={color}/>;
  }
}
