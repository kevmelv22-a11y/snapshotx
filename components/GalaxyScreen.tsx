import React from 'react';
import {StyleSheet, View} from 'react-native';
import {ChatGalaxy} from './ChatGalaxy';

export function GalaxyScreen({children}:{children:React.ReactNode}) {
  return <View style={styles.root}><ChatGalaxy/><View style={styles.content}>{children}</View></View>;
}

const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#08090E'},content:{flex:1}});
