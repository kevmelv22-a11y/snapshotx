import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_KEY = 'sx-installation-id';
let cached: string | null = null;
let pending: Promise<string> | null = null;

/** Random per-install identifier; it is not the phone's hardware identifier. */
export function getInstallationId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = (async () => {
      let value = await AsyncStorage.getItem(DEVICE_KEY);
      if (!value) {
        value = Crypto.randomUUID();
        await AsyncStorage.setItem(DEVICE_KEY, value);
      }
      cached = value;
      return value;
    })().finally(() => { pending = null; });
  }
  return pending;
}
