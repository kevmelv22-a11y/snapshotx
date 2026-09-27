import React, {createContext,useContext,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {AppState} from 'react-native';
import {supabase} from '../lib/supabase';
const SessionContext=createContext<{session:Session|null;ready:boolean}>({session:null,ready:false});
export function SessionProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setReady(true);}}).catch(()=>setReady(true));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,current)=>{if(active){setSession(current);setReady(true);}});
    const sub=AppState.addEventListener('change',state=>{if(state==='active')supabase.auth.startAutoRefresh();else supabase.auth.stopAutoRefresh();});
    return ()=>{active=false;subscription.unsubscribe();sub.remove();};
  },[]);
  return <SessionContext.Provider value={{session,ready}}>{children}</SessionContext.Provider>;
}
export const useSession=()=>useContext(SessionContext);
