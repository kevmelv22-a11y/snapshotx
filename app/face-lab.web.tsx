import { Text, View } from 'react-native';
import { devOnly } from '../components/DevOnly';

/** Web stub: Face Lab uses VisionCamera (Nitro native modules), which cannot load on react-native-web. */
function FaceLabWeb() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={{ color: '#fff', textAlign: 'center' }}>Face Lab is alleen beschikbaar in de iOS/Android-app.</Text></View>;
}

export default devOnly(FaceLabWeb);
