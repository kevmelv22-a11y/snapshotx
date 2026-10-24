/** Real provider backed by expo-notifications (native only; web uses MockPushProvider). */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Delivered, PushPayload, PushProvider } from './push';

export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo' as const;
  async requestPermission() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', { name: 'Berichten', importance: Notifications.AndroidImportance.HIGH });
      await Notifications.setNotificationChannelAsync('social', { name: 'Vrienden', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  }
  async getToken() {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    try { return (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data; } catch { return null; }
  }
  async present(p: PushPayload) {
    return Notifications.scheduleNotificationAsync({ content: { title: p.title, body: p.body, data: p.data }, trigger: Platform.OS === 'android' ? { channelId: p.channel } as never : null });
  }
  onReceive(cb: (d: Delivered) => void) {
    const sub = Notifications.addNotificationReceivedListener(n => {
      const c = n.request.content;
      cb({ id: n.request.identifier, at: n.date, title: c.title ?? '', body: c.body ?? '', data: c.data as Delivered['data'], channel: 'messages' });
    });
    return () => sub.remove();
  }
}
