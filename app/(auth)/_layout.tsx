import {Stack,Redirect} from 'expo-router';
import {useSession} from '../../hooks/useSession';
export default function AuthLayout(){const {session}=useSession();if(session)return <Redirect href="/(tabs)"/>;return <Stack screenOptions={{headerShown:false}}/>}
