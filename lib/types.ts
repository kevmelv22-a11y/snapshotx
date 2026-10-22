import type {PhotoFilterId} from './photo-filters';
import type {FaceGeometry} from './face-filters/types';
export type Profile = { id:string; username:string; display_name:string; avatar_path:string|null; activity_score:number };
export type Message = { id:string; thread_id:string; sender_id:string; kind:'text'|'photo'|'video'|'voice'|'snap'|'system'; body:string|null; media_path:string|null; view_once:boolean; view_seconds?:number|null; saved?:boolean; saved_by?:string|null; duration_ms?:number|null; expires_at:string|null; created_at:string };
export type Story = { id:string; owner_id:string; media_path:string; media_type:'photo'|'video'; caption:string|null; created_at:string; expires_at:string; visibility:'friends'|'everyone' };
/** `face`/`imageSize`: optional pre-detected face (image pixels); undefined = detect on the photo. */
export type Captured = { uri:string; type:'photo'|'video'; filterId?:PhotoFilterId; face?:FaceGeometry|null; imageSize?:{width:number;height:number} };
