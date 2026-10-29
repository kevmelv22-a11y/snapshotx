import {useCallback,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '../lib/supabase';
import {friendlyError,isUnavailable} from '../lib/db-errors';
import {DEFAULT_PRIVACY_PREFS,PRIVACY_STORAGE_KEY,normalizePrivacyPrefs,type PrivacyPrefs} from '../lib/privacy-prefs';

/** "Wie kan…" choices for the signed-in account: device copy first (instant), then the server copy wins.
 *  serverReady=false means sx_preferences.privacy_prefs is not there yet: changes are kept on this device only. */
export function usePrivacyPrefs(uid:string|undefined){
 const [prefs,setPrefs]=useState<PrivacyPrefs>(DEFAULT_PRIVACY_PREFS),[loading,setLoading]=useState(true),[serverReady,setServerReady]=useState(true),[error,setError]=useState('');
 const latest=useRef(prefs);latest.current=prefs;
 useEffect(()=>{if(!uid)return;let active=true;void (async()=>{
  const local=await AsyncStorage.getItem(PRIVACY_STORAGE_KEY(uid)).catch(()=>null);
  if(active&&local)setPrefs(normalizePrivacyPrefs(local));
  const {data,error:e}=await supabase.from('sx_preferences').select('privacy_prefs').eq('user_id',uid).maybeSingle();
  if(!active)return;
  if(e){setServerReady(false);if(!isUnavailable(e))setError(friendlyError(e,'Privacy'))}
  else if(data&&data.privacy_prefs&&typeof data.privacy_prefs==='object'){const next=normalizePrivacyPrefs(data.privacy_prefs);setPrefs(next);void AsyncStorage.setItem(PRIVACY_STORAGE_KEY(uid),JSON.stringify(next)).catch(()=>{})}
  setLoading(false);
 })();return()=>{active=false}},[uid]);
 const update=useCallback(async(patch:Partial<PrivacyPrefs>)=>{
  if(!uid)return;const previous=latest.current,next=normalizePrivacyPrefs({...previous,...patch});setPrefs(next);setError('');
  await AsyncStorage.setItem(PRIVACY_STORAGE_KEY(uid),JSON.stringify(next)).catch(()=>{});
  if(!serverReady)return;
  const {error:e}=await supabase.from('sx_preferences').upsert({user_id:uid,privacy_prefs:next});
  if(e){if(isUnavailable(e))setServerReady(false);else{setPrefs(previous);void AsyncStorage.setItem(PRIVACY_STORAGE_KEY(uid),JSON.stringify(previous)).catch(()=>{});setError(friendlyError(e,'Privacy opslaan'))}}
 },[uid,serverReady]);
 return {prefs,loading,serverReady,error,update};
}
