import {Stack,Redirect} from 'expo-router';
import {useSession} from '../../hooks/useSession';
import {pendingAfterLogin} from '../../lib/pending-add';
export default function AuthLayout(){const {session}=useSession();if(session){const next=pendingAfterLogin();return <Redirect href={next??'/(tabs)'}/>};return <Stack screenOptions={{headerShown:false}}/>}
