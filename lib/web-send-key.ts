/**
 * Snapchat Web: in a chat, Enter sends and Shift+Enter starts a new line. Never while an IME is still
 * composing (Japanese/Chinese input, dead keys: isComposing / keyCode 229), and Alt+Enter stays a new line.
 * Pure helper, used only on web (native keeps the send button + newline on return).
 */
export type SendKeyLike = { key?: unknown; shiftKey?: unknown; altKey?: unknown; isComposing?: unknown; keyCode?: unknown };

export function isWebSendKey(e: SendKeyLike | null | undefined): boolean {
  return !!e && e.key === 'Enter' && e.shiftKey !== true && e.altKey !== true && e.isComposing !== true && e.keyCode !== 229;
}
