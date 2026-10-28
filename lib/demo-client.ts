/**
 * DEMO MODE (EXPO_PUBLIC_DEMO_MODE=1): an in-memory stand-in for the Supabase client so the web build can be
 * tried on a phone without ANY backend. Implements the supabase-js subset the app uses (from/rpc/auth/storage/
 * channel/functions) over seeded tables. Staff RPCs/tables come from the step-11 StaffMock (signed in as the
 * mock owner "kevin"). Data lives in memory and resets on reload. Never makes a network request.
 */
import { StaffMock, seedStaffMock, MOCK_IDS, type Row } from './staff-mock';
import { parseReply, replyBody } from './chat-replies';
import { mentionLabel, mentionedIds } from './chat-mentions';
import { SAVE_ERRORS, canSave, unsaveExpiry } from './chat-saves';
import { parseRetention, retentionChangeText, unopenedChatDeadline } from './chat-features';
import { EDIT_ERRORS, EDIT_WINDOW_MS, editableText, editedBody, isNoopEdit, isStickerText, unsentText, validateEdit } from './chat-edits';
import { POLL_ERRORS, parsePoll, pollBody, validateVote } from './chat-polls';
import { FORWARD_ERRORS, FORWARD_MAX_TARGETS, canForward, forwardBody, forwardExpiry } from './chat-forward';
import { MEDIA_ERRORS, canReadMedia } from './media-access';
import { GROUP_ERRORS, GROUP_MAX_MEMBERS, canRemoveMember, groupAddText, groupLeaveText, groupRemoveText, groupRenameText, groupRightsText, isGroupThread, normalizeGroupTitle } from './group-chat';
import { WALLPAPER_ERRORS, WALLPAPER_IDS, isPhotoWallpaperPath, wallpaperChangeText } from './chat-wallpaper';

type Err = { message: string; code?: string; details?: string };
type Res = { data: unknown; error: Err | null; count?: number | null };
const H = 3600e3, D = 86400e3;
const ME = MOCK_IDS.owner;
export const DEMO_EMAIL = 'demo@snapshotx.app';

let seq = 0;
const newId = () => `de${(Date.now() % 1e6).toString(16).padStart(6, '0')}-0000-4000-8000-${(++seq).toString(16).padStart(12, '0')}`;

