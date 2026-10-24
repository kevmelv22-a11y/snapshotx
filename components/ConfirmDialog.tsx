/**
 * Cross-platform confirm dialog (iOS, Android and web). Alert.alert is a no-op on react-native-web
 * (no dialog, button callbacks never run), so the app uses this instead. State lives in lib/confirm-flow.ts.
 * For a one-button notice pass noticeRequest(title, message) and an action that returns null.
 *
 *   const confirm = useConfirmDialog();
 *   confirm.ask({ title, message, confirmLabel, destructive: true }, async () => {
 *     const { error } = await supabase.rpc(...);
 *     return error ? error.message : null;     // a string keeps the dialog open and shows it
 *   });
 *   ...
 *   {confirm.dialog}
 */
import React, { useCallback, useReducer, useRef } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CONFIRM_IDLE, confirmReducer, isConfirmBusy, isConfirmVisible, type ConfirmRequest } from '../lib/confirm-flow';

type ConfirmAction = () => Promise<string | null | void> | string | null | void;

export function useConfirmDialog() {
  const [state, dispatch] = useReducer(confirmReducer, CONFIRM_IDLE);
  const action = useRef<ConfirmAction | null>(null);

  const ask = useCallback((request: ConfirmRequest, onConfirm: ConfirmAction) => {
    action.current = onConfirm;
    dispatch({ type: 'request', request });
  }, []);

  const confirm = useCallback(async () => {
    dispatch({ type: 'confirm' });
    try {
      const error = await action.current?.();
      if (typeof error === 'string' && error) dispatch({ type: 'failed', error });
      else { dispatch({ type: 'succeeded' }); action.current = null; }
    } catch (e) {
      dispatch({ type: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const cancel = useCallback(() => dispatch({ type: 'cancel' }), []);
  const busy = isConfirmBusy(state);
  const request = state.phase === 'idle' ? null : state.request;
  const error = state.phase === 'idle' ? null : state.error;

  const dialog = (
    <Modal visible={isConfirmVisible(state)} transparent animationType="fade" onRequestClose={cancel}>
      <View style={s.shade}>
        <View style={s.card} accessibilityRole="alert" accessibilityLabel={request?.title}>
          <Text style={s.title}>{request?.title}</Text>
          <Text style={s.message}>{request?.message}</Text>
          {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
          <View style={s.row}>
            {!request?.notice && <Pressable disabled={busy} onPress={cancel} style={[s.button, s.cancel, busy && s.disabled]} accessibilityRole="button">
              <Text style={s.cancelText}>{request?.cancelLabel || 'Annuleren'}</Text>
            </Pressable>}
            <Pressable disabled={busy} onPress={() => void confirm()} style={[s.button, request?.destructive ? s.danger : s.primary, busy && s.disabled]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#111" size="small" /> : <Text style={request?.destructive ? s.dangerText : s.primaryText}>{request?.confirmLabel || 'Bevestigen'}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  return { ask, dialog, busy, open: isConfirmVisible(state) };
}

const s = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#000B' },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#111925', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#243244', gap: 10 },
  title: { color: '#F1F5F9', fontSize: 16, fontWeight: '800' },
  message: { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
  error: { color: '#F06D6D', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  button: { minHeight: 38, minWidth: 104, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#182332', borderWidth: 1, borderColor: '#243244' },
  cancelText: { color: '#F1F5F9', fontWeight: '800', fontSize: 12 },
  primary: { backgroundColor: '#F6C445' },
  primaryText: { color: '#17140D', fontWeight: '800', fontSize: 12 },
  danger: { backgroundColor: '#F06D6D' },
  dangerText: { color: '#1A0B0B', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.5 },
});
