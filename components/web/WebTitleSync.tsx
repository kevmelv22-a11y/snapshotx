import {useEffect,useState} from 'react';
import {Platform} from 'react-native';
import {usePathname} from 'expo-router';
import {getTitleUnread,onTitleUnread,pageTitle} from '../../lib/web-title';

/** Web only: keeps the browser tab title in sync with the route + unread chats ("(2) Chat • SnapShot X"). */
export function WebTitleSync(){
 const pathname=usePathname(),[unread,setUnread]=useState(getTitleUnread());
 useEffect(()=>onTitleUnread(setUnread),[]);
 useEffect(()=>{if(Platform.OS!=='web')return;const doc=(globalThis as {document?:{title:string}}).document;if(!doc||doc.title.startsWith('📞'))return;doc.title=pageTitle(pathname,unread)},[pathname,unread]);
 return null;
}
