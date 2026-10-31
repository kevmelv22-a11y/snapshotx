import {useEffect,useRef,useState} from 'react';
import {Platform} from 'react-native';
import {dragHasFiles,pickDroppedMedia,type DropFileLike} from '../lib/web-drop';

type WebFile=DropFileLike&Blob;
type DT={types?:readonly string[];files?:ArrayLike<WebFile>;items?:ArrayLike<{kind:string;getAsFile:()=>WebFile|null}>};
type Ev={preventDefault:()=>void;dataTransfer?:DT|null;clipboardData?:DT|null};

/**
 * Web only (Snapchat Web): drag a photo/video onto the open chat or paste one with Ctrl/⌘+V.
 * Calls onMedia with a blob: URL (uploadMedia reads it via fetch) or onError with a Dutch reason.
 * Text pastes are left alone. Returns whether files are being dragged over the page (for the drop overlay).
 */
export function useWebMediaDrop(enabled:boolean,onMedia:(uri:string,kind:'photo'|'video')=>void,onError:(msg:string)=>void){
 const [dragging,setDragging]=useState(false),cb=useRef({onMedia,onError});
 useEffect(()=>{cb.current={onMedia,onError}},[onMedia,onError]);
 useEffect(()=>{
  const doc=(globalThis as {document?:{addEventListener:(t:string,l:(e:Ev)=>void)=>void;removeEventListener:(t:string,l:(e:Ev)=>void)=>void}}).document;
  if(Platform.OS!=='web'||!enabled||!doc)return;
  let depth=0;
  const take=(files:WebFile[])=>{const pick=pickDroppedMedia(files);if(!pick)return false;if(!pick.ok){cb.current.onError(pick.error);return true}
   try{cb.current.onMedia(URL.createObjectURL(files[pick.index]),pick.kind)}catch{cb.current.onError('Bestand kon niet worden gelezen.')}return true};
  const enter=(e:Ev)=>{if(!dragHasFiles(e.dataTransfer?.types))return;e.preventDefault();depth++;setDragging(true)};
  const over=(e:Ev)=>{if(dragHasFiles(e.dataTransfer?.types))e.preventDefault()};
  const leave=(e:Ev)=>{if(!dragHasFiles(e.dataTransfer?.types))return;depth=Math.max(0,depth-1);if(!depth)setDragging(false)};
  const drop=(e:Ev)=>{if(!dragHasFiles(e.dataTransfer?.types))return;e.preventDefault();depth=0;setDragging(false);take(Array.from(e.dataTransfer?.files??[]))};
  const paste=(e:Ev)=>{const items=Array.from(e.clipboardData?.items??[]).filter(i=>i.kind==='file');const files=items.map(i=>i.getAsFile()).filter((f):f is WebFile=>!!f);if(!files.length)return;if(take(files))e.preventDefault()};
  const on:[string,(e:Ev)=>void][]=[['dragenter',enter],['dragover',over],['dragleave',leave],['drop',drop],['paste',paste]];
  on.forEach(([t,l])=>doc.addEventListener(t,l));
  return()=>{on.forEach(([t,l])=>doc.removeEventListener(t,l));setDragging(false)};
 },[enabled]);
 return dragging;
}