/** Placeholder "photo" for a storage path: a deterministic gradient SVG with an emoji + caption. */
const ART: Record<string, [string, string, string, string]> = {
  'demo/strand.svg': ['#ffb347', '#ff5e62', '🏖️', 'Strand'], 'demo/koffie.svg': ['#8e5c3b', '#d9a066', '☕', 'Koffie'],
  'demo/concert.svg': ['#4b134f', '#c94b4b', '🎸', 'Concert'], 'demo/fiets.svg': ['#11998e', '#38ef7d', '🚲', 'Fietsen'],
  'demo/pizza.svg': ['#f12711', '#f5af19', '🍕', 'Pizza'], 'demo/zonsondergang.svg': ['#0f2027', '#ff7e5f', '🌅', 'Avond'],
  'demo/hond.svg': ['#56ab2f', '#a8e063', '🐶', 'Max'], 'demo/stad.svg': ['#2c3e50', '#4ca1af', '🏙️', 'Amsterdam'],
  'demo/zaterdag.svg': ['#8360c3', '#2ebf91', '📸', 'Zaterdag'],
};
function artUrl(path: string) {
  const [a, b, e, t] = ART[path] ?? ['#333', '#777', '📷', 'Demo'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><text x="360" y="620" font-size="260" text-anchor="middle">${e}</text><text x="360" y="820" font-size="72" font-family="Helvetica,Arial" fill="white" text-anchor="middle">${t}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const EXTRA = { noor: '0b000000-0000-4000-8000-000000000016', tim: '0b000000-0000-4000-8000-000000000017' };
const T = { aria: 'c0000000-0000-4000-8000-0000000000a1', eva: 'c0000000-0000-4000-8000-0000000000a2', noor: 'c0000000-0000-4000-8000-0000000000a3', crew: 'c0000000-0000-4000-8000-000000000002', fest: 'c0000000-0000-4000-8000-0000000000a4' };

function seedDemo(m: StaffMock) {
  seedStaffMock(m);
  const I = MOCK_IDS, iso = (o: number) => m.iso(o);
  m.t.profiles.push({ id: EXTRA.noor, username: 'noor', display_name: 'Noor El Amrani', created_at: iso(-3 * D), is_verified: false },
    { id: EXTRA.tim, username: 'tim_vd', display_name: 'Tim van Dijk', created_at: iso(-20 * D), is_verified: false });
  m.t.profiles.forEach((p, i) => { p.gender = 'male'; p.avatar_path = null; p.activity_score = 400 + i * 37; });
  // Demo look: Kevin = the default character; his 4 friends have their own portraits (lib/avatar/friendArt).
  Object.assign(m.profile(ME)!, { username: 'kv.savage', display_name: 'Kevin', activity_score: 84732 });
  Object.assign(m.profile(I.aria)!, { display_name: 'Aria de Vries' });
  [I.aria, I.eva, I.cleo, EXTRA.noor].forEach(id => { m.profile(id)!.gender = 'female'; });
  Object.assign(m.profile(I.eva)!, { display_name: 'Eva Smit' });
  Object.assign(m.profile(I.cleo)!, { display_name: 'Cleo Jansen' });
  const friends = [I.aria, I.eva, I.cleo, EXTRA.noor];
  // Noor joined 3 days ago → 👶 Nieuwe vriend in the chat list.
  // Charms: Aria and Kevin have been friends for almost a year (🎂 "Over 3 dagen 1 jaar vrienden").
  m.t.sx_friends = friends.flatMap(f => { const at = iso((f === EXTRA.noor ? -3 : f === I.aria ? -362 : -30) * D); return [{ user_id: ME, friend_id: f, created_at: at }, { user_id: f, friend_id: ME, created_at: at }]; });
  m.t.sx_friend_requests = [{ id: 'fr000000-0000-4000-8000-000000000001', sender_id: EXTRA.tim, recipient_id: ME, status: 'pending', created_at: iso(-2 * H) }];
  m.t.sx_threads.push({ id: T.aria, title: null, created_at: iso(-10 * D), member_count: 2, retention_mode: 'keep' }, { id: T.eva, title: null, created_at: iso(-4 * D), member_count: 2, retention_mode: 'keep' });
  m.t.sx_threads.forEach(t => { t.retention_mode ??= 'keep'; });
  // Weekend crew = Kevin's group (he created it, so Groepsinfo shows the creator-only remove buttons).
  Object.assign(m.t.sx_threads.find(t => t.id === T.crew) ?? {}, { created_by: ME, is_group: true });
  m.t.sx_threads.push({ id: T.fest, title: 'Festival squad', created_by: I.aria, is_group: true, created_at: iso(-6 * D), member_count: 4, retention_mode: 'keep' });
  m.t.sx_members = [
    { thread_id: T.aria, user_id: ME }, { thread_id: T.aria, user_id: I.aria }, { thread_id: T.eva, user_id: ME }, { thread_id: T.eva, user_id: I.eva },
    ...[ME, EXTRA.noor, I.eva, I.cleo, I.aria].map(u => ({ thread_id: T.crew, user_id: u, can_remove_members: u === I.eva })),
    // Festival squad = Aria's group: Kevin is a plain member there, Cleo may remove members (member view of the rights).
    ...[I.aria, ME, I.eva, I.cleo].map(u => ({ thread_id: T.fest, user_id: u, can_remove_members: u === I.cleo })),
    { thread_id: 'c0000000-0000-4000-8000-000000000001', user_id: I.aria }, { thread_id: 'c0000000-0000-4000-8000-000000000001', user_id: I.bram },
  ];
  const msg = (thread_id: string, sender_id: string, body: string, ago: number, kind = 'text', media_path: string | null = null) =>
    ({ id: newId(), thread_id, sender_id, body, kind, media_path, view_once: kind === 'snap', view_seconds: kind === 'snap' ? 10 : null, created_at: iso(-ago), expires_at: null });
  m.t.sx_messages.push(
    msg(T.aria, I.aria, 'Hé Kevin! Kom je vanavond ook naar het concert? 🎸', 5 * H), msg(T.aria, ME, 'Ja zeker, om 8 uur bij de ingang?', 4.8 * H),
    msg(T.aria, I.aria, 'Top, tot dan! 🙌', 4.7 * H), msg(T.aria, I.aria, 'photo', 1.2 * H, 'snap', 'demo/concert.svg'),
    msg(T.eva, I.eva, 'Heb je de foto’s van zaterdag nog?', 26 * H), msg(T.eva, ME, 'Komen eraan! Even zoeken 😅', 25 * H), msg(T.eva, I.eva, 'Haha oké 😄', 20 * H),
    // Kept chat media (Bewaren → expires_at NULL): must stay viewable for the other member (lib/media-access.ts).
    { ...msg(T.eva, I.eva, '', 19.5 * H, 'photo', 'demo/zaterdag.svg'), body: null },
    msg(T.crew, I.cleo, 'Wie neemt de bal mee?', 3.5 * H), msg(T.crew, EXTRA.noor, 'Ik! ⚽', 3.4 * H),
    msg(T.crew, EXTRA.noor, 'En ik neem ook de pomp mee', 3.39 * H), msg(T.crew, ME, 'Top! Ik regel de muziekbox 🔊', 3.3 * H),
    msg(T.crew, ME, 'Zaterdag 14:00 bij het strandpaviljoen?', 3.29 * H), msg(T.crew, I.eva, 'Ik ben erbij 🙌', 3.1 * H),
    msg(T.crew, I.aria, 'Ik kom iets later, rond 15:00', 2.8 * H),
    // @vermeldingen: Kevin thanks Noor, Cleo asks Kevin something (unread → "@ Je bent vermeld" in the chat list).
    msg(T.crew, ME, '@Noor jij bent de beste 🙌', 3.38 * H), msg(T.crew, I.cleo, '@Kevin kun jij de route naar het paviljoen sturen? 📍', 2.5 * H));
  // Staff-mock seed has a Daan snap without media in Weekend crew (Daan is no member here): it rendered as an empty
  // first bubble. In the demo it becomes Aria's beach snap with real demo media.
  Object.assign(m.t.sx_messages.find(x => x.id === 'e0000000-0000-4000-8000-000000000003') ?? {}, { sender_id: I.aria, media_path: 'demo/strand.svg', body: 'photo', view_once: true });
  Object.assign(m.t.sx_messages.find(x => x.id === 'e0000000-0000-4000-8000-000000000004') ?? {}, { body: 'Zaterdag strand? 🏖️' });
  // Quoted replies (Snapchat "Antwoorden"): Eva answers Kevin's question in the group, Aria quotes his time in 1:1.
  const quote = (thread: string, sender: string, startsWith: string, text: string) => {
    const target = m.t.sx_messages.find(x => x.thread_id === thread && String(x.body).startsWith(startsWith));
    const reply = m.t.sx_messages.find(x => x.thread_id === thread && x.sender_id === sender && x.body === text);
    if (target && reply) reply.body = replyBody(target as never, text);
  };
  quote(T.crew, I.eva, 'Zaterdag 14:00', 'Ik ben erbij 🙌');
  quote(T.aria, I.aria, 'Ja zeker, om 8 uur', 'Top, tot dan! 🙌');
  // Opslaan in chat: Aria saved Kevin's meeting point, Kevin saved Eva's question (grey highlight + label).
  const save = (thread: string, startsWith: string, by: string) => {
    const x = m.t.sx_messages.find(r => r.thread_id === thread && (parseReply(String(r.body))?.text ?? String(r.body)).startsWith(startsWith));
    if (x) Object.assign(x, { saved: true, saved_by: by, saved_at: x.created_at });
  };
  save(T.aria, 'Ja zeker, om 8 uur', I.aria);
  save(T.eva, 'Heb je de foto', ME);
  // Bewerken / Verwijderen (Snapchat): Aria fixed her time afterwards ("Bewerkt"), Eva unsent a chat in the group.
  Object.assign(m.t.sx_messages.find(x => x.thread_id === T.crew && x.body === 'Ik kom iets later, rond 15:00') ?? {}, { body: 'Ik kom iets later, rond 15:30', edited_at: iso(-2.78 * H) });
  m.t.sx_messages.push({ ...msg(T.crew, I.eva, unsentText('Eva Smit'), 3.05 * H, 'system'), unsent_at: iso(-2.9 * H) });
  // Peilingen (Snapchat group polls): Cleo asks what to do after the beach; Cleo, Noor and Eva voted, Kevin not yet.
  const poll = pollBody('Wat doen we zaterdag na het strand? 🌅', ['Pizza eten 🍕', 'Bioscoop 🎬', 'Bowlen 🎳']);
  if (poll.ok) { const p = msg(T.crew, I.cleo, poll.body, 2.6 * H); m.t.sx_messages.push(p);
    m.t.sx_poll_votes = [[I.cleo, 0], [EXTRA.noor, 0], [I.eva, 2]].map(([user_id, option_index]) => ({ message_id: p.id, user_id, option_index, created_at: iso(-2.5 * H) })); }
  const st = (owner_id: string, path: string, caption: string | null, ago: number, visibility = 'friends') =>
    ({ id: newId(), owner_id, media_path: path, media_type: 'photo', caption, visibility, created_at: iso(-ago), expires_at: iso(24 * H - ago) });
  m.t.sx_stories.forEach((s, i) => { s.media_path = i ? 'demo/stad.svg' : 'demo/pizza.svg'; s.media_type = 'photo'; s.expires_at = m.iso(16 * H); });
  m.t.sx_stories.push(st(I.aria, 'demo/strand.svg', 'Zon, zee en zand ☀️', 2 * H, 'everyone'), st(I.aria, 'demo/koffie.svg', null, 1 * H),
    st(I.eva, 'demo/hond.svg', 'Max is jarig! 🎂', 3 * H, 'everyone'), st(I.cleo, 'demo/fiets.svg', 'Rondje Vondelpark', 5 * H),
    st(EXTRA.noor, 'demo/zonsondergang.svg', 'Wat een avond', 7 * H, 'everyone'));
  m.t.sx_story_views = []; m.t.sx_story_reactions = []; m.t.sx_reactions = []; m.t.sx_receipts = []; m.t.sx_blocks = [];
  // Snapchat chat status + streaks: snap history (expired media) both ways, read marks and an opened snap of Kevin.
  m.t.sx_threads.push({ id: T.noor, title: null, created_at: iso(-6 * D), member_count: 2, retention_mode: 'keep' });
  m.t.sx_members.push({ thread_id: T.noor, user_id: ME }, { thread_id: T.noor, user_id: EXTRA.noor });
  const opened = (message_id: unknown, user_id: string, ago: number) => m.t.sx_receipts.push({ message_id, user_id, opened_at: iso(-ago), replay_count: 0 });
  const history: Row[] = [];
  // Vriend-emoji's: Aria also snapped with Kevin the week before (#1 two weeks running → ❤️ BFF's).
  for (const d of [12, 11, 10, 9, 8]) history.push(msg(T.aria, I.aria, 'photo', d * D, 'snap'), msg(T.aria, ME, 'photo', d * D - 60e3, 'snap'));
  for (let d = 5; d >= 1; d--) history.push(msg(T.aria, I.aria, 'photo', d * D, 'snap'), msg(T.aria, ME, 'photo', d * D - 60e3, 'snap'));
  for (let d = 3; d >= 1; d--) history.push(msg(T.eva, ME, 'photo', d * D + 30 * 60e3, 'snap'), msg(T.eva, I.eva, 'video', d * D + 20 * 60e3, 'snap'));
  // Charms 🦉 Nachtbrakers: Aria and Kevin chatted at 01:30 (browser local time) two nights ago.
  { const t = new Date(m.now()); t.setHours(1, 30, 0, 0); const ago = m.now() - t.getTime() + 2 * D;
    history.push(msg(T.aria, I.aria, 'Kun je ook niet slapen? 😅', ago), msg(T.aria, ME, 'Nee haha, morgen wordt zwaar 😴', ago - 4 * 60e3)); }
  const noorHi = msg(T.noor, EXTRA.noor, 'Leuk je gisteren te zien!', 30 * H), noorSnap = msg(T.noor, ME, 'photo', 9 * H, 'snap', 'demo/fiets.svg');
  m.t.sx_messages.push(...history, noorHi, noorSnap);
  history.forEach(x => m.t.sx_receipts.push({ message_id: x.id, user_id: x.sender_id === ME ? (x.thread_id === T.aria ? I.aria : I.eva) : ME, opened_at: x.created_at, replay_count: 0 }));
  opened(noorHi.id, ME, 29 * H); opened(noorSnap.id, EXTRA.noor, 8 * H);
  // Chats verwijderen (Snapchat: a new setting only applies going forward): Noor set the chat to 24 h, sent a chat Kevin
  // read 4.5 h ago, then Kevin switched back to Bewaren → that chat still shows "Nog 19 u", the newer one is kept.
  { const was24 = msg(T.noor, EXTRA.noor, 'Stuur je de foto\'s van gisteren nog? 📸', 5 * H), kept = msg(T.noor, EXTRA.noor, 'Top, dan blijft alles staan 👍', 1 * H);
    Object.assign(noorHi, { retention_mode: 'keep' }); Object.assign(was24, { retention_mode: '24h', expires_at: iso(24 * H - 4.5 * H) }); Object.assign(kept, { retention_mode: 'keep' });
    m.t.sx_messages.push(msg(T.noor, EXTRA.noor, retentionChangeText('Noor El Amrani', '24h'), 6 * H, 'system'), was24, msg(T.noor, ME, retentionChangeText('Kevin', 'keep'), 2 * H, 'system'), kept);
    opened(was24.id, ME, 4.5 * H); opened(kept.id, ME, 50 * 60e3); }
  // Festival squad (group, 24 uur na bekijken) — Snapchat: a chat is deleted 24 h after EVERYONE has viewed it.
  // Gone: opened by all 27 h ago (also Kevin's own chat, opened by all 25 h ago). Stays: Kevin read Eva's chat 27 h
  // ago but Cleo hasn't yet. Counting: everyone opened Cleo's chat 5 h ago → "Nog 19 u". Mirrors sx_apply_retention.
  { const f = m.t.sx_threads.find(t => t.id === T.fest); if (f) f.retention_mode = '24h';
    const gone = { ...msg(T.fest, I.aria, 'Wie heeft de tickets al geprint? 🎟️', 30 * H), expires_at: iso(-3 * H) };
    const waiting = msg(T.fest, I.eva, 'Ik neem zonnebrand mee ☀️', 28 * H);
    const mineGone = { ...msg(T.fest, ME, 'Ik sta om 10:00 bij de ingang', 26 * H), expires_at: iso(-1 * H) };
    const counting = msg(T.fest, I.cleo, 'Treinkaartjes zijn binnen 🚆', 6 * H);
    const mineWaiting = msg(T.fest, ME, 'Wie wil er een lift? 🚗', 3 * H);
    m.t.sx_messages.push(msg(T.fest, I.aria, retentionChangeText('Aria de Vries', '24h'), 40 * H, 'system'), gone, waiting, mineGone, counting, mineWaiting);
    opened(gone.id, ME, 29 * H); opened(gone.id, I.eva, 28 * H); opened(gone.id, I.cleo, 27 * H);
    opened(waiting.id, ME, 27 * H); opened(waiting.id, I.aria, 26 * H);
    opened(mineGone.id, I.aria, 25.9 * H); opened(mineGone.id, I.eva, 25.5 * H); opened(mineGone.id, I.cleo, 25 * H);
    opened(counting.id, ME, 5.5 * H); opened(counting.id, I.aria, 5 * H); opened(counting.id, I.eva, 5 * H);
    opened(mineWaiting.id, I.aria, 2 * H);
    // Newest row = a "Na bekijken" chat everyone opened 50 min ago → gone (server: 10 min after the last view). The chat
    // list must not show it as the preview / time any more (Snapchat): the row falls back to Kevin's "lift" chat.
    const seen = { ...msg(T.fest, I.eva, 'Zie je zo bij de ingang 👋', 1 * H), retention_mode: 'after_view', expires_at: iso(-40 * 60e3) };
    m.t.sx_messages.push(seen); opened(seen.id, ME, 0.9 * H); opened(seen.id, I.aria, 0.85 * H); opened(seen.id, I.cleo, 0.83 * H); }
  // Weekend crew (Kevin = admin): two older chats on "24 uur na bekijken" that everyone EXCEPT Noor opened ~28 h ago.
  // They wait for Noor (Snapchat: deleted 24 h after everyone viewed). Removing Noor completes "everyone viewed" at that
  // moment → both show "Nog 23 u" (before the fix they vanished instantly, the timer counted from the old views).
  { const auto = { ...msg(T.crew, ME, 'Wie heeft er zaterdag een auto? 🚗', 30 * H), retention_mode: '24h', expires_at: iso(31 * D - 30 * H) };
    const parasol = { ...msg(T.crew, I.eva, 'Ik neem de parasol mee ⛱️', 29.5 * H), retention_mode: '24h', expires_at: iso(31 * D - 29.5 * H) };
    m.t.sx_messages.push(msg(T.crew, ME, retentionChangeText('Kevin', '24h'), 31 * H, 'system'), auto, parasol, msg(T.crew, ME, retentionChangeText('Kevin', 'keep'), 4 * H, 'system'));
    opened(auto.id, I.eva, 29 * H); opened(auto.id, I.cleo, 28.5 * H); opened(auto.id, I.aria, 28 * H);
    opened(parasol.id, ME, 29 * H); opened(parasol.id, I.cleo, 28.5 * H); opened(parasol.id, I.aria, 28 * H); }
  // Kevin already read Eva's chats (Ontvangen), Eva read his (Geopend).
  m.t.sx_messages.filter(x => x.thread_id === T.eva && x.kind === 'text').forEach(x => opened(x.id, x.sender_id === ME ? I.eva : ME, 19 * H));
  m.t.sx_highlight_likes = []; m.t.sx_highlight_shares = [];
  // Spotlight social (Snapchat): comments with likes on the public snaps + Kevin is subscribed to Eva.
  const pub = (owner: string) => m.t.sx_stories.find(s => s.owner_id === owner && s.visibility === 'everyone')?.id;
  const cm = (story: unknown, user_id: string, body: string, ago: number) => ({ id: newId(), story_id: story, user_id, body, created_at: iso(-ago) });
  const beach = pub(I.aria), dog = pub(I.eva), sunset = pub(EXTRA.noor);
  m.t.sx_highlight_comments = [
    cm(beach, I.bram, 'Waar is dit? Ziet er heerlijk uit 😍', 90 * 60e3), cm(beach, I.eva, 'Volgende keer ga ik mee!! 🏖️', 70 * 60e3),
    cm(beach, I.daan, 'Die zon 🔥🔥', 40 * 60e3), cm(beach, I.aria, 'Scheveningen! Echt een aanrader ☀️', 30 * 60e3),
    cm(dog, I.cleo, 'Gefeliciteerd Max!! 🎉🐶', 2 * H), cm(dog, I.bram, 'Hoe oud is hij geworden?', 100 * 60e3), cm(dog, I.eva, '3 jaar al 🥹', 95 * 60e3),
    cm(sunset, I.aria, 'Wat een kleuren 🌅', 5 * H),
  ];
  const cl = (comment: Row | undefined, users: string[]) => users.map(user_id => ({ comment_id: comment?.id, user_id }));
  const [cB0, cB1, cB2, cB3, cD0] = m.t.sx_highlight_comments;
  m.t.sx_highlight_comment_likes = [...cl(cB0, [I.eva, I.cleo]), ...cl(cB1, [I.aria]), ...cl(cB2, [I.bram, I.eva, I.cleo, EXTRA.noor]), ...cl(cB3, [I.bram, I.daan, I.eva]), ...cl(cD0, [I.eva, ME])];
  m.t.sx_creator_subscriptions = [{ subscriber_id: ME, creator_id: I.eva, created_at: iso(-6 * D) }, { subscriber_id: I.bram, creator_id: I.aria, created_at: iso(-2 * D) }]; m.t.sx_location_allowed = []; m.t.sx_push_tokens = [];
  m.t.sx_preferences = [{ user_id: ME, language: 'nl', find_me: true }];
  const loc = (user_id: string, lat: number, lng: number, ago: number) => ({ user_id, latitude: lat, longitude: lng, sharing: true, home_confirmed: false, updated_at: iso(-ago), share_audience: 'friends', ghost_until: null, ghost_forever: false });
  m.t.sx_locations = [loc(ME, 52.3676, 4.9041, 5 * 60e3), loc(I.aria, 52.3731, 4.8922, 10 * 60e3), loc(I.eva, 52.3584, 4.8811, 40 * 60e3), loc(I.cleo, 52.3600, 4.9200, 2 * H), loc(EXTRA.noor, 52.3791, 4.9003, 15 * 60e3)];
  m.t.memories = [{ id: newId(), owner_id: ME, storage_path: 'demo/zonsondergang.svg', media_type: 'photo', created_at: iso(-40 * D), private: false, caption: null, deleted_at: null },
    { id: newId(), owner_id: ME, storage_path: 'demo/pizza.svg', media_type: 'photo', created_at: iso(-370 * D), private: false, caption: 'Pizza-avond', deleted_at: null }];
  m.t.sx_memory_vault = []; m.t.sx_avatar_outfits = [];
  // Chat-achtergrond (Snapchat+ Chat Wallpaper): Aria (X+) set 'Sterren' on her chat with Kevin, who sees it without X+.
  m.t.sx_threads.forEach(t => { t.wallpaper ??= 'none'; t.wallpaper_path ??= null; t.wallpaper_blur ??= false; });
  Object.assign(m.t.sx_threads.find(t => t.id === T.aria) ?? {}, { wallpaper: 'sterren' });
  m.t.sx_messages.push(msg(T.aria, I.aria, wallpaperChangeText('Aria', 'sterren'), 5.5 * H, 'system'));
  m.t.sx_messages.forEach(x => stampRetention(m.t.sx_threads, x));
}

/** Mirrors the sx_messages_stamp_retention trigger (20261028030000_message_retention_mode.sql): every new chat carries the
 *  chat's current "Chats verwijderen" mode; Bewaren → no expiry. System lines and already-stamped rows are left alone. */
function stampRetention(threads: Row[], row: Row) {
  if (row.kind === 'system' || row.retention_mode != null) return;
  const mode = parseRetention(threads.find(t => t.id === row.thread_id)?.retention_mode);
  row.retention_mode = mode; if (mode === 'keep' && !row.saved && row.kind !== 'snap') row.expires_at = null;
  // 20261028060000_unopened_chats_31d.sql: other chats are deleted 31 days after sending at the latest (Snapchat).
  else if (row.kind !== 'snap' && !row.saved && row.expires_at == null) row.expires_at = new Date(unopenedChatDeadline(Date.parse(String(row.created_at)) || Date.now())).toISOString();
}

const PK: Record<string, string[]> = {
  sx_story_views: ['story_id', 'viewer_id'], sx_preferences: ['user_id'], sx_locations: ['user_id'], sx_reactions: ['message_id', 'user_id'],
  sx_story_reactions: ['story_id', 'user_id'], sx_highlight_likes: ['story_id', 'user_id'], sx_highlight_comment_likes: ['comment_id', 'user_id'], sx_creator_subscriptions: ['subscriber_id', 'creator_id'], sx_push_tokens: ['user_id'], sx_avatar_outfits: ['user_id'],
  sx_memory_vault: ['user_id'], sx_receipts: ['message_id', 'user_id'], sx_location_allowed: ['owner_id', 'friend_id'], sx_members: ['thread_id', 'user_id'],
  sx_poll_votes: ['message_id', 'user_id'],
};
type Listener = { table: string; event: string; filter?: string; cb: (p: unknown) => void };

class DemoQuery implements PromiseLike<Res> {
  private f: ((r: Row) => boolean)[] = []; private ord: [string, boolean][] = []; private lim = Infinity; private off = 0;
  private one: 'single' | 'maybe' | null = null; private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row[] = []; private patch: Row = {}; private conflict?: string[]; private returning = false; private head = false; private count = false;
  constructor(private c: DemoClient, private name: string) {}
  select(_cols?: string, o?: { count?: string; head?: boolean }) { if (this.op !== 'select') this.returning = true; this.head = !!o?.head; this.count = !!o?.count; return this; }
  insert(v: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: Row | Row[], o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(v) ? v : [v]; this.conflict = o?.onConflict?.split(',').map(s => s.trim()); return this; }
  update(v: Row) { this.op = 'update'; this.patch = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: unknown) { this.f.push(r => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.f.push(r => r[k] !== v); return this; }
  gt(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) > (v as string)); return this; }
  gte(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) >= (v as string)); return this; }
  lt(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) < (v as string)); return this; }
  lte(k: string, v: unknown) { this.f.push(r => r[k] != null && (r[k] as string) <= (v as string)); return this; }
  in(k: string, v: unknown[]) { this.f.push(r => v.includes(r[k])); return this; }
  is(k: string, v: unknown) { this.f.push(r => (r[k] ?? null) === v); return this; }
  ilike(k: string, p: string) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); this.f.push(r => re.test(String(r[k] ?? ''))); return this; }
  like(k: string, p: string) { return this.ilike(k, p); }
  match(o: Row) { Object.entries(o).forEach(([k, v]) => this.eq(k, v)); return this; }
  not(k: string, op: string, v: unknown) { const q = new DemoQuery(this.c, this.name); (q as unknown as Record<string, (a: string, b: unknown) => void>)[op]?.(k, v); const g = q.f[0]; if (g) this.f.push(r => !g(r)); return this; }
  order(k: string, o?: { ascending?: boolean }) { this.ord.push([k, o?.ascending ?? true]); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.off = a; this.lim = b - a + 1; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }
  private run(): Res {
    // Fault injection (see DemoClient.faults): reproduce live's missing GRANTs exactly as PostgREST reports them.
    if (this.c.faults.denied.has(this.name)) return { data: null, error: { message: `permission denied for table ${this.name}`, code: '42501' } };
    const t = this.c.m.table(this.name), now = this.c.m.iso();
    let out: Row[] = [];
    if (this.op === 'insert' || this.op === 'upsert') {
      for (const raw of this.payload) {
        const row: Row = { ...raw };
        const keys = this.conflict ?? PK[this.name] ?? ['id'];
        const hit = this.op === 'upsert' && keys.every(k => row[k] != null) ? t.find(r => keys.every(k => r[k] === row[k])) : undefined;
        if (hit) { Object.assign(hit, row); out.push(hit); continue; }
        if (!PK[this.name] && row.id == null) row.id = newId();
        if (row.created_at == null && this.name !== 'sx_locations') row.created_at = now;
        if (this.name === 'sx_friend_requests') row.status ??= 'pending';
        if (this.name === 'sx_stories') row.expires_at ??= this.c.m.iso(24 * H);
        if (this.name === 'memories') row.deleted_at ??= null;
        t.push(row); out.push(row); this.c.emit(this.name, 'INSERT', row);
      }
    } else {
      let rows = t.filter(r => this.f.every(g => g(r)));
      if (this.op === 'update') { rows.forEach(r => { Object.assign(r, this.patch); this.c.emit(this.name, 'UPDATE', r); }); out = rows; }
      else if (this.op === 'delete') { this.c.m.t[this.name] = t.filter(r => !rows.includes(r)); rows.forEach(r => this.c.emit(this.name, 'DELETE', r)); out = rows; }
      else {
        for (const [k, asc] of [...this.ord].reverse()) rows = [...rows].sort((a, b) => (a[k] == null ? -1 : b[k] == null ? 1 : a[k]! < b[k]! ? -1 : a[k]! > b[k]! ? 1 : 0) * (asc ? 1 : -1));
        const total = rows.length; rows = rows.slice(this.off, this.off + this.lim);
        if (this.head) return { data: null, error: null, count: total };
        return this.wrap(rows, this.count ? total : null);
      }
    }
    if (!this.returning) return { data: null, error: null };
    return this.wrap(out, null);
  }
  private wrap(rows: Row[], count: number | null): Res {
    const data = JSON.parse(JSON.stringify(rows)) as Row[];
    if (this.one) {
      if (data.length === 1 || (this.one === 'maybe' && data.length === 0)) return { data: data[0] ?? null, error: null };
      if (this.one === 'maybe') return { data: data[0], error: null };
      // Same text supabase-js/PostgREST returns for .single() on 0 rows (the live "Cannot coerce" error).
      return { data: null, error: { message: 'Cannot coerce the result to a single JSON object', code: 'PGRST116', details: `The result contains ${data.length} rows` } };
    }
    return { data, error: null, count };
  }
  then<A, B>(ok?: ((v: Res) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    let v: Res; try { v = this.run(); } catch (e) { v = { data: null, error: { message: (e as Error).message } }; }
    return new Promise<Res>(r => setTimeout(() => r(v), 30)).then(ok, bad);
  }
}

