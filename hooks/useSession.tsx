import React, {createContext,useContext,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {AppState} from 'react-native';
import * as Device from 'expo-device';
import {supabase} from '../lib/supabase';
import {getInstallationId} from '../lib/deviceIdentity';
import {useConfirmDialog} from '../components/ConfirmDialog';
import {noticeRequest} from '../lib/confirm-flow';
import {accessNotice,accessNoticeFor,type AccessNoticeKind} from '../lib/access-notice';

const SessionContext=createContext<{session:Session|null;ready:boolean}>({session:null,ready:false});
export function SessionProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  // Cross-platform notice (Alert.alert shows nothing on web). Rendered below, outside the navigator.
  const {ask:askNotice,dialog:noticeDialog}=useConfirmDialog();
  useEffect(()=>{
    let active=true;
    const showNotice=(kind:AccessNoticeKind|null)=>{if(!kind)return;const n=accessNotice(kind);askNotice(noticeRequest(n.title,n.message),()=>null);};
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,current)=>{
      if(!current){if(active){setSession(null);setReady(true)}return;}
      if(event!=='SIGNED_IN'&&event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED'){
        if(active){setSession(current);setReady(true)}return;
      }
      if(active)setReady(false);
      // Do network work only after the auth callback releases Supabase's auth lock.
      void Promise.resolve().then(async()=>{
        if(event==='SIGNED_IN'){
          const device_id=await getInstallationId();
          const {error}=await supabase.functions.invoke('record-login-history',{body:{device_id,device_label:Device.modelName||Device.deviceName||null}});
          if(error)console.warn('Could not record login history',error.message);
        }
        const {data:allowed,error}=await supabase.rpc('sx_check_app_access');
        if(!active)return;
        if(error||allowed!==true){
          setSession(null);setReady(true);
          showNotice(accessNoticeFor(event,!!error,allowed));
          await supabase.auth.signOut();
          return;
        }
        setSession(current);setReady(true);
      }).catch(async()=>{
        if(!active)return;
        setSession(null);setReady(true);
        showNotice(accessNoticeFor(event,true,null));
        await supabase.auth.signOut();
      });
    });
    const sub=AppState.addEventListener('change',state=>{if(state==='active')supabase.auth.startAutoRefresh();else supabase.auth.stopAutoRefresh();});
    return ()=>{active=false;subscription.unsubscribe();sub.remove();};
  },[askNotice]);
  return <SessionContext.Provider value={{session,ready}}>{children}{noticeDialog}</SessionContext.Provider>;
}
export const useSession=()=>useContext(SessionContext);
