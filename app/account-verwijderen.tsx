import {router} from 'expo-router';
import {LegalScreen} from '../components/LegalScreen';
import {useSession} from '../hooks/useSession';
import {ACCOUNT_DELETION} from '../lib/legal';
/** Public page https://snapshot-x.nl/account-verwijderen (Google Play: account deletion URL). Signed in → button to the real deletion screen. */
export default function AccountVerwijderen(){const {session}=useSession();
 return <LegalScreen doc={ACCOUNT_DELETION} action={session?{label:'Nu mijn account verwijderen',onPress:()=>router.push('/delete-account'),testID:'deletion-start'}:{label:'Inloggen om te verwijderen',onPress:()=>router.push('/(auth)/login'),testID:'deletion-login'}}/>}