const QUESTION_REPLIES = ['Ja, goed idee! 👍', 'Prima, ik ben erbij', 'Hmm, ik laat het je straks weten', 'Zeker weten 😄'];
const REPLIES = ['Haha 😄', 'Klinkt goed!', 'Echt? 😮', 'Top 👍', 'Zie je straks!', 'Haha ja precies', '🔥🔥'];

/**
 * Demo-only fault injection to reproduce the live backend state without touching it:
 * `?demo_faults=live` (or localStorage 'sx-demo-faults') = no GRANT on sx_locations/sx_stories/sx_friends,
 * no profiles row for the signed-in user and no sx_ensure_profile RPC (migration 20261019120000 not applied).
 * Also accepts a comma list: table names (denied), 'no-profile', 'no-ensure', 'old-media-rule' (storage read policy
 * before migration 20261028000000: kept chat media with expires_at NULL is refused → "Niet meer beschikbaar").
 */
function readFaults(): { denied: Set<string>; noProfile: boolean; noEnsure: boolean; oldMediaRule: boolean } {
  let raw = '';
  try {
    const q = new URLSearchParams(String(globalThis.location?.search ?? '')).get('demo_faults');
    if (q !== null) globalThis.localStorage?.setItem('sx-demo-faults', q);
    raw = q ?? globalThis.localStorage?.getItem('sx-demo-faults') ?? '';
  } catch {}
  const parts = raw.split(',').map(x => x.trim()).filter(Boolean).flatMap(x => (x === 'live' ? ['sx_locations', 'sx_stories', 'sx_friends', 'no-profile', 'no-ensure'] : [x]));
  return { denied: new Set(parts.filter(x => /^(sx_[a-z_]+|memories|profiles)$/.test(x))), noProfile: parts.includes('no-profile'), noEnsure: parts.includes('no-ensure'), oldMediaRule: parts.includes('old-media-rule') };
}

