import React from 'react';
import {Platform, StyleSheet, View, useWindowDimensions} from 'react-native';
import {ChatGalaxy} from './ChatGalaxy';
import {readableMaxWidth} from '../lib/web-layout';

/** readable: settings-style page → centred column on desktop web (lib/web-layout.ts readableMaxWidth); full width elsewhere. */
export function GalaxyScreen({children,readable}:{children:React.ReactNode;readable?:boolean}) {
  const {width}=useWindowDimensions(),max=readable?readableMaxWidth(width,Platform.OS):null;
  return <View style={styles.root}><ChatGalaxy/><View style={[styles.content,max?{width:'100%',maxWidth:max,alignSelf:'center'}:null]} testID={max?'readable-column':undefined}>{children}</View></View>;
}

const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#08090E'},content:{flex:1}});
