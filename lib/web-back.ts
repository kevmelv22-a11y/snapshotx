/** Web header back button for root-stack screens (Herinneringen, Ontdekken, Verhaal, Melding maken, …). Opened from a
 *  shared link or after a refresh there is no history, and the default header then shows no way back at all.
 *  With history: normal back. Without: go to the Chat tab (Snapchat Web's home). */
export const WEB_HOME = '/(tabs)/chats' as const;
export function webBackAction(canGoBack: boolean | undefined): 'back' | typeof WEB_HOME {
  return canGoBack ? 'back' : WEB_HOME;
}
export function webBackLabel(canGoBack: boolean | undefined): string {
  return canGoBack ? 'Terug' : 'Naar Chat';
}
