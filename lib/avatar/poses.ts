/**
 * Avatar poses, expressions and avatar stickers (roadmap step 8).
 * Pure data + helpers: no React / RN imports, so it runs under `node --test` and in Metro.
 * Arm angles are degrees around the shoulder pivots used by components/avatar/WardrobeAvatar
 * (left arm positive = raised outward, right arm negative = raised outward).
 */
import { parsePoll, pollPreview } from '../chat-polls';

export type AvatarExpression = 'neutral' | 'smile' | 'laugh' | 'wink' | 'surprised';
export type AvatarHand = 'rest' | 'peace' | 'thumb';
export type AvatarGaze = 'front' | 'down' | 'side';

export type PoseId = 'stand' | 'wave' | 'thumbs' | 'laugh' | 'cheer' | 'peace' | 'shrug' | 'wink' | 'surprised';

export type AvatarPose = {
  id: PoseId;
  /** Dutch UI label. */
  label: string;
  armL: number;
  armR: number;
  handL: AvatarHand;
  handR: AvatarHand;
  expression: AvatarExpression;
  gaze: AvatarGaze;
  /** Head tilt in degrees. */
  head: number;
};

const pose = (id: PoseId, label: string, armL: number, armR: number, expression: AvatarExpression, extra: Partial<AvatarPose> = {}): AvatarPose =>
  ({ id, label, armL, armR, handL: 'rest', handR: 'rest', expression, gaze: 'front', head: 0, ...extra });

export const AVATAR_POSES: readonly AvatarPose[] = [
  pose('stand', 'Staan', 0, 0, 'smile'),
  pose('wave', 'Zwaaien', 140, 0, 'smile', { head: -5 }),
  pose('thumbs', 'Duim omhoog', 0, 28, 'smile', { handR: 'thumb', head: 4 }),
  pose('laugh', 'Lachen', 18, -18, 'laugh', { head: -6 }),
  pose('cheer', 'Juichen', 152, -152, 'laugh'),
  pose('peace', 'Peace', 0, -166, 'smile', { handR: 'peace', head: 7 }),
  pose('shrug', 'Schouders ophalen', 26, -26, 'neutral', { gaze: 'side', head: -8 }),
  pose('wink', 'Knipoog', 0, 28, 'wink', { handR: 'thumb', head: 5 }),
  pose('surprised', 'Verbaasd', 38, -38, 'surprised'),
];

export const POSES_BY_ID: ReadonlyMap<PoseId, AvatarPose> = new Map(AVATAR_POSES.map(p => [p.id, p]));
export const DEFAULT_POSE: PoseId = 'stand';

export function isPoseId(v: unknown): v is PoseId {
  return typeof v === 'string' && POSES_BY_ID.has(v as PoseId);
}
export function getPose(id: unknown): AvatarPose {
  return POSES_BY_ID.get(isPoseId(id) ? id : DEFAULT_POSE)!;
}

// ------------------------------------------------------------------ stickers

export type AvatarStickerId = 'hoi' | 'top' | 'haha' | 'yes' | 'peace' | 'geen-idee' | 'knipoog' | 'wauw' | 'hartje' | 'oke' | 'sst' | 'bel-me' | 'sterk' | 'rock-on' | 'begrepen' | 'duimen' | 'bravo' | 'oeps' | 'jij';
/** Sticker-only art poses (no profile pose, so no DB value): drawn from their own image, standing pose as fallback. */
export type StickerArtPose = 'heart' | 'ok' | 'shush' | 'callme' | 'flex' | 'rock' | 'salute' | 'crossed' | 'clap' | 'facepalm' | 'point';
export type AvatarSticker = { id: AvatarStickerId; pose: PoseId; /** Sticker-only pose image (overrides `pose` when the art exists). */ art?: StickerArtPose; caption: string; /** Accent colour behind the caption. */ color: string; /** Caption at the top (pose uses the low hands area). */ captionTop?: boolean };

export const AVATAR_STICKERS: readonly AvatarSticker[] = [
  { id: 'hoi', pose: 'wave', caption: 'Hoi!', color: '#FFE436' },
  { id: 'top', pose: 'thumbs', caption: 'Top!', color: '#34C759', captionTop: true },
  { id: 'haha', pose: 'laugh', caption: 'Haha', color: '#FF9500' },
  { id: 'yes', pose: 'cheer', caption: 'Yes!', color: '#FF5B95' },
  { id: 'peace', pose: 'peace', caption: 'Peace', color: '#4298FF' },
  { id: 'geen-idee', pose: 'shrug', caption: 'Geen idee', color: '#AE16C7' },
  { id: 'knipoog', pose: 'wink', caption: 'Deal', color: '#00C7BE', captionTop: true },
  { id: 'wauw', pose: 'surprised', caption: 'Wauw!', color: '#FF3B30' },
  { id: 'hartje', pose: 'stand', art: 'heart', caption: 'Hartje', color: '#FF2D55' },
  { id: 'oke', pose: 'stand', art: 'ok', caption: 'Oké!', color: '#30D158' },
  { id: 'sst', pose: 'stand', art: 'shush', caption: 'Sst!', color: '#5E5CE6', captionTop: true },
  { id: 'bel-me', pose: 'stand', art: 'callme', caption: 'Bel me!', color: '#FF9F0A' },
  { id: 'sterk', pose: 'stand', art: 'flex', caption: 'Sterk!', color: '#64D2FF' },
  { id: 'rock-on', pose: 'stand', art: 'rock', caption: 'Rock on!', color: '#BF5AF2', captionTop: true },
  { id: 'begrepen', pose: 'stand', art: 'salute', caption: 'Begrepen!', color: '#FFD60A' },
  { id: 'duimen', pose: 'stand', art: 'crossed', caption: 'Duimen!', color: '#FF6482', captionTop: true },
  { id: 'bravo', pose: 'stand', art: 'clap', caption: 'Bravo!', color: '#30D158', captionTop: true },
  { id: 'oeps', pose: 'stand', art: 'facepalm', caption: 'Oeps!', color: '#FF9F0A', captionTop: true },
  { id: 'jij', pose: 'stand', art: 'point', caption: 'Jij!', color: '#0A84FF', captionTop: true },
];
export const STICKERS_BY_ID: ReadonlyMap<string, AvatarSticker> = new Map(AVATAR_STICKERS.map(s => [s.id, s]));

