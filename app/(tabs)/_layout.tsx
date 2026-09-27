import React,{useCallback,useEffect,useState} from 'react';
import {Tabs,Redirect,usePathname} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSession} from '../../hooks/useSession';
import {loadChatRows} from '../../lib/chat-list';
import {supabase} from '../../lib/supabase';
import {C} from '../../lib/theme';

export default function TabLayout(){
 const {session,ready}=useSession(),insets=useSafeAreaInsets(),pathname=usePathname(),uid=session?.user.id,[unread,setUnread]=useState(0);
 const refresh=useCallback(async()=>{if(!uid)return;try{setUnread((await loadChatRows(uid)).filter(x=>x.unread).length)}catch{/* Chat screen displays the error. */}},[uid]);
 useEffect(()=>{if(!uid)return;const ch=supabase.channel(`sx-tab-badge-${uid}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'sx_messages'},()=>void refresh()).subscribe();const timer=setInterval(()=>void refresh(),30000);return()=>{clearInterval(timer);void supabase.removeChannel(ch)}},[uid,refresh]);
 useEffect(()=>{if(!uid)return;const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer)},[pathname,uid,refresh]);
 if(ready&&!session)return <Redirect href="/(auth)/login"/>;
 const items=[['map','map-outline','Map'],['chats','chatbubbles','Chat'],['index','camera-outline','Camera'],['friends','people-outline','Vrienden'],['videos','play-outline','Video’s']] as const;
 return <Tabs screenOptions={{headerShown:false,tabBarStyle:{backgroundColor:'#050508',borderTopColor:'#4A3A56',borderTopWidth:1,height:58+insets.bottom,paddingTop:5,paddingBottom:Math.max(insets.bottom,6)},tabBarActiveTintColor:'#C43CE5',tabBarInactiveTintColor:'#BFB8C6',tabBarLabelStyle:{fontSize:10,fontWeight:'700'}}}>
  {items.map(([name,icon,label])=><Tabs.Screen key={name} name={name} options={{title:label,tabBarIcon:({color,size})=><Ionicons name={icon} color={color} size={size}/>,tabBarBadge:name==='chats'&&unread?unread:undefined,tabBarBadgeStyle:{backgroundColor:'#AF21D3',color:C.text,fontSize:11}}}/>)}
  <Tabs.Screen name="stories" options={{href:null}}/>
  <Tabs.Screen name="profile" options={{href:null}}/>
 </Tabs>;
}
