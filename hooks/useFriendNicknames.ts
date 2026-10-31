import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {nicknameError,validateNickname} from '../lib/friend-nicknames';
import {friendlyError} from '../lib/db-errors';

/** My nicknames for friends (sx_friend_nicknames), shared by chat list / chat / friend profile. One load per account. */
let owner='',map:Map<string,string>=new Map(),loading:Promise<void>|null=null;
const listeners=new Set<(m:Map<string,string>)=>void>();
const emit=()=>listeners.forEach(l=>l(map));

function load(uid:string){
 if(owner===uid&&loading)return loading;
 owner=uid;map=new Map();
 loading=(async()=>{const {data,error}=await supabase.from('sx_friend_nicknames').select('friend_id,nickname').eq('owner_id',uid);
  if(owner!==uid)return;if(!error){map=new Map((data||[]).map(x=>[String((x as {friend_id:string}).friend_id),String((x as {nickname:string}).nickname)]));emit()}})();
 return loading;
}

export function useFriendNicknames(uid:string|undefined):ReadonlyMap<string,string>{
 const [m,setM]=useState<Map<string,string>>(()=>uid&&owner===uid?map:new Map());
 useEffect(()=>{if(!uid)return;listeners.add(setM);void load(uid).then(()=>{if(owner===uid)setM(map)});return()=>{listeners.delete(setM)}},[uid]);
 return m;
}

/** Save (or with '' / the real name: remove) my nickname for a friend. Returns a Dutch error or null. */
export async function saveFriendNickname(uid:string,friendId:string,raw:string,realName?:string|null):Promise<string|null>{
 const v=validateNickname(raw,realName);if(!v.ok)return v.error;
 const res=v.value===null
  ?await supabase.from('sx_friend_nicknames').delete().eq('owner_id',uid).eq('friend_id',friendId)
  :await supabase.from('sx_friend_nicknames').upsert({owner_id:uid,friend_id:friendId,nickname:v.value},{onConflict:'owner_id,friend_id'});
 if(res.error)return nicknameError(res.error)??friendlyError(res.error,'Naam bewerken');
 if(owner===uid){map=new Map(map);if(v.value===null)map.delete(friendId);else map.set(friendId,v.value);emit()}
 return null;
}
