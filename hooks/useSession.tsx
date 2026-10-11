import React, {createContext,useContext,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {Alert,AppState} from 'react-native';
import * as Device from 'expo-device';
import {supabase} from '../lib/supabase';
import {getInstallationId} from '../lib/deviceIdentity';

const SessionContext=createContext<{session:Session|null;ready:boolean}>({session:null,ready:false});
export function SessionProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
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
          if(event==='SIGNED_IN')Alert.alert(error?'Toegang controleren mislukt':'Account geblokkeerd',error?'Probeer het later opnieuw.':'Je account, IP of apparaat heeft geen toegang tot SNAPLION.');
          await supabase.auth.signOut();
          return;
        }
        setSession(current);setReady(true);
      }).catch(async()=>{
        if(!active)return;
        setSession(null);setReady(true);
        if(event==='SIGNED_IN')Alert.alert('Toegang controleren mislukt','Probeer het later opnieuw.');
        await supabase.auth.signOut();
      });
    });
    const sub=AppState.addEventListener('change',state=>{if(state==='active')supabase.auth.startAutoRefresh();else supabase.auth.stopAutoRefresh();});
    return ()=>{active=false;subscription.unsubscribe();sub.remove();};
  },[]);
  return <SessionContext.Provider value={{session,ready}}>{children}</SessionContext.Provider>;
}
export const useSession=()=>useContext(SessionContext);
