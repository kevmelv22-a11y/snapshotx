import {useCallback,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {friendlyError,isUnavailable} from '../lib/db-errors';
import {DEFAULT_NOTIFY_PREFS,NOTIFY_STORAGE_KEY,normalizeNotifyPrefs,setNotifyPref,type NotifyPrefs} from '../lib/notification-prefs';

/** Notification switches for the signed-in account: device copy first (instant), then the server copy wins.
 *  serverReady=false means sx_preferences.notify_prefs is not there yet: changes are kept on this device only. */
export function useNotifyPrefs(uid:string|undefined){
 const [prefs,setPrefs]=useState<NotifyPrefs>(DEFAULT_NOTIFY_PREFS),[loading,setLoading]=useState(true),[serverReady,setServerReady]=useState(true),[error,setError]=useState('');
 const latest=useRef(prefs);latest.current=prefs;
 useEffect(()=>{if(!uid)return;let active=true;void (async()=>{
  const local=await AsyncStorage.getItem(NOTIFY_STORAGE_KEY(uid)).catch(()=>null);
  if(active&&local)setPrefs(normalizeNotifyPrefs(local));
  const {data,error:e}=await supabase.from('sx_preferences').select('notify_prefs').eq('user_id',uid).maybeSingle();
  if(!active)return;
  if(e){setServerReady(false);if(!isUnavailable(e))setError(friendlyError(e,'Meldingen'))}
  else if(data&&data.notify_prefs&&typeof data.notify_prefs==='object'){const next=normalizeNotifyPrefs(data.notify_prefs);setPrefs(next);void AsyncStorage.setItem(NOTIFY_STORAGE_KEY(uid),JSON.stringify(next)).catch(()=>{})}
  setLoading(false);
 })();return()=>{active=false}},[uid]);
 const update=useCallback(async(key:keyof NotifyPrefs,value:boolean)=>{
  if(!uid)return;const previous=latest.current,next=setNotifyPref(previous,key,value);setPrefs(next);setError('');
  await AsyncStorage.setItem(NOTIFY_STORAGE_KEY(uid),JSON.stringify(next)).catch(()=>{});
  if(!serverReady)return;
  const {error:e}=await supabase.from('sx_preferences').upsert({user_id:uid,notify_prefs:next});
  if(e){if(isUnavailable(e))setServerReady(false);else{setPrefs(previous);void AsyncStorage.setItem(NOTIFY_STORAGE_KEY(uid),JSON.stringify(previous)).catch(()=>{});setError(friendlyError(e,'Meldingen opslaan'))}}
 },[uid,serverReady]);
 return {prefs,loading,serverReady,error,update};
}
