import {Stack,Redirect} from 'expo-router';
import {useSession} from '../../hooks/useSession';
import {peekPendingAdd} from '../../lib/pending-add';
export default function AuthLayout(){const {session}=useSession();if(session){const add=peekPendingAdd();return <Redirect href={add?{pathname:'/add/[code]',params:{code:add}}:'/(tabs)'}/>};return <Stack screenOptions={{headerShown:false}}/>}