/** Snap editor: avatar stickers share the editor's sticker list; their `emoji` field holds this token. */
export const EDITOR_TOKEN_PREFIX = 'avatar:';
export const editorToken = (id: AvatarStickerId) => `${EDITOR_TOKEN_PREFIX}${id}`;
export function stickerFromEditorToken(token: string | null | undefined): AvatarSticker | null {
  if (!token || !token.startsWith(EDITOR_TOKEN_PREFIX)) return null;
  return STICKERS_BY_ID.get(token.slice(EDITOR_TOKEN_PREFIX.length)) ?? null;
}

/**
 * Chat: an avatar sticker is a normal text message whose body is exactly `[avatar-sticker:<id>]`.
 * Old clients simply show the token as text; no schema change needed. The sender's own outfit is used to draw it.
 */
const CHAT_RE = /^\[avatar-sticker:([a-z-]{1,24})\]$/;
export const chatStickerBody = (id: AvatarStickerId) => `[avatar-sticker:${id}]`;
export function stickerFromChatBody(body: string | null | undefined): AvatarSticker | null {
  const m = typeof body === 'string' ? CHAT_RE.exec(body.trim()) : null;
  return m ? STICKERS_BY_ID.get(m[1]) ?? null : null;
}
// ------------------------------------------------------------------ duo stickers (Snapchat "Friendmoji")

/** Duo sticker: your avatar and your friend's avatar together (1-on-1 chats). `me`/`friend` are the two poses. */
export type DuoStickerId = 'samen-hoi' | 'high-five' | 'bffs' | 'feest' | 'topteam' | 'hahaha' | 'mis-je' | 'sorry';
export type DuoSticker = { id: DuoStickerId; me: PoseId | StickerArtPose; friend: PoseId | StickerArtPose; caption: string; color: string };
export const DUO_STICKERS: readonly DuoSticker[] = [
  { id: 'samen-hoi', me: 'wave', friend: 'wave', caption: 'Hoi hoi!', color: '#FFE436' },
  { id: 'high-five', me: 'cheer', friend: 'cheer', caption: 'High five!', color: '#FF9500' },
  { id: 'bffs', me: 'heart', friend: 'heart', caption: "BFF's", color: '#FF2D55' },
  { id: 'feest', me: 'cheer', friend: 'laugh', caption: 'Feestje!', color: '#BF5AF2' },
  { id: 'topteam', me: 'thumbs', friend: 'thumbs', caption: 'Topteam', color: '#34C759' },
  { id: 'hahaha', me: 'laugh', friend: 'laugh', caption: 'Hahaha', color: '#FF9F0A' },
  { id: 'mis-je', me: 'heart', friend: 'stand', caption: 'Mis je!', color: '#FF6482' },
  { id: 'sorry', me: 'facepalm', friend: 'shrug', caption: 'Sorry!', color: '#64D2FF' },
];
export const DUO_BY_ID: ReadonlyMap<string, DuoSticker> = new Map(DUO_STICKERS.map(s => [s.id, s]));
const DUO_RE = /^\[duo-sticker:([a-z-]{1,24})\]$/;
export const duoChatBody = (id: DuoStickerId) => `[duo-sticker:${id}]`;
export function duoFromChatBody(body: string | null | undefined): DuoSticker | null {
  const m = typeof body === 'string' ? DUO_RE.exec(body.trim()) : null;
  return m ? DUO_BY_ID.get(m[1]) ?? null : null;
}
/** Who stands next to the sender on a duo sticker: the other person of the 1-on-1 chat (null in groups / unknown). */
export function duoPartner(senderId: string, memberIds: readonly string[]): string | null {
  const others = [...new Set(memberIds)].filter(id => id && id !== senderId);
  return others.length === 1 ? others[0] : null;
}

/** Chat list / notification preview text for a message body. */
export function chatPreviewText(body: string | null | undefined): string {
  const poll = parsePoll(body);
  if (poll) return pollPreview(poll);
  const s = stickerFromChatBody(body);
  if (s) return `Avatarsticker: ${s.caption}`;
  const d = duoFromChatBody(body);
  return d ? `Duosticker: ${d.caption}` : body ?? '';
}

// ------------------------------------------------------------------ story rings

export type StoryRingState = 'none' | 'unseen' | 'seen';
/** Ring around an avatar: unseen when any active story was not viewed yet, seen when all were, none when nothing is active. */
export function storyRingState(stories: readonly { id: string; expiresAt: number }[], viewedIds: ReadonlySet<string> | readonly string[], now: number): StoryRingState {
  const viewed = viewedIds instanceof Set ? viewedIds : new Set(viewedIds as readonly string[]);
  const active = stories.filter(s => s.expiresAt > now);
  if (!active.length) return 'none';
  return active.some(s => !viewed.has(s.id)) ? 'unseen' : 'seen';
}

/** Colours per ring state (gradient start/end); seen is grey, none has no ring. */
export function storyRingColors(state: StoryRingState): [string, string] | null {
  if (state === 'unseen') return ['#FFE436', '#FF5B95'];
  if (state === 'seen') return ['#6C6C70', '#8E8E93'];
  return null;
}
