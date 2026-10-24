import {useCallback,useEffect,useState} from 'react';
import {staffDb} from '../lib/staff-client';
import {staffMock} from '../lib/staff-mock';
import {useSession} from './useSession';

export type StaffRole='MODERATOR'|'SENIOR MODERATOR'|'ADMIN'|'OWNER';
const staffNames:StaffRole[]=['MODERATOR','SENIOR MODERATOR','ADMIN','OWNER'];

export function useStaffRoles(){
 const real=useSession().session;
 const mock=staffMock();
 const session=mock?({user:{id:mock.actorId}} as NonNullable<typeof real>):real;
 const [roles,setRoles]=useState<StaffRole[]>([]);
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  if(!session){setRoles([]);setLoading(false);return}
  setLoading(true);
  const {data:assignments,error}=await staffDb().from('user_roles').select('role_id').eq('user_id',session.user.id);
  if(error){setRoles([]);setLoading(false);return}
  const ids=(assignments||[]).map(a=>a.role_id);
  if(!ids.length){setRoles([]);setLoading(false);return}
  const {data}=await staffDb().from('roles').select('name').in('id',ids);
  setRoles((data||[]).map(r=>r.name).filter((r):r is StaffRole=>staffNames.includes(r as StaffRole)));
  setLoading(false);
 },[session?.user.id]);
 useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer)},[refresh]);
 return {roles,loading,refresh,isStaff:roles.length>0,
  isAdmin:roles.includes('ADMIN')||roles.includes('OWNER'),
  isOwner:roles.includes('OWNER')};
}
