/** Native push glue (iOS + Android): foreground banners, tap → open the right chat (also from a cold start) and a
 *  silent token refresh at sign-in when permission was already given. Renders nothing; inactive on web and in demo builds. */
import {useEffect,useRef,useState} from 'react';
import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import {router} from 'expo-router';
import {useSession} from '../hooks/useSession';
import {useNotifyPrefs} from '../hooks/useNotifyPrefs';
import {DEMO_MODE} from '../lib/supabase';
import {activeChat} from '../lib/active-chat';
import {pushRoute,shouldAutoRegister,showInForeground} from '../lib/push-logic';
import {registerPushDevice} from '../lib/push-device';

const NATIVE=Platform.OS!=='web'&&!DEMO_MODE;
if(NATIVE)Notifications.setNotificationHandler({handleNotification:async n=>{
 const show=showInForeground(n.request.content.data,activeChat());
 return {shouldShowBanner:show,shouldShowList:true,shouldPlaySound:show,shouldSetBadge:false};
}});

export function PushSync(){
 const {session,ready}=useSession(),uid=session?.user.id;
 const {prefs,loading}=useNotifyPrefs(NATIVE?uid:undefined);
 const [pending,setPending]=useState<{route:string}|null>(null),handled=useRef<string|null>(null);
 // Taps: while running + the one that launched the app (cold start). Each response is handled once.
 useEffect(()=>{if(!NATIVE)return;
  const take=(r:Notifications.NotificationResponse|null)=>{if(!r||r.actionIdentifier!==Notifications.DEFAULT_ACTION_IDENTIFIER)return;
   const id=r.notification.request.identifier;if(handled.current===id)return;handled.current=id;
   const route=pushRoute(r.notification.request.content.data);if(route)setPending({route})};
  take(Notifications.getLastNotificationResponse());Notifications.clearLastNotificationResponse();
  const sub=Notifications.addNotificationResponseReceivedListener(take);return()=>sub.remove()},[]);
 // Navigate once signed in (a cold-start tap arrives before the session is restored).
 useEffect(()=>{if(!pending||!ready||!uid)return;const t=setTimeout(()=>{setPending(null);try{router.push(pending.route as never)}catch(e){console.warn('[push] open',e)}},0);return()=>clearTimeout(t)},[pending,ready,uid]);
 // Silent refresh: tokens rotate (reinstall, restore); never prompts here.
 useEffect(()=>{if(!NATIVE||!uid||loading)return;let on=true;void (async()=>{try{
  const p=await Notifications.getPermissionsAsync();
  if(on&&shouldAutoRegister({os:Platform.OS,demo:DEMO_MODE,permission:p.status,masterOn:prefs.enabled}))await registerPushDevice(uid,{prompt:false});
 }catch(e){console.warn('[push] refresh',e)}})();return()=>{on=false}},[uid,loading,prefs.enabled]);
 return null;
}
