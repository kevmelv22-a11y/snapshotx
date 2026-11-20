import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {CELL_EMOJI,GAME_LABEL,gameStatus,markOf,type GameMsg,type GameState} from '../../lib/chat-games';

/** Boter, kaas en eieren card in a 1-on-1 chat. The newest accepted move of a game is playable; older moves are a
 *  small read-only board; an illegal (ignored) move says so. */
export function GameBubble({msg,messageId,current,accepted,me,friendName,onPlay,busy}:{msg:GameMsg;messageId:string;current:GameState|undefined;accepted:boolean;me:string;friendName:string;onPlay:(s:GameState,cell:number)=>void;busy?:boolean}){
  if(!accepted)return <Text style={s.muted} testID="game-invalid">🎮 Ongeldige zet (genegeerd)</Text>;
  const live=!!current&&current.messageId===messageId;
  if(!live)return <View style={s.old} testID="game-old"><Text style={s.oldTitle}>🎮 {GAME_LABEL.title}</Text><View style={s.miniGrid}>{msg.board.map((c,i)=><View key={i} style={s.miniCell}><Text style={s.miniText}>{CELL_EMOJI[c]}</Text></View>)}</View></View>;
  const st=current!,myTurn=!st.winner&&st.turn===markOf(st,me);
  return <View style={s.card} testID="game">
    <Text style={s.kicker}>🎮 SPELLETJE</Text>
    <Text style={s.title}>{GAME_LABEL.title}</Text>
    <Text style={s.sub}>{st.x===me?'Jij bent ❌':'Jij bent ⭕'}</Text>
    <View style={s.grid}>{st.board.map((c,i)=>{const win=!!st.line?.includes(i),can=myTurn&&c==='-'&&!busy;return <Pressable key={i} onPress={()=>can&&onPlay(st,i)} disabled={!can} style={[s.cell,win&&s.win,can&&s.open]} testID={`game-cell-${i}`} accessibilityRole="button" accessibilityLabel={c==='-'?`Vakje ${i+1}, leeg`:`Vakje ${i+1}, ${c==='x'?'kruisje':'rondje'}`}><Text style={s.mark}>{CELL_EMOJI[c]}</Text></Pressable>})}</View>
    <Text style={[s.status,myTurn&&s.statusMine]} testID="game-status">{gameStatus(st,me,friendName)}</Text>
  </View>;
}
const s=StyleSheet.create({
  card:{backgroundColor:'#1D1730',borderRadius:18,padding:12,borderWidth:1,borderColor:'#FFFC0044',width:232},
  kicker:{color:'#FFFC00',fontWeight:'900',fontSize:11,letterSpacing:.8},
  title:{color:'#fff',fontWeight:'900',fontSize:16,marginTop:2},
  sub:{color:'#C9C2D0',fontSize:12,marginBottom:8},
  grid:{flexDirection:'row',flexWrap:'wrap',width:207,gap:6},
  cell:{width:65,height:65,borderRadius:12,backgroundColor:'#2C2443',alignItems:'center',justifyContent:'center'},
  open:{backgroundColor:'#3A2F5C',borderWidth:1,borderColor:'#FFFC0055'},
  win:{backgroundColor:'#5B2DB8'},
  mark:{fontSize:32},
  status:{color:'#D8D2E0',fontWeight:'800',fontSize:14,marginTop:9},
  statusMine:{color:'#FFFC00'},
  old:{opacity:.75},
  oldTitle:{color:'#C9C2D0',fontSize:12,fontWeight:'700',marginBottom:4},
  miniGrid:{flexDirection:'row',flexWrap:'wrap',width:66,gap:2},
  miniCell:{width:20,height:20,borderRadius:4,backgroundColor:'#2C2443',alignItems:'center',justifyContent:'center'},
  miniText:{fontSize:11},
  muted:{color:'#9C95A8',fontStyle:'italic',fontSize:14},
});