export class DemoClient {
  m = new StaffMock(seedDemo, ME);
  faults = readFaults();
  private listeners = new Set<Listener>();
  private authCbs = new Set<(e: string, s: unknown) => void>();
  private uploads: Record<string, string> = {};
  private session: Row | null = null;
  private meta: Row = { display_name: 'Kevin', gender: 'male' };
  constructor() {
    try {
      const meta = JSON.parse(globalThis.localStorage?.getItem('sx-demo-meta') ?? 'null') as Row | null;
      if (meta) { Object.assign(this.meta, meta); Object.assign(this.m.profile(ME) ?? {}, { gender: meta.gender === 'female' ? 'female' : 'male', ...(meta.display_name ? { display_name: meta.display_name } : {}), ...(meta.username ? { username: meta.username } : {}) }); }
      if (globalThis.localStorage?.getItem('sx-demo-signed-in') === '1') this.session = this.makeSession();
    } catch {}
    // Demo-only staff role of the signed-in demo user (default: owner, as seeded). sx-demo-meta.demo_staff_role =
    // 'none' | 'mod' | 'admin' | 'owner' (used to preview staff-only wardrobe items as a normal user / per role).
    const role = { none: null, mod: 'r0', admin: 'r2', owner: 'r3' }[String(this.meta.demo_staff_role ?? 'owner') as 'none'];
    if (role !== undefined) this.m.t.user_roles = [...this.m.table('user_roles').filter(r => r.user_id !== ME), ...(role ? [{ user_id: ME, role_id: role }] : [])];
    if (this.faults.noProfile) this.m.t.profiles = this.m.t.profiles.filter(p => p.id !== ME);
  }
  private makeSession(): Row {
    return { access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: ME, email: DEMO_EMAIL, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: this.meta, created_at: this.m.iso(-400 * D) } };
  }
  private setSession(s: Row | null, event: string) {
    this.session = s;
    try { globalThis.localStorage?.setItem('sx-demo-signed-in', s ? '1' : '0'); globalThis.localStorage?.setItem('sx-demo-meta', JSON.stringify(this.meta)); } catch {}
    this.authCbs.forEach(cb => setTimeout(() => cb(event, s), 0));
  }
  removers(threadId: unknown): string[] { return this.m.table('sx_members').filter(x => x.thread_id === threadId && x.can_remove_members).map(x => String(x.user_id)); }
  emit(table: string, event: string, row: Row) {
    if (table === 'sx_messages' && event === 'INSERT') stampRetention(this.m.table('sx_threads'), row);
    for (const l of this.listeners) {
      if (l.table !== table || (l.event !== '*' && l.event !== event)) continue;
      if (l.filter) { const [k, v] = l.filter.split('=eq.'); if (String(row[k]) !== v) continue; }
      setTimeout(() => l.cb({ eventType: event, new: event === 'DELETE' ? {} : row, old: event === 'DELETE' ? row : {}, table, schema: 'public' }), 10);
    }
    if (table === 'sx_messages' && event === 'INSERT' && row.sender_id === ME && row.kind !== 'system') this.autoReply(String(row.thread_id));
  }
  private autoReply(threadId: string) {
    const peers = this.m.table('sx_members').filter(x => x.thread_id === threadId && x.user_id !== ME).map(x => String(x.user_id));
    if (!peers.length) return;
    setTimeout(() => {
      const last = this.m.table('sx_messages').filter(x => x.thread_id === threadId && x.sender_id === ME && x.kind === 'text').sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      // A new poll from Kevin: two friends vote on it instead of chatting back.
      const poll = last ? parsePoll(String(last.body)) : null;
      if (poll) { peers.slice(0, 2).forEach((u, i) => this.vote(last.id, u, i % poll.options.length)); return; }
      // @vermeldingen: in a group the mentioned friend answers (and mentions Kevin back).
      const members = [ME, ...peers].map(id => ({ id, name: (this.m.profile(id)?.display_name as string | undefined) ?? null }));
      const mentioned = peers.length > 1 && last ? mentionedIds(parseReply(String(last.body))?.text ?? String(last.body), members).filter(id => id !== ME) : [];
      const sender = mentioned[0] ?? peers[Math.floor(Math.random() * peers.length)];
      // The friend opens Kevin's messages first (➤ Bezorgd → ▷ Geopend), then replies.
      const receipts = this.m.table('sx_receipts');
      for (const x of this.m.table('sx_messages').filter(x => x.thread_id === threadId && x.sender_id === ME && x.kind !== 'system'))
        if (!receipts.some(r => r.message_id === x.id && r.user_id === sender)) { const r = { message_id: x.id, user_id: sender, opened_at: this.m.iso(), replay_count: 0 }; receipts.push(r); this.emit('sx_receipts', 'INSERT', r); }
      // A question from Kevin gets a quoted reply (swipe-reply style), anything else a plain answer.
      const back = mentioned.length ? `@${mentionLabel(members[0], members)} ` : '';
      const text = back + REPLIES[Math.floor(Math.random() * REPLIES.length)];
      const asked = !!last && (parseReply(String(last.body))?.text ?? String(last.body)).trim().endsWith('?');
      const body = asked ? replyBody(last as never, back + QUESTION_REPLIES[Math.floor(Math.random() * QUESTION_REPLIES.length)]) : text;
      const row = { id: newId(), thread_id: threadId, sender_id: sender, kind: 'text', body, media_path: null, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row);
    }, 1800);
  }
  from(table: string) { return new DemoQuery(this, table); }
  private appRpcs: Record<string, (a: Row) => unknown> = {
    sx_open_thread: a => {
      const ps = (a.participants as string[]) ?? [];
      if (ps.length === 1) { const mine = this.m.table('sx_members').filter(x => x.user_id === ME).map(x => x.thread_id);
        const hit = mine.find(t => { const mem = this.m.table('sx_members').filter(x => x.thread_id === t); return mem.length === 2 && mem.some(x => x.user_id === ps[0]); });
        if (hit) return hit; }
      const id = newId();
      this.m.table('sx_threads').push({ id, title: a.group_title ?? null, created_at: this.m.iso(), member_count: ps.length + 1, retention_mode: 'keep', created_by: ME, is_group: ps.length > 1 || a.group_title != null });
      [ME, ...ps].forEach(u => this.m.table('sx_members').push({ thread_id: id, user_id: u }));
      return id;
    },
    sx_accept_friend: a => {
      const r = this.m.table('sx_friend_requests').find(x => x.id === a.request_id); if (!r) throw new Error('request not found');
      r.status = 'accepted'; const now = this.m.iso();
      this.m.table('sx_friends').push({ user_id: r.sender_id, friend_id: r.recipient_id, created_at: now }, { user_id: r.recipient_id, friend_id: r.sender_id, created_at: now });
      return null;
    },
    // Mirrors sx_claim_snap: first open + one replay, recorded as the viewer's receipt (opened_at + replay_count).
    sx_claim_snap: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg || !msg.media_path || msg.sender_id === ME) return false;
      const r = this.m.table('sx_receipts').find(x => x.message_id === msg.id && x.user_id === ME);
      if (r) { if (Number(r.replay_count) >= 1) return false; r.replay_count = Number(r.replay_count) + 1; r.opened_at = this.m.iso(); return true; }
      const row = { message_id: msg.id, user_id: ME, opened_at: this.m.iso(), replay_count: 0 };
      this.m.table('sx_receipts').push(row); this.emit('sx_receipts', 'INSERT', row); return true;
    },
    // Mirrors public.sx_set_wallpaper (20261028150000_chat_wallpaper.sql): member + valid id; same id = no-op.
    // The X+ check is client-side here (the demo has no server entitlements); the real RPC checks sx_has_tier.
    sx_set_wallpaper: a => {
      if (!this.memberIds(String(a.p_thread_id)).includes(ME)) throw new Error(WALLPAPER_ERRORS.notMember);
      if (!(WALLPAPER_IDS as readonly string[]).includes(String(a.p_wallpaper))) throw new Error(WALLPAPER_ERRORS.invalid);
      const t = this.m.table('sx_threads').find(x => x.id === a.p_thread_id); if (!t || t.wallpaper === a.p_wallpaper) return null;
      Object.assign(t, { wallpaper: a.p_wallpaper, wallpaper_path: null, wallpaper_blur: false });
      const row = { id: newId(), thread_id: a.p_thread_id, sender_id: ME, kind: 'system', body: a.p_text, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row); return null;
    },
    // Mirrors public.sx_set_wallpaper_photo (20261028180000_chat_wallpaper_photo.sql): member + own uploaded "<uid>/<uuid>.jpg";
    // only the blur changed = no line; same photo + blur = no-op. X+ is checked client-side in the demo.
    sx_set_wallpaper_photo: a => {
      if (!this.memberIds(String(a.p_thread_id)).includes(ME)) throw new Error(WALLPAPER_ERRORS.notMember);
      const path = String(a.p_path ?? ''), blur = a.p_blur === true;
      if (!isPhotoWallpaperPath(path) || path.split('/')[0] !== ME || !(path in this.uploads)) throw new Error(WALLPAPER_ERRORS.badPhoto);
      const t = this.m.table('sx_threads').find(x => x.id === a.p_thread_id); if (!t) return null;
      const samePath = t.wallpaper === 'photo' && t.wallpaper_path === path;
      if (samePath && t.wallpaper_blur === blur) return null;
      Object.assign(t, { wallpaper: 'photo', wallpaper_path: path, wallpaper_blur: blur });
      if (samePath) { this.emit('sx_threads', 'UPDATE', t); return null; }
      const row = { id: newId(), thread_id: a.p_thread_id, sender_id: ME, kind: 'system', body: a.p_text, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row); return null;
    },
    sx_set_retention: a => {
      const t = this.m.table('sx_threads').find(x => x.id === a.p_thread_id); if (t) t.retention_mode = a.p_mode;
      const row = { id: newId(), thread_id: a.p_thread_id, sender_id: ME, kind: 'system', body: a.p_text, created_at: this.m.iso(), expires_at: null };
      this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row); return null;
    },
    // Mirrors public.sx_set_message_saved (migration 20261022150000_chat_saves.sql, same rules + Dutch errors).
    sx_set_message_saved: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg) throw new Error(SAVE_ERRORS.notFound);
      if (!this.memberIds(msg.thread_id).includes(ME)) throw new Error(SAVE_ERRORS.notMember);
      if (!canSave({ kind: String(msg.kind) })) throw new Error(SAVE_ERRORS.notSaveable);
      if (a.p_saved) { if (!msg.saved) { Object.assign(msg, { saved: true, saved_by: ME, saved_at: this.m.iso(), expires_at: null }); this.emit('sx_messages', 'UPDATE', msg); } return true; }
      if (!msg.saved) return false;
      if (msg.saved_by && msg.saved_by !== ME && msg.sender_id !== ME) throw new Error(SAVE_ERRORS.notYours);
      const mode = parseRetention(msg.retention_mode ?? this.m.table('sx_threads').find(t => t.id === msg.thread_id)?.retention_mode);
      const receipts = this.m.table('sx_receipts');
      const openedByAll = this.memberIds(msg.thread_id).filter(u => u !== msg.sender_id).every(u => receipts.some(r => r.message_id === msg.id && r.user_id === u && r.opened_at));
      Object.assign(msg, { saved: false, saved_by: null, saved_at: null, expires_at: unsaveExpiry(mode, Date.now(), { createdAt: Date.parse(String(msg.created_at)), openedByAll }) }); this.emit('sx_messages', 'UPDATE', msg);
      return false;
    },
    // Bewerken / Verwijderen: mirrors public.sx_edit_message + sx_unsend_message (migration 20261027090000_chat_edit_unsend.sql).
    sx_edit_message: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg || msg.unsent_at) throw new Error(EDIT_ERRORS.notFound);
      if (msg.sender_id !== ME) throw new Error(EDIT_ERRORS.notYours);
      if (msg.kind !== 'text' || isStickerText(editableText(msg as never)) || parsePoll(editableText(msg as never))) throw new Error(EDIT_ERRORS.notText);
      if (Date.now() - Date.parse(String(msg.created_at)) >= EDIT_WINDOW_MS) throw new Error(EDIT_ERRORS.tooLate);
      const v = validateEdit(String(a.p_text ?? '')); if (!v.ok) throw new Error(v.error);
      if (isNoopEdit(msg as never, v.text)) return false;
      Object.assign(msg, { body: editedBody((msg.body as string | null) ?? null, v.text), edited_at: this.m.iso() }); this.emit('sx_messages', 'UPDATE', msg);
      return true;
    },
    sx_unsend_message: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg || msg.unsent_at) throw new Error(EDIT_ERRORS.notFound);
      if (msg.sender_id !== ME) throw new Error(EDIT_ERRORS.notYours);
      if (msg.kind === 'system') throw new Error(EDIT_ERRORS.notUnsendable);
      this.m.t.sx_poll_votes = this.m.table('sx_poll_votes').filter(v => v.message_id !== msg.id);
      Object.assign(msg, { kind: 'system', body: unsentText(this.m.profile(ME)?.display_name as string | undefined), media_path: null, view_once: false, saved: false, saved_by: null, saved_at: null, edited_at: null, unsent_at: this.m.iso() });
      this.emit('sx_messages', 'UPDATE', msg); return true;
    },
    // Peilingen: mirrors public.sx_vote_poll (migration 20261027150000_chat_polls.sql). p_option null = take the vote back.
    sx_vote_poll: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg || msg.unsent_at) throw new Error(POLL_ERRORS.notPoll);
      if (!this.memberIds(msg.thread_id).includes(ME)) throw new Error(POLL_ERRORS.notMember);
      const option = a.p_option == null ? null : Number(a.p_option);
      const err = validateVote(msg.kind === 'text' ? parsePoll(msg.body as string) : null, option); if (err) throw new Error(err);
      this.vote(msg.id, ME, option); return option;
    },
    // Doorsturen: mirrors public.sx_forward_message (migration 20261027180000_chat_forward.sql, same rules + Dutch errors).
    sx_forward_message: a => {
      const msg = this.m.table('sx_messages').find(x => x.id === a.p_message_id);
      if (!msg || msg.unsent_at) throw new Error(FORWARD_ERRORS.notFound);
      if (!this.memberIds(msg.thread_id).includes(ME)) throw new Error(FORWARD_ERRORS.notMember);
      const blocked = (u: unknown) => this.m.table('sx_blocks').some(b => (b.blocker_id === ME && b.blocked_id === u) || (b.blocker_id === u && b.blocked_id === ME));
      if (blocked(msg.sender_id) || !canForward(msg as never)) throw new Error(FORWARD_ERRORS.notForwardable);
      const targets = [...new Set(((a.p_thread_ids as string[]) ?? []).filter(Boolean))];
      if (!targets.length) throw new Error(FORWARD_ERRORS.noTargets);
      if (targets.length > FORWARD_MAX_TARGETS) throw new Error(FORWARD_ERRORS.tooMany);
      for (const t of targets) {
        const members = this.memberIds(t);
        if (!members.includes(ME)) throw new Error(FORWARD_ERRORS.notMember);
        if (members.some(u => u !== ME && blocked(u))) throw new Error(FORWARD_ERRORS.blocked);
      }
      const at = this.m.iso();
      for (const t of targets) {
        const thread = this.m.table('sx_threads').find(x => x.id === t);
        const row = { id: newId(), thread_id: t, sender_id: ME, kind: msg.kind, body: forwardBody(msg as never), media_path: msg.media_path ?? null, view_once: false, created_at: at, forwarded_at: at, expires_at: forwardExpiry(thread?.retention_mode as string | undefined, Date.now()) };
        this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row);
      }
      return targets.length;
    },
    // Group management: mirrors supabase/migrations/20261021150000_group_chat_management.sql (same errors + lines).
    sx_rename_group: a => {
      const t = this.lockGroup(a.p_thread_id), title = normalizeGroupTitle(a.p_title);
      if (!title) throw new Error(GROUP_ERRORS.badTitle);
      if (t.title !== title) { Object.assign(t, { title, is_group: true }); this.groupLine(t.id, groupRenameText(this.nameOf(ME), title)); }
      return title;
    },
    sx_add_group_members: a => {
      const t = this.lockGroup(a.p_thread_id), members = this.memberIds(t.id);
      const add = [...new Set(((a.p_user_ids as string[]) ?? []).filter(x => x && x !== ME && !members.includes(x)))];
      if (!add.length) return 0;
      if (members.length + add.length > GROUP_MAX_MEMBERS) throw new Error(GROUP_ERRORS.full);
      const blocked = (u: string) => this.m.table('sx_blocks').some(b => (b.blocker_id === ME && b.blocked_id === u) || (b.blocker_id === u && b.blocked_id === ME));
      if (add.some(u => !this.m.table('sx_friends').some(f => f.user_id === ME && f.friend_id === u) || blocked(u))) throw new Error(GROUP_ERRORS.notFriend);
      add.forEach(u => this.m.table('sx_members').push({ thread_id: t.id, user_id: u, joined_at: this.m.iso() }));
      Object.assign(t, { is_group: true, member_count: members.length + add.length });
      this.groupLine(t.id, groupAddText(this.nameOf(ME), add.map(u => this.nameOf(u)).sort((x, y) => x.localeCompare(y))));
      return add.length;
    },
    // Remove rights: mirrors supabase/migrations/20261027200000_group_remove_rights.sql (admin = created_by,
    // remover = admin or can_remove_members; never the admin, never yourself). Emits DELETE so open lists update live.
    sx_remove_group_member: a => {
      const t = this.lockGroup(a.p_thread_id), target = String(a.p_user_id ?? ''), ids = this.memberIds(t.id);
      if (target === ME) throw new Error(GROUP_ERRORS.self);
      if (!ids.includes(target)) throw new Error(GROUP_ERRORS.noTarget);
      if (target === t.created_by) throw new Error(GROUP_ERRORS.adminProtected);
      if (!canRemoveMember(ME, t.created_by as string, target, ids, this.removers(t.id))) throw new Error(GROUP_ERRORS.notAllowed);
      this.groupLine(t.id, groupRemoveText(this.nameOf(ME), this.nameOf(target)));
      const gone = this.m.table('sx_members').filter(x => x.thread_id === t.id && x.user_id === target);
      this.m.t.sx_members = this.m.table('sx_members').filter(x => !gone.includes(x));
      gone.forEach(r => this.emit('sx_members', 'DELETE', r));
      this.retentionAfterLeave(t.id, target);
      Object.assign(t, { is_group: true, member_count: this.memberIds(t.id).length });
      return null;
    },
    sx_set_can_remove_members: a => {
      const t = this.lockGroup(a.p_thread_id), target = String(a.p_user_id ?? ''), on = !!a.p_value;
      if (t.created_by !== ME) throw new Error(GROUP_ERRORS.notAdmin);
      const row = this.m.table('sx_members').find(x => x.thread_id === t.id && x.user_id === target);
      if (!row) throw new Error(GROUP_ERRORS.noTarget);
      if (target === ME) throw new Error(GROUP_ERRORS.notAdmin);
      if (!!row.can_remove_members !== on) { row.can_remove_members = on; this.emit('sx_members', 'UPDATE', row); this.groupLine(t.id, groupRightsText(this.nameOf(ME), this.nameOf(target), on)); }
      return on;
    },
    sx_leave_group: a => {
      const t = this.lockGroup(a.p_thread_id);
      this.groupLine(t.id, groupLeaveText(this.nameOf(ME)));
      this.m.t.sx_members = this.m.table('sx_members').filter(x => !(x.thread_id === t.id && x.user_id === ME));
      this.retentionAfterLeave(t.id, ME);
      const rest = this.memberIds(t.id);
      if (!rest.length) this.m.t.sx_threads = this.m.table('sx_threads').filter(x => x.id !== t.id);
      else Object.assign(t, { is_group: true, member_count: rest.length, ...(t.created_by === ME ? { created_by: rest[0] } : {}) });
      this.m.table('sx_members').filter(x => x.thread_id === t.id && x.user_id === t.created_by).forEach(x => { x.can_remove_members = false; });
      return null;
    },
    sx_hide_suggestion: () => null,
    sx_suggest_friends: a => {
      const fr = new Set(this.m.table('sx_friends').filter(x => x.user_id === ME).map(x => x.friend_id));
      return this.m.table('profiles').filter(p => p.id !== ME && !fr.has(p.id)).slice(0, Number(a.p_limit ?? 20)).map(p => ({ user_id: p.id, username: p.username, display_name: p.display_name, mutuals: 2 }));
    },
    sx_highlight_feed: () => this.m.table('sx_stories').filter(s => s.visibility === 'everyone' && String(s.expires_at) > this.m.iso()).map(s => ({
      id: s.id, owner_id: s.owner_id, created_at: s.created_at, caption: s.caption ?? null, media_path: s.media_path, media_type: s.media_type,
      likes: this.m.table('sx_highlight_likes').filter(l => l.story_id === s.id).length + 12, shares: 3, views: 240,
      subscribers: this.m.table('sx_creator_subscriptions').filter(x => x.creator_id === s.owner_id).length + (String(s.owner_id).charCodeAt(String(s.owner_id).length - 1) % 7) * 180 + 1200,
      liked: this.m.table('sx_highlight_likes').some(l => l.story_id === s.id && l.user_id === ME) })),
    sx_friend_avatar_outfits: () => [],
    // Mirrors public.sx_ensure_profile() (migration 20261019120000): create the own row from the sign-up metadata.
    sx_ensure_profile: () => {
      let p = this.m.profile(ME);
      if (!p) {
        const hex = ME.replace(/-/g, '').slice(0, 8), wanted = String(this.meta.username ?? '').toLowerCase();
        const username = /^[a-z0-9_]{3,24}$/.test(wanted) && !this.m.table('profiles').some(x => x.username === wanted) ? wanted : `user_${hex}`;
        p = { id: ME, username, display_name: String(this.meta.display_name ?? username), created_at: this.m.iso(), is_verified: false, gender: this.meta.gender === 'female' ? 'female' : 'male', avatar_path: null, activity_score: 0 };
        this.m.table('profiles').push(p);
      }
      return [{ id: p.id, username: p.username, display_name: p.display_name }];
    },
  };
  private vote(messageId: unknown, userId: string, option: number | null) {
    const t = this.m.table('sx_poll_votes'), old = t.find(v => v.message_id === messageId && v.user_id === userId);
    if (old) { this.m.t.sx_poll_votes = t.filter(v => v !== old); this.emit('sx_poll_votes', 'DELETE', old); }
    if (option === null) return;
    const row = { message_id: messageId, user_id: userId, option_index: option, created_at: this.m.iso() };
    this.m.table('sx_poll_votes').push(row); this.emit('sx_poll_votes', 'INSERT', row);
  }
  /** Mirrors app_private.sx_retention_after_leave (20261028120000_retention_after_leave.sql): a member who leaves / is
   *  removed without having opened a chat was the last one "everyone" waited for → its timer starts now (never past the 31-day cap). */
  private retentionAfterLeave(threadId: unknown, leaver: string) {
    const t = this.m.table('sx_threads').find(x => x.id === threadId), members = this.memberIds(threadId), receipts = this.m.table('sx_receipts'), now = Date.now();
    const opened = (id: unknown, u: string) => receipts.some(r => r.message_id === id && r.user_id === u && r.opened_at);
    for (const msg of this.m.table('sx_messages')) {
      if (msg.thread_id !== threadId || msg.kind === 'snap' || msg.kind === 'system' || msg.saved || msg.sender_id === leaver || opened(msg.id, leaver)) continue;
      const mode = parseRetention(msg.retention_mode ?? t?.retention_mode);
      const others = members.filter(u => u !== msg.sender_id);
      if (mode === 'keep' || !others.length || !others.every(u => opened(msg.id, u))) continue;
      const cap = unopenedChatDeadline(Date.parse(String(msg.created_at)) || now);
      msg.expires_at = new Date(Math.min(cap, now + (mode === 'after_view' ? 10 * 60e3 : 24 * H))).toISOString();
      this.emit('sx_messages', 'UPDATE', msg);
    }
  }
  private memberIds(threadId: unknown) { return this.m.table('sx_members').filter(x => x.thread_id === threadId).map(x => String(x.user_id)); }
  private nameOf(u: string) { const p = this.m.profile(u); return String(p?.display_name || p?.username || 'Iemand'); }
  private lockGroup(threadId: unknown): Row {
    const t = this.m.table('sx_threads').find(x => x.id === threadId), members = this.memberIds(threadId);
    if (!t || !members.includes(ME)) throw new Error(GROUP_ERRORS.notMember);
    if (!isGroupThread({ title: t.title as string | null, isGroup: t.is_group as boolean, memberCount: members.length })) throw new Error(GROUP_ERRORS.notGroup);
    return t;
  }
  private groupLine(threadId: unknown, body: string) {
    const row = { id: newId(), thread_id: threadId, sender_id: ME, kind: 'system', body, media_path: null, created_at: this.m.iso(), expires_at: null };
    this.m.table('sx_messages').push(row); this.emit('sx_messages', 'INSERT', row);
  }
  async rpc(name: string, args: Row = {}): Promise<Res> {
    await new Promise(r => setTimeout(r, 30));
    const fn = name === 'sx_ensure_profile' && this.faults.noEnsure ? undefined : this.appRpcs[name] ?? this.m.rpcs[name];
    if (!fn) return { data: null, error: { message: `Could not find the function public.${name}`, code: 'PGRST202' } };
    try { return { data: JSON.parse(JSON.stringify(fn(args) ?? null)), error: null }; }
    catch (e) { return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } }; }
  }
  channel(_name: string) {
    const mine: Listener[] = [];
    const ch = {
      on: (type: string, f: { event?: string; table?: string; filter?: string }, cb: (p: unknown) => void) => { if (type === 'postgres_changes' && f.table) mine.push({ table: f.table, event: f.event ?? '*', filter: f.filter, cb }); return ch; },
      subscribe: (cb?: (s: string) => void) => { mine.forEach(l => this.listeners.add(l)); setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch; },
      unsubscribe: async () => { mine.forEach(l => this.listeners.delete(l)); return 'ok'; },
      send: async () => 'ok', track: async () => 'ok', untrack: async () => 'ok', presenceState: () => ({}),
    };
    return ch;
  }
  async removeChannel(ch: { unsubscribe: () => Promise<string> }) { await ch?.unsubscribe?.(); return 'ok'; }
  storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, body: unknown, o?: { contentType?: string }) => {
        this.uploads[path] = '';
        try { this.uploads[path] = URL.createObjectURL(body instanceof Blob ? body : new Blob([body as ArrayBuffer], { type: o?.contentType })); } catch {}
        return { data: { path }, error: null };
      },
      createSignedUrl: async (path: string) => {
        // Same rule as the storage policy sx_media_read (lib/media-access.ts): kept chat media (expires_at NULL) stays readable.
        // + 20261028180000: members may read their chat's photo wallpaper.
        if (!this.uploads[path] && !this.m.table('sx_threads').some(t => t.wallpaper === 'photo' && t.wallpaper_path === path && this.memberIds(String(t.id)).includes(ME)) && !this.m.table('memories').some(x => x.storage_path === path) && !canReadMedia({ path, me: ME, messages: this.m.table('sx_messages') as never, stories: this.m.table('sx_stories') as never, now: Date.now(), legacyNullExpired: this.faults.oldMediaRule }))
          return { data: null, error: { message: MEDIA_ERRORS.gone, code: '403' } };
        return { data: { signedUrl: this.uploads[path] || artUrl(path) }, error: null };
      },
      remove: async (paths: string[]) => ({ data: paths.map(name => ({ name })), error: null }),
    }),
  };
  functions = { invoke: async (_name: string, _o?: unknown) => ({ data: { ok: true }, error: null }) };
  auth = {
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      this.authCbs.add(cb); setTimeout(() => cb('INITIAL_SESSION', this.session), 0);
      return { data: { subscription: { unsubscribe: () => { this.authCbs.delete(cb); } } } };
    },
    getSession: async () => ({ data: { session: this.session }, error: null }),
    getUser: async () => ({ data: { user: (this.session?.user as Row) ?? null }, error: null }),
    signInWithPassword: async (_c: { email: string; password: string }) => {
      // Logging in = Kevin (male start look) again.
      Object.assign(this.meta, { display_name: 'Kevin', gender: 'male' }); delete this.meta.demo_account; delete this.meta.username; Object.assign(this.m.profile(ME) ?? {}, { gender: 'male', username: 'kv.savage', display_name: 'Kevin' }); const s = this.makeSession(); this.setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null }; },
    signUp: async (c: { options?: { data?: Row } }) => {
      // Demo registration: you become the demo user with the chosen name + character set (Man/Vrouw).
      const d = c?.options?.data ?? {}; Object.assign(this.meta, d);
      // Own wardrobe per demo registration (all demo accounts share the mock user id; see stores/wardrobe wardrobeKeyFor).
      this.meta.demo_account = String(d.username ?? d.display_name ?? newId()).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || newId();
      const p = this.m.profile(ME); if (p) Object.assign(p, { gender: d.gender === 'female' ? 'female' : 'male', ...(d.display_name ? { display_name: d.display_name } : {}), ...(d.username ? { username: d.username } : {}) });
      const s = this.makeSession(); this.setSession(s, 'SIGNED_IN'); return { data: { session: s, user: s.user }, error: null }; },
    signOut: async () => { this.setSession(null, 'SIGNED_OUT'); return { error: null }; },
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async (u: { data?: Row }) => { if (u?.data) Object.assign(this.meta, u.data); const s = this.makeSession(); this.setSession(s, 'USER_UPDATED'); return { data: { user: s.user }, error: null }; }, // persisted + USER_UPDATED, like Supabase
    exchangeCodeForSession: async () => ({ data: { session: this.session }, error: null }),
    setSession: async () => ({ data: { session: this.session }, error: null }),
    startAutoRefresh: () => {}, stopAutoRefresh: () => {},
  };
}
