import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {C} from '../../lib/theme';
import {APP_ICONS,FEATURES,PLANS,WALLPAPERS,formatPrice,monthlyEquivalentCents,periodLabel,yearlySavingPercent,type PlanId} from '../../lib/plus';

/** Small "X+" badge next to a name. */
export function PlusBadge({size=14}:{size?:number}){return <View accessibilityLabel="X+-abonnee" style={[s.badge,{paddingHorizontal:size*0.4,borderRadius:size}]}><Text style={[s.badgeText,{fontSize:size*0.8}]}>X+</Text></View>}
/** Badge on story replies from X+ senders. */
export function PriorityReplyBadge(){return <View style={s.prio}><Ionicons name="arrow-up-circle" size={12} color={C.bg}/><Text style={s.prioText}>Voorrang</Text></View>}
/** Rewatch indicator for own stories. */
export function RewatchPill({label}:{label:string|null}){if(!label)return null;return <View style={s.rewatch}><Ionicons name="repeat" size={14} color={C.yellow}/><Text style={s.rewatchText}>{label}</Text></View>}
export function NameWithBadge({name,plus}:{name:string;plus:boolean}){return <View style={s.row}><Text style={s.name}>{name}</Text>{plus&&<PlusBadge/>}</View>}

export function Paywall({selected,onSelect,onBuy,onRestore,onTerms,onPrivacy,busy,notice}:{selected:PlanId;onSelect:(p:PlanId)=>void;onBuy:()=>void;onRestore:()=>void;onTerms:()=>void;onPrivacy:()=>void;busy?:boolean;notice?:string|null}){
  const save=yearlySavingPercent();
  return <View style={s.pw}>
    <View style={s.hero}><Text style={s.heroLogo}>X+</Text><Text style={s.heroTitle}>Snapshot X+</Text><Text style={s.heroSub}>Meer uit je vrienden, chats en verhalen</Text></View>
    {FEATURES.map(f=><View key={f.id} style={s.feat}><Ionicons name={f.icon as any} size={22} color={C.yellow}/><View style={{flex:1}}><Text style={s.featTitle}>{f.title}</Text><Text style={s.featDesc}>{f.description}</Text></View></View>)}
    <View style={s.plans}>{PLANS.map(p=>{const on=p.id===selected;return <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{checked:on}} onPress={()=>onSelect(p.id)} style={[s.plan,on&&s.planOn]}>
      {p.period==='year'&&save>0&&<View style={s.save}><Text style={s.saveText}>Bespaar {save}%</Text></View>}
      <Text style={s.planTitle}>{p.title}</Text><Text style={s.planPrice}>{formatPrice(p.priceCents)}</Text><Text style={s.planPer}>{periodLabel(p)}</Text>
      {p.period==='year'&&<Text style={s.planPer}>{formatPrice(monthlyEquivalentCents(p))} per maand</Text>}</Pressable>})}</View>
    <Pressable disabled={busy} onPress={onBuy} style={[s.buy,busy&&{opacity:.5}]}><Text style={s.buyText}>{busy?'Bezig…':'Abonneren'}</Text></Pressable>
    {!!notice&&<Text style={s.notice}>{notice}</Text>}
    <Text style={s.fine}>Wordt automatisch verlengd tot je opzegt. Opzeggen kan altijd via de instellingen van je app store, uiterlijk 24 uur voor de verlenging. Testversie: aankopen zijn gesimuleerd, er wordt niets afgeschreven.</Text>
    <View style={s.links}><Pressable onPress={onRestore}><Text style={s.link}>Aankopen herstellen</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={onTerms}><Text style={s.link}>Voorwaarden</Text></Pressable><Text style={s.dot}>·</Text><Pressable onPress={onPrivacy}><Text style={s.link}>Privacy</Text></Pressable></View>
  </View>;
}

export function Locked({onUpgrade}:{onUpgrade:()=>void}){return <Pressable onPress={onUpgrade} style={s.locked}><Ionicons name="lock-closed" size={16} color={C.yellow}/><Text style={s.lockedText}>Alleen met X+ · Bekijk abonnement</Text></Pressable>}

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
  badge:{backgroundColor:C.yellow,paddingVertical:1,marginLeft:6,alignSelf:'center'},badgeText:{color:C.bg,fontWeight:'900'},
  prio:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:C.yellow,borderRadius:8,paddingHorizontal:6,paddingVertical:2},prioText:{color:C.bg,fontSize:11,fontWeight:'800'},
  rewatch:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#0008',borderRadius:14,paddingHorizontal:10,paddingVertical:5,alignSelf:'flex-start'},rewatchText:{color:C.text,fontWeight:'700',fontSize:13},
  row:{flexDirection:'row',alignItems:'center'},name:{color:C.text,fontSize:16,fontWeight:'700'},
  pw:{gap:12,padding:18},hero:{alignItems:'center',paddingVertical:14},heroLogo:{fontSize:44,fontWeight:'900',color:C.bg,backgroundColor:C.yellow,borderRadius:24,paddingHorizontal:18,overflow:'hidden'},heroTitle:{color:C.text,fontSize:26,fontWeight:'900',marginTop:10},heroSub:{color:C.muted,fontSize:15,marginTop:4},
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
