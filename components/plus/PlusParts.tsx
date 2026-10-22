import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {TierIcon,TierWordmark} from './TierBrand';
import {TIER_BRAND,isBrandTier} from '../../lib/tier-brand';
import {APP_ICONS,WALLPAPERS,featuresFor,formatPrice,getPlan,monthlyEquivalentCents,periodLabel,plansFor,tierInfo,yearlySavingPercent,type PlanId,type Tier} from '../../lib/plus';

/** Tier logo badge next to a name (Snapshot X icon by default). */
export function PlusBadge({size=18,tier='plus'}:{size?:number;tier?:Tier}){const t=isBrandTier(tier)?tier:'plus';return <View accessibilityLabel={`${TIER_BRAND[t].label}-abonnee`} style={s.badge}><TierIcon tier={t} size={size}/></View>}
/** Badge on story replies from X+ senders. */
export function PriorityReplyBadge(){return <View style={s.prio}><Ionicons name="arrow-up-circle" size={12} color={C.bg}/><Text style={s.prioText}>Voorrang</Text></View>}
/** Rewatch indicator for own stories. */
export function RewatchPill({label}:{label:string|null}){if(!label)return null;return <View style={s.rewatch}><Ionicons name="repeat" size={14} color={C.yellow}/><Text style={s.rewatchText}>{label}</Text></View>}
export function NameWithBadge({name,plus,tier}:{name:string;plus:boolean;tier?:Tier}){return <View style={s.row}><Text style={s.name}>{name}</Text>{plus&&<PlusBadge tier={tier}/>}</View>}

const TABS:Tier[]=['plus','lens','platinum','family'];const TAB_LABEL:Record<Tier,string>={plus:'X+',lens:'X Lens',platinum:'Platinum',family:'Family',storage:'Opslag'};
/** Multi-tier paywall: tier tabs (X+, Lens+, Platinum, Gezin), plan options per tier, trial CTA, storage-only add-on link. */
export function Paywall({tier,onTier,selected,onSelect,onBuy,onRestore,onTerms,onPrivacy,onStorage,busy,notice,trial,current}:{tier:Tier;onTier:(t:Tier)=>void;selected:PlanId;onSelect:(p:PlanId)=>void;onBuy:()=>void;onRestore:()=>void;onTerms:()=>void;onPrivacy:()=>void;onStorage?:()=>void;busy?:boolean;notice?:string|null;trial?:boolean;current?:PlanId|null}){
  const info=tierInfo(tier),plans=plansFor(tier),save=yearlySavingPercent(tier),plan=getPlan(selected)!,showTrial=!!trial&&plan.trialDays>0,isCur=current===selected;
  return <View style={s.pw}>
    {tier!=='storage'&&<View style={s.tabs} accessibilityRole="tablist">{TABS.map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:t===tier}} onPress={()=>onTier(t)} style={[s.tab,t===tier&&s.tabOn]} testID={`tier-tab-${t}`}><TierIcon tier={t as Exclude<Tier,'storage'>} size={26}/><Text style={[s.tabText,t===tier&&s.tabTextOn]}>{TAB_LABEL[t]}</Text></Pressable>)}</View>}
    <View style={s.hero}>{isBrandTier(tier)?<TierWordmark tier={tier} height={tier==='plus'?120:72}/>:<><Text style={s.heroLogo}>☁</Text><Text style={s.heroTitle}>{info.name}</Text></>}<Text style={s.heroSub}>{info.tagline}</Text></View>
    {info.perks.map(p=><View key={p} style={s.perk}><Ionicons name="checkmark-circle" size={18} color={C.yellow}/><Text style={s.featTitle}>{p}</Text></View>)}
    {tier!=='storage'&&[...featuresFor(tier)].reverse().map(f=><View key={f.id} style={s.feat}><Ionicons name={f.icon as any} size={22} color={C.yellow}/><View style={{flex:1}}><Text style={s.featTitle}>{f.title}</Text><Text style={s.featDesc}>{f.description}</Text></View>{f.minTier!=='plus'&&<Text style={s.newTag}>{TAB_LABEL[f.minTier]}</Text>}</View>)}
    <View style={s.plans}>{plans.map(p=>{const on=p.id===selected;return <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{checked:on}} onPress={()=>onSelect(p.id)} style={[s.plan,on&&s.planOn]}>
      {p.period==='year'&&save>0&&<View style={s.save}><Text style={s.saveText}>Bespaar {save}%</Text></View>}
      {isBrandTier(p.tier)&&<TierIcon tier={p.tier} size={30} style={{marginBottom:4}}/>}<Text style={s.planTitle}>{p.title}</Text><Text style={s.planPrice}>{formatPrice(p.priceCents)}</Text><Text style={s.planPer}>{periodLabel(p)}</Text>
      {p.period==='year'&&<Text style={s.planPer}>{formatPrice(monthlyEquivalentCents(p))} per maand</Text>}
      {!!trial&&p.trialDays>0&&<Text style={s.trialTag}>{p.trialDays} dagen gratis</Text>}</Pressable>})}</View>
    <Pressable disabled={busy||isCur} onPress={onBuy} style={[s.buy,(busy||isCur)&&{opacity:.5}]}><Text style={s.buyText}>{busy?'Bezig…':isCur?'Je huidige abonnement':current?'Overstappen':showTrial?`Probeer ${plan.trialDays} dagen gratis`:'Abonneren'}</Text></Pressable>
    {showTrial&&<Text style={s.fine}>Na de proefperiode {formatPrice(plan.priceCents)} {periodLabel(plan)}. Zeg minstens 24 uur voor het einde op om niets te betalen.</Text>}
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    <Text style={s.fine}>Wordt automatisch verlengd tot je opzegt. Opzeggen kan altijd via Abonnement beheren of de instellingen van je app store, uiterlijk 24 uur voor de verlenging. Testversie: aankopen zijn gesimuleerd, er wordt niets afgeschreven.</Text>
    {onStorage&&tier!=='storage'&&<Pressable onPress={onStorage}><Text style={[s.link,{textAlign:'center'}]}>Alleen extra opslag? Herinneringen 100 GB</Text></Pressable>}
    <View style={s.links}><Pressable onPress={onRestore}><Text style={s.link}>Aankopen herstellen</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={onTerms}><Text style={s.link}>Voorwaarden</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={onPrivacy}><Text style={s.link}>Privacy</Text></Pressable></View>
  </View>;
}

