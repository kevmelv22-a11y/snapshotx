import React,{useCallback,useEffect,useState} from 'react';
import {Platform,useWindowDimensions} from 'react-native';
import {isSplitLayout} from '../../lib/web-layout';
import {setTitleUnread} from '../../lib/web-title';
import {SideRail} from '../../components/web/SideRail';
import {WebNotifier} from '../../components/web/WebNotifier';
import {Tabs,Redirect,usePathname} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSession} from '../../hooks/useSession';
import {loadChatRows} from '../../lib/chat-list';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';
import {TAB_LABEL} from '../../lib/snap-nav';

export default function TabLayout(){
 const {session,ready}=useSession(),insets=useSafeAreaInsets(),pathname=usePathname(),uid=session?.user.id,[unread,setUnread]=useState(0);
 const refresh=useCallback(async()=>{if(!uid)return;try{setUnread((await loadChatRows(uid)).filter(x=>x.unread).length)}catch{/* Chat screen displays the error. */}},[uid]);
 useEffect(()=>{if(!uid)return;const ch=supabase.channel(`sx-tab-badge-${uid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_messages'},()=>void refresh()).subscribe();const timer=setInterval(()=>void refresh(),30000);return()=>{clearInterval(timer);void supabase.removeChannel(ch)}},[uid,refresh]);
 useEffect(()=>{if(!uid)return;const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer)},[pathname,uid,refresh]);
 useEffect(()=>{setTitleUnread(uid?unread:0)},[uid,unread]);
 useEffect(()=>()=>setTitleUnread(0),[]);
 const {width}=useWindowDimensions(),desktop=isSplitLayout(width,Platform.OS);
 if(ready&&!session)return <Redirect href="/(auth)/login"/>;
 // Snapchat order: Kaart · Chat · Camera · Verhalen · Spotlight (Vrienden is reached via search / add-friend buttons).
 const items=[['map','location-outline',TAB_LABEL.map],['chats','chatbubble-outline',TAB_LABEL.chats],['index','camera-outline',TAB_LABEL.index],['stories','people-outline',TAB_LABEL.stories],['videos','play-outline',TAB_LABEL.videos]] as const;
 return <>{Platform.OS==='web'&&!!uid&&<WebNotifier uid={uid}/>}<Tabs tabBar={desktop?props=><SideRail {...props} items={items.map(([name,icon,label])=>({name,icon,label}))} badge={{name:'chats',count:unread}}/>:undefined} screenOptions={{headerShown:false,tabBarHideOnKeyboard:Platform.OS==='android',tabBarPosition:desktop?'left':'bottom',tabBarStyle:desktop?{backgroundColor:'#050508',borderRightColor:'#4A3A56',borderRightWidth:1,width:96,paddingTop:12}:{backgroundColor:'#050508',borderTopColor:'#4A3A56',borderTopWidth:1,height:64+insets.bottom,paddingTop:6,paddingBottom:Math.max(insets.bottom,8)},tabBarActiveTintColor:'#C43CE5',tabBarInactiveTintColor:'#BFB8C6',tabBarLabelStyle:{fontSize:10,fontWeight:'700'}}}>
  {items.map(([name,icon,label])=><Tabs.Screen key={name} name={name} options={{title:label,tabBarIcon:({color,size})=><Ionicons name={icon} color={color} size={size}/>,tabBarBadge:name==='chats'&&unread?unread:undefined,tabBarBadgeStyle:{backgroundColor:'#AF21D3',color:C.text,fontSize:11}}}/>)}
  <Tabs.Screen name="friends" options={{href:null}}/>
  <Tabs.Screen name="profile" options={{href:null}}/>
 </Tabs></>;
}
