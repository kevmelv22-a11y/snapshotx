/**
 * KeyboardAvoidingView behaviour per platform. Expo apps are edge-to-edge on Android (always since SDK 54, enforced
 * by Android 15+/16): the window keeps its height and the keyboard arrives as an inset, so `behavior={undefined}`
 * (the old "adjustResize does it" advice) leaves chat/comment/reply inputs UNDER the keyboard. `padding` lifts them on
 * both iOS and Android (expo/expo#52032, react-native#55855). Web has no on-screen keyboard to avoid.
 */
export type KavBehavior = 'padding' | undefined;
export function kavBehavior(os: string): KavBehavior {
  return os === 'ios' || os === 'android' ? 'padding' : undefined;
}
/** Extra offset for the open chat: iOS keeps its tuned 90; Android measures from the top of the edge-to-edge window (0). */
export function chatKeyboardOffset(os: string): number {
  return os === 'ios' ? 90 : 0;
}