export function Locked({onUpgrade}:{onUpgrade:()=>void}){return <Pressable onPress={onUpgrade} style={s.locked}><Ionicons name="lock-closed" size={16} color={C.yellow}/><Text style={s.lockedText}>Alleen met Snapshot X+ · Bekijk abonnement</Text></Pressable>}

export function AppIconPicker({value,plus,onChange}:{value:string;plus:boolean;onChange:(id:string)=>void}){
  return <View style={s.grid}>{APP_ICONS.map(i=>{const lock=i.plusOnly&&!plus,on=value===i.id;return <Pressable key={i.id} disabled={lock} onPress={()=>onChange(i.id)} style={[s.iconCell,lock&&{opacity:.45}]} accessibilityLabel={`App-icoon ${i.label}`}>
    <View style={[s.icon,{backgroundColor:i.colors[0]},on&&s.iconOn]}><View style={[s.iconHalf,{backgroundColor:i.colors[1]}]}/><Text style={s.iconGlyph}>X</Text>{lock&&<Ionicons name="lock-closed" size={14} color="white" style={s.lockIco}/>}</View><Text style={s.iconLabel}>{i.label}</Text></Pressable>})}</View>;
}
export function WallpaperPicker({value,onChange}:{value:string;onChange:(id:string)=>void}){
  return <View style={s.grid}>{WALLPAPERS.map(w=><Pressable key={w.id} onPress={()=>onChange(w.id)} style={s.iconCell} accessibilityLabel={`Achtergrond ${w.label}`}><View style={[s.wp,{backgroundColor:w.colors[0]},value===w.id&&s.iconOn]}><View style={[s.wpHalf,{backgroundColor:w.colors[1]}]}/>{w.id==='sterren'&&<Text style={s.stars}>✦ · ✧</Text>}</View><Text style={s.iconLabel}>{w.label}</Text></Pressable>)}</View>;
}
/** Wallpaper layer behind a chat. */
export function WallpaperBackground({colors}:{colors:[string,string]}){return <View style={StyleSheet.absoluteFill} pointerEvents="none"><View style={{flex:1,backgroundColor:colors[0]}}/><View style={{flex:1,backgroundColor:colors[1]}}/></View>}

