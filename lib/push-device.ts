/** This device's push registration (iOS + Android). Shared by Meldingen › Toestel registreren, the silent refresh at
 *  sign-in (components/PushSync.tsx) and Uitloggen. Pure rules live in lib/push-logic.ts. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {Platform} from 'react-native';
import {supabase} from './supabase';
import {ANDROID_CHANNELS} from './backend/push';
import {isValidExpoToken} from './backend/push';
import {pushDeniedText,pushTokenRow,signOutThisDevice} from './push-logic';

const TOKEN_KEY='sx-push-token-v1';

/** Android 8+: channels must exist before the permission prompt (Android 13 only shows the prompt once a channel exists). */
export async function ensureAndroidChannels():Promise<void>{
 if(Platform.OS!=='android')return;
 for(const c of ANDROID_CHANNELS)await Notifications.setNotificationChannelAsync(c.id,{name:c.name,description:c.description,
  importance:c.importance==='high'?Notifications.AndroidImportance.HIGH:Notifications.AndroidImportance.DEFAULT,
  lightColor:'#C43CE5',lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE});
}

/** Register this device for pushes. prompt=false never shows the OS dialog (silent refresh). Returns a Dutch notice. */
export async function registerPushDevice(uid:string,{prompt}:{prompt:boolean}):Promise<string>{
 if(Platform.OS==='web')return 'Pushmeldingen werken in de Snapshot X-app op je telefoon. Je keuzes hier gelden daar ook.';
 await ensureAndroidChannels();
 let perm=await Notifications.getPermissionsAsync();
 if(!perm.granted&&prompt&&perm.canAskAgain!==false)perm=await Notifications.requestPermissionsAsync();
 if(!perm.granted)throw new Error(pushDeniedText(Platform.OS));
 const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;if(!projectId)throw new Error('EAS projectId ontbreekt.');
 const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});
 if(!isValidExpoToken(token))throw new Error('Dit toestel gaf geen geldige meldingssleutel terug. Probeer het later opnieuw.');
 // Shared phone: sx_claim_push_token also drops a previous account's row for this token (migration 20261102221000).
 const claim=await supabase.rpc('sx_claim_push_token',{p_token:token});
 if(claim.error){const {error}=await supabase.from('sx_push_tokens').upsert(pushTokenRow(uid,token),{onConflict:'user_id,token'});if(error)throw error;}
 await AsyncStorage.setItem(TOKEN_KEY,token).catch(()=>{});
 return 'Dit toestel is geregistreerd voor meldingen.';
}

/** Remove this device's token row (RLS: own rows only) so this phone stops getting pushes for this account. */
export async function forgetPushToken():Promise<void>{
 const token=await AsyncStorage.getItem(TOKEN_KEY);
 if(!token)return;
 const {error}=await supabase.from('sx_push_tokens').delete().eq('token',token);
 if(error)throw error;
 await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Uitloggen (Instellingen): forget the push token, then end only this device's session. */
export function signOutDevice(){return signOutThisDevice({forgetToken:forgetPushToken,signOut:o=>supabase.auth.signOut(o)})}
