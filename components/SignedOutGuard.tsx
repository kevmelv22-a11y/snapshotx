import {useEffect} from 'react';
import {router,usePathname} from 'expo-router';
import {useSession} from '../hooks/useSession';
import {needsSignIn} from '../lib/auth-guard';

/** Signed-out deep links to private screens (e.g. /settings) go to the login screen instead of rendering an empty account. */
export function SignedOutGuard(){
 const {session,ready}=useSession(),pathname=usePathname();
 useEffect(()=>{if(ready&&!session&&needsSignIn(pathname))router.replace('/(auth)/login')},[ready,session,pathname]);
 return null;
}