const s=StyleSheet.create({
  badge:{marginLeft:6,alignSelf:'center'},badgeText:{color:C.bg,fontWeight:'900'},
  prio:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:C.yellow,borderRadius:8,paddingHorizontal:6,paddingVertical:2},prioText:{color:C.bg,fontSize:11,fontWeight:'800'},
  rewatch:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#0008',borderRadius:14,paddingHorizontal:10,paddingVertical:5,alignSelf:'flex-start'},rewatchText:{color:C.text,fontWeight:'700',fontSize:13},
  row:{flexDirection:'row',alignItems:'center'},name:{color:C.text,fontSize:16,fontWeight:'700'},
  pw:{gap:12,padding:18},tabs:{flexDirection:'row',backgroundColor:'#000',borderRadius:20,padding:4,gap:4},tab:{flex:1,paddingVertical:6,borderRadius:16,alignItems:'center',gap:2,borderWidth:1,borderColor:'transparent'},tabOn:{backgroundColor:'#000',borderColor:C.yellow},tabText:{color:C.muted,fontWeight:'700',fontSize:12},tabTextOn:{color:C.text},
  perk:{flexDirection:'row',gap:8,alignItems:'center'},newTag:{color:C.bg,backgroundColor:C.yellow,borderRadius:8,paddingHorizontal:6,fontSize:10,fontWeight:'800',overflow:'hidden'},trialTag:{color:C.yellow,fontSize:11,fontWeight:'800',marginTop:4},hero:{alignItems:'center',paddingVertical:14},heroLogo:{fontSize:44,fontWeight:'900',color:C.bg,backgroundColor:C.yellow,borderRadius:24,paddingHorizontal:18,overflow:'hidden'},heroTitle:{color:C.text,fontSize:26,fontWeight:'900',marginTop:10},heroSub:{color:C.muted,fontSize:15,marginTop:4},
  feat:{flexDirection:'row',gap:14,alignItems:'center',backgroundColor:C.cardBg,borderRadius:14,padding:12},featTitle:{color:C.text,fontWeight:'800',fontSize:15},featDesc:{color:C.muted,fontSize:13},
  plans:{flexDirection:'row',gap:10,marginTop:6},plan:{flex:1,borderWidth:2,borderColor:C.border,borderRadius:16,padding:14,alignItems:'center',backgroundColor:C.surface},planOn:{borderColor:C.yellow},
  save:{position:'absolute',top:-11,backgroundColor:C.pink,borderRadius:10,paddingHorizontal:8,paddingVertical:2},saveText:{color:'white',fontSize:11,fontWeight:'800'},
  planTitle:{color:C.text,fontWeight:'700'},planPrice:{color:C.text,fontSize:24,fontWeight:'900',marginTop:4},planPer:{color:C.muted,fontSize:12},
  buy:{backgroundColor:C.yellow,borderRadius:26,paddingVertical:15,alignItems:'center',marginTop:4},buyText:{color:C.bg,fontWeight:'900',fontSize:17},
  notice:{color:C.yellow,textAlign:'center'},fine:{color:C.muted,fontSize:11,textAlign:'center'},links:{flexDirection:'row',justifyContent:'center',gap:8},link:{color:C.blue,fontSize:13,fontWeight:'600'},dot:{color:C.muted},
  locked:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:C.cardBg,borderRadius:12,padding:12},lockedText:{color:C.text,fontWeight:'600'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},iconCell:{alignItems:'center',width:76},icon:{width:64,height:64,borderRadius:16,overflow:'hidden',alignItems:'center',justifyContent:'center'},iconHalf:{position:'absolute',right:0,bottom:0,width:64,height:32,transform:[{skewY:'-20deg'}]},
  iconGlyph:{color:'white',fontSize:28,fontWeight:'900'},iconOn:{borderWidth:3,borderColor:C.yellow},lockIco:{position:'absolute',top:4,right:4},iconLabel:{color:C.text,fontSize:12,marginTop:4,textAlign:'center'},
  wp:{width:64,height:96,borderRadius:12,borderWidth:1,borderColor:C.border,overflow:'hidden',alignItems:'center',justifyContent:'center'},wpHalf:{position:'absolute',bottom:0,left:0,right:0,height:48},stars:{color:'white',fontSize:14},
});
