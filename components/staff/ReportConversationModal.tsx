import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isStaffMock, staffDb } from '../../lib/staff-client';

type Audience = 'reporter' | 'reported';
type ConversationRow = {
  thread_id: string | null;
  recipient_id: string;
  recipient_username: string | null;
  recipient_display_name: string | null;
  message_id: string | null;
  sender_id: string | null;
  kind: string | null;
  body: string | null;
  created_at: string | null;
  is_deleted: boolean | null;
};
type DirectMessage = {
  message_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  created_at: string;
  is_deleted: boolean;
};

type Props = {
  reportId: string;
  audience: Audience;
  staffId: string;
  onClose: () => void;
};

const colors = {
  bg: '#0B1018',
  surface: '#111925',
  elevated: '#182332',
  border: '#243244',
  text: '#F1F5F9',
  muted: '#94A3B8',
  accent: '#F6C445',
  accentDim: '#332B16',
  staffBubble: '#253C55',
  recipientBubble: '#202B3A',
  danger: '#F18484',
};

export function ReportConversationModal({ reportId, audience, staffId, onClose }: Props) {
  const [reason, setReason] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const reasonRef = useRef('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    reasonRef.current = reason;
  }, [reason]);

  const loadConversation = useCallback(async (auditReason: string) => {
    const trimmedReason = auditReason.trim();
    if (trimmedReason.length < 10) {
      setError('Vul een reden van minimaal 10 tekens in voordat je het gesprek opent.');
      return false;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await staffDb().rpc('sx_staff_report_conversation', {
        p_report_id: reportId,
        p_audience: audience,
        p_reason: trimmedReason,
      });
      if (rpcError) throw rpcError;
      const rows = (data || []) as ConversationRow[];
      const first = rows[0];
      if (!first?.recipient_id) throw new Error('De ontvanger van dit gesprek is niet beschikbaar.');
      setRecipientId(first.recipient_id);
      setRecipientName(
        first.recipient_display_name ||
          (first.recipient_username ? `@${first.recipient_username}` : `Gebruiker ${first.recipient_id.slice(0, 8)}…`),
      );
      setThreadId(first.thread_id);
      setMessages(
        rows
          .filter((row): row is ConversationRow & { message_id: string; sender_id: string; kind: string; created_at: string } =>
            !!row.message_id && !!row.sender_id && !!row.kind && !!row.created_at,
          )
          .map(row => ({
            message_id: row.message_id,
            sender_id: row.sender_id,
            kind: row.kind,
            body: row.body,
            created_at: row.created_at,
            is_deleted: !!row.is_deleted,
          })),
      );
      setOpened(true);
      return true;
    } catch (e) {
      setError((e as Error).message || 'Het gesprek kon niet worden geladen.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [reportId, audience]);

  async function openConversation() {
    await loadConversation(reason);
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || body.length > 2000 || sending) return;
    setSending(true);
    setError('');
    try {
      const { data, error: rpcError } = await staffDb().rpc('sx_staff_send_report_message', {
        p_report_id: reportId,
        p_audience: audience,
        p_body: body,
        p_reason: reasonRef.current.trim(),
      });
      if (rpcError) throw rpcError;
      const sent = Array.isArray(data) ? data[0] : data;
      if (!sent?.thread_id || !sent?.message_id) throw new Error('Het bericht is niet bevestigd door de server.');
      setDraft('');
      setThreadId(sent.thread_id);
      await loadConversation(reasonRef.current);
    } catch (e) {
      setError((e as Error).message || 'Het bericht kon niet worden verzonden.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!threadId || !opened || isStaffMock()) return;
    let active = true;
    const client = staffDb();
    const channel = client
      .channel(`sx-report-support-${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sx_messages', filter: `thread_id=eq.${threadId}` }, () => {
        if (active) void loadConversation(reasonRef.current);
      })
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [threadId, opened, loadConversation]);

  const audienceLabel = audience === 'reporter' ? 'melder' : 'gemelde gebruiker';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.shade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerCopy}>
              <Text style={s.eyebrow}>MELDING · APART GESPREK</Text>
              <Text style={s.title}>Bericht aan {audienceLabel}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Gesprek sluiten" onPress={onClose} style={s.iconButton}>
              <Ionicons name="close" size={21} color={colors.text} />
            </Pressable>
          </View>

          {!opened ? (
            <View style={s.openGate}>
              <Text style={s.copy}>Lees of beantwoord uitsluitend het aparte gesprek met deze ontvanger. Openen wordt met je reden in de auditlog vastgelegd.</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                maxLength={1000}
                multiline
                placeholder="Reden om dit gesprek te openen (min. 10 tekens)"
                placeholderTextColor={colors.muted}
                style={s.reasonInput}
                accessibilityLabel="Reden om dit gesprek te openen"
              />
              {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
              <Pressable
                accessibilityRole="button"
                disabled={loading || reason.trim().length < 10}
                onPress={() => void openConversation()}
                style={[s.primaryButton, (loading || reason.trim().length < 10) && s.disabled]}
              >
                <Ionicons name="lock-open-outline" size={16} color="#17140D" />
                <Text style={s.primaryText}>{loading ? 'Gesprek openen…' : 'Gesprek openen'}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.recipientLine}>
                <View style={s.recipientAvatar}><Ionicons name="person-outline" size={17} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recipientName}>{recipientName || recipientId.slice(0, 8)}</Text>
                  <Text style={s.muted}>{audience === 'reporter' ? 'Melder' : 'Gemelde gebruiker'} · Privé, aan deze melding gekoppeld</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Gesprek verversen" disabled={loading} onPress={() => void loadConversation(reasonRef.current)} style={s.iconButton}>
                  <Ionicons name="refresh-outline" size={17} color={colors.muted} />
                </Pressable>
              </View>

              <View style={s.retention}><Ionicons name="time-outline" size={14} color={colors.muted} /><Text style={s.retentionText}>Berichten in dit tijdelijke gesprek verlopen na 24 uur.</Text></View>

              <ScrollView
                ref={scrollRef}
                style={s.messageList}
                contentContainerStyle={s.messageContent}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {!messages.length ? (
                  <View style={s.empty}>
                    <Ionicons name="chatbubble-ellipses-outline" size={27} color={colors.muted} />
                    <Text style={s.emptyTitle}>Nog geen berichten</Text>
                    <Text style={s.muted}>Stuur het eerste bericht; de ontvanger kan antwoorden in Chat.</Text>
                  </View>
                ) : messages.map(message => {
                  const mine = message.sender_id === staffId;
                  const attachment = message.kind !== 'text' ? `${message.kind === 'photo' ? 'Foto' : message.kind === 'video' ? 'Video' : message.kind === 'voice' ? 'Spraakbericht' : message.kind === 'snap' ? 'Snap' : 'Bijlage'} — media wordt niet getoond in het staffpaneel.` : '';
                  const content = message.is_deleted ? 'Dit bericht is verwijderd.' : [attachment, message.body].filter(Boolean).join('\n');
                  return (
                    <View key={message.message_id} style={[s.messageBubble, mine ? s.staffBubble : s.recipientBubble]}>
                      <Text style={s.senderLabel}>{mine ? 'Jij · staff' : recipientName}</Text>
                      {!!content && <Text selectable style={s.messageText}>{content}</Text>}
                      <Text style={s.messageTime}>{new Date(message.created_at).toLocaleString('nl-NL')}</Text>
                    </View>
                  );
                })}
                {loading && <Text style={s.muted}>Berichten verversen…</Text>}
              </ScrollView>

              {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
              <View style={s.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={2000}
                  multiline
                  placeholder={`Bericht aan ${audienceLabel}…`}
                  placeholderTextColor={colors.muted}
                  style={s.messageInput}
                  accessibilityLabel={`Bericht aan ${audienceLabel}`}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bericht versturen"
                  disabled={sending || !draft.trim() || draft.trim().length > 2000}
                  onPress={() => void sendMessage()}
                  style={[s.sendButton, (sending || !draft.trim()) && s.disabled]}
                >
                  <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={18} color="#17140D" />
                </Pressable>
              </View>
              <Text style={s.composerHint}>Maximaal 2.000 tekens · De berichtinhoud wordt niet in de auditlog gekopieerd.</Text>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 14, backgroundColor: '#000B' },
  card: { width: '100%', maxWidth: 620, maxHeight: '94%', minHeight: 360, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 11 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 4 },
  iconButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  openGate: { gap: 11 },
  reasonInput: { minHeight: 82, maxHeight: 130, color: colors.text, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 12 },
  primaryButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.accent, paddingHorizontal: 15 },
  primaryText: { color: '#17140D', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  recipientLine: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  recipientAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  recipientName: { color: colors.text, fontWeight: '800', fontSize: 12 },
  muted: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  retention: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retentionText: { color: colors.muted, fontSize: 10 },
  messageList: { flexGrow: 1, minHeight: 120, maxHeight: 430, borderRadius: 13, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  messageContent: { padding: 12, gap: 9, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { flex: 1, minHeight: 120, justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: 12 },
  emptyTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  messageBubble: { maxWidth: '90%', borderRadius: 14, padding: 10, gap: 4 },
  staffBubble: { alignSelf: 'flex-end', backgroundColor: colors.staffBubble },
  recipientBubble: { alignSelf: 'flex-start', backgroundColor: colors.recipientBubble },
  senderLabel: { color: colors.accent, fontSize: 9, fontWeight: '800' },
  messageText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  messageTime: { color: colors.muted, fontSize: 9, alignSelf: 'flex-end', marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageInput: { flex: 1, minHeight: 42, maxHeight: 115, color: colors.text, backgroundColor: colors.elevated, borderRadius: 13, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, paddingVertical: 9, textAlignVertical: 'top', fontSize: 12 },
  sendButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  composerHint: { color: colors.muted, fontSize: 9, lineHeight: 13 },
});
