import {useEffect,useMemo,useRef} from 'react';
import type {GestureResponderEvent} from 'react-native';
import {router} from 'expo-router';
import {TAB_HREF,swipeTarget,type SnapTab} from '../lib/snap-nav';

type Opts={up?:boolean;enabled?:boolean;/** Ignore swipes that start above this y (horizontal carousels / filter chips live there). */minStartY?:number};
type Pt={pageX?:number;pageY?:number};
type Ne=Pt&{touches?:ArrayLike<Pt>;changedTouches?:ArrayLike<Pt>};
/** Native gives pageX on the event itself; on web nativeEvent is the DOM TouchEvent (only its touch lists carry coordinates). */
function point(ne:Ne,list:'touches'|'changedTouches'):{x:number;y:number}|null{const t=ne[list]?.[0]??ne;return t.pageX==null||t.pageY==null?null:{x:t.pageX,y:t.pageY}}
/**
 * Snapchat pager feel: swipe left/right anywhere on a tab screen to move to the neighbouring tab (camera: swipe up → Herinneringen).
 * Plain touch start/end listeners instead of a PanResponder: they also see touches that a ScrollView / FlatList / Pressable
 * underneath owns (on web the responder never reached the screen inside lists), and they never steal a vertical scroll.
 */
export function useTabSwipe(from:SnapTab,opts:Opts={}){
 const state=useRef(opts),start=useRef<{x:number;y:number;t:number}|null>(null),last=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{state.current=opts});
 return useMemo(()=>({
  onTouchStart:(e:GestureResponderEvent)=>{const ne=e.nativeEvent as unknown as Ne;const p=point(ne,'touches');start.current=(ne.touches?.length??1)>1||!p?null:{...p,t:Date.now()};last.current=p},
  onTouchMove:(e:GestureResponderEvent)=>{const ne=e.nativeEvent as unknown as Ne;if((ne.touches?.length??1)>1){start.current=null;return}last.current=point(ne,'touches')??last.current},
  onTouchEnd:(e:GestureResponderEvent)=>{const s=start.current;start.current=null;const o=state.current;if(!s||o.enabled===false||s.y<(o.minStartY??0))return;
   const end=point(e.nativeEvent as unknown as Ne,'changedTouches')??last.current;if(!end)return;
   const dx=end.x-s.x,dy=end.y-s.y,vx=dx/Math.max(1,Date.now()-s.t);
   const r=swipeTarget(from,dx,dy,vx,{up:o.up});if(!r)return;if(r.kind==='memories')router.push('/memories');else router.navigate(TAB_HREF[r.tab] as never)},
  onTouchCancel:()=>{start.current=null},
 }),[from]);
}
