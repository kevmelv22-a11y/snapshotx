import {Redirect} from 'expo-router';
import {ActivityIndicator,View} from 'react-native';
import {useSession} from '../hooks/useSession';
import {C} from '../lib/theme';
export default function Index(){const {ready,session}=useSession();if(!ready)return <View style={{flex:1,backgroundColor:C.bg,justifyContent:'center'}}><ActivityIndicator color={C.yellow}/></View>;return <Redirect href={session?'/(tabs)':'/(auth)/login'}/>}
