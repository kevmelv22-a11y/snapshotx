/** Unsent chat text per account + chat (lib/chat-drafts.ts). Device-local (AsyncStorage), never sent to the server. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setDraft, type DraftMap } from '../lib/chat-drafts';

type DraftState = {
  byUser: Record<string, DraftMap>;
  save: (uid: string, threadId: string, text: string) => void;
};

export const useChatDrafts = create<DraftState>()(persist(set => ({
  byUser: {},
  save: (uid, threadId, text) => {
    if (!uid || !threadId) return;
    set(s => {
      const cur = s.byUser[uid];
      if ((cur?.[threadId]?.text ?? '') === (text.trim() ? text : '')) return s;
      return { byUser: { ...s.byUser, [uid]: setDraft(cur, threadId, text, Date.now()) } };
    });
  },
}), { name: 'sx-chat-drafts', storage: createJSONStorage(() => AsyncStorage) }));
