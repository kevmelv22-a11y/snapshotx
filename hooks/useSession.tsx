import React, {createContext,useContext,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {AppState} from 'react-native';
import * as Device from 'expo-device';
import {supabase} from '../lib/supabase';
import {getInstallationId} from '../lib/deviceIdentity';

const SessionContext=createContext<{session:Session|null;ready:boolean}>({session:null,ready:false});
export function SessionProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setReady(true);}}).catch(()=>setReady(true));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,current)=>{
      if(active){setSession(current);setReady(true);}
      if(event==='SIGNED_IN'&&current){
        // Run after the auth callback returns so this RPC cannot deadlock the auth lock.
        void Promise.resolve().then(async()=>{
          const device_id=await getInstallationId();
          const {error}=await supabase.functions.invoke('record-login-history',{body:{device_id,device_label:Device.modelName||Device.deviceName||null}});
          if(error) console.warn('Could not record login history',error.message);
        });
      }
    });
    const sub=AppState.addEventListener('change',state=>{if(state==='active')supabase.auth.startAutoRefresh();else supabase.auth.stopAutoRefresh();});
    return ()=>{active=false;subscription.unsubscribe();sub.remove();};
  },[]);
  return <SessionContext.Provider value={{session,ready}}>{children}</SessionContext.Provider>;
}
export const useSession=()=>useContext(SessionContext);
