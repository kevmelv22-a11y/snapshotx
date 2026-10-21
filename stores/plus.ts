import {create} from 'zustand';
import {createJSONStorage,persist} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {activeTier,getPlan,isPlus,type Entitlement,type PlanId} from '../lib/plus';
import {useNow} from '../hooks/useNow';
import {createMockProvider,type PurchaseProvider} from '../lib/plus-purchases';

/** Client cache of X+ state + perk choices. Entitlements here are a UX hint only; the server (sx_entitlements) decides. */
export const purchaseProvider:PurchaseProvider=createMockProvider();
type PlusState={entitlements:Entitlement[];appIcon:string;wallpapers:Record<string,string>;bffPinId:string|null;
  setEntitlements:(e:Entitlement[])=>void;setAppIcon:(id:string)=>void;setWallpaper:(threadId:string,id:string)=>void;setBffPin:(id:string|null)=>void;
  buy:(plan:PlanId)=>Promise<string|null>;restore:()=>Promise<string>;cancel:(plan:PlanId)=>Promise<void>;resume:(plan:PlanId)=>Promise<void>;lastTrial:boolean};
export const usePlusStore=create<PlusState>()(persist((set)=>({
  entitlements:[],lastTrial:false,appIcon:'default',wallpapers:{},bffPinId:null,
  setEntitlements:entitlements=>set({entitlements}),setAppIcon:appIcon=>set({appIcon}),
  setWallpaper:(t,id)=>set(s=>({wallpapers:{...s.wallpapers,[t]:id}})),setBffPin:bffPinId=>set({bffPinId}),
  buy:async plan=>{const r=await purchaseProvider.purchase(plan);if(!r.ok)return r.message;const st=getPlan(plan)?.tier==='storage';
    set(s=>({lastTrial:r.trial,entitlements:[...s.entitlements.filter(e=>(e.tier==='storage')!==st),r.entitlement]}));return null},
  cancel:async plan=>{await purchaseProvider.cancelRenewal(plan);set(s=>({entitlements:s.entitlements.map(e=>e.productId===plan?{...e,willRenew:false}:e)}))},
  resume:async plan=>{await purchaseProvider.resumeRenewal(plan);set(s=>({entitlements:s.entitlements.map(e=>e.productId===plan?{...e,willRenew:true}:e)}))},
  restore:async()=>{const e=await purchaseProvider.restore();if(!activeTier(e,Date.now()))return 'Geen eerdere aankopen gevonden';set({entitlements:e});return 'Aankopen hersteld'},
}),{name:'sx-plus',storage:createJSONStorage(()=>AsyncStorage),partialize:s=>({entitlements:s.entitlements,appIcon:s.appIcon,wallpapers:s.wallpapers,bffPinId:s.bffPinId})}));
export function useIsPlus(){const e=usePlusStore(s=>s.entitlements);const now=useNow();return isPlus(e,now)}
export function useTier(){const e=usePlusStore(s=>s.entitlements);const now=useNow();return activeTier(e,now)}
