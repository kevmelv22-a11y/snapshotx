/**
 * Pure state machine for the cross-platform confirm dialog (components/ConfirmDialog.tsx).
 * Replaces Alert.alert button callbacks, which never fire on react-native-web.
 * idle -> open -> (cancel -> idle) | (confirm -> running -> done -> idle | failed -> open with error)
 */
export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Information only: a single acknowledge button, no cancel (replaces one-button Alert.alert). */
  notice?: boolean;
};

export type ConfirmState =
  | { phase: 'idle' }
  | { phase: 'open' | 'running'; request: ConfirmRequest; error: string | null };

export type ConfirmEvent =
  | { type: 'request'; request: ConfirmRequest }
  | { type: 'cancel' }
  | { type: 'confirm' }
  | { type: 'succeeded' }
  | { type: 'failed'; error: string };

export const CONFIRM_IDLE: ConfirmState = { phase: 'idle' };

export function confirmReducer(state: ConfirmState, event: ConfirmEvent): ConfirmState {
  switch (event.type) {
    case 'request':
      // A running action cannot be replaced by a new question (prevents double submits).
      if (state.phase === 'running') return state;
      return { phase: 'open', request: event.request, error: null };
    case 'cancel':
      return state.phase === 'open' ? CONFIRM_IDLE : state;
    case 'confirm':
      return state.phase === 'open' ? { phase: 'running', request: state.request, error: null } : state;
    case 'succeeded':
      return state.phase === 'running' ? CONFIRM_IDLE : state;
    case 'failed':
      return state.phase === 'running' ? { phase: 'open', request: state.request, error: event.error || 'Actie mislukt.' } : state;
  }
}

export const isConfirmVisible = (state: ConfirmState) => state.phase !== 'idle';
export const isConfirmBusy = (state: ConfirmState) => state.phase === 'running';

/** A one-button notice for the same dialog (e.g. the sign-in ban notice in hooks/useSession.tsx). */
export function noticeRequest(title: string, message: string, okLabel = 'OK'): ConfirmRequest {
  return { title, message, confirmLabel: okLabel, notice: true };
}
