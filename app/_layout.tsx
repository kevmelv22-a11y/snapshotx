import React from 'react';
import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {SessionProvider} from '../hooks/useSession';
import {C} from '../lib/theme';
export default function Root(){return <SessionProvider><StatusBar style="light"/><Stack screenOptions={{headerStyle:{backgroundColor:C.bg},headerTintColor:C.text,contentStyle:{backgroundColor:C.bg}}}><Stack.Screen name="(auth)" options={{headerShown:false}}/><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="settings" options={{headerShown:false}}/><Stack.Screen name="avatar-editor" options={{headerShown:false}}/><Stack.Screen name="blocked-users" options={{headerShown:false}}/><Stack.Screen name="reset-password" options={{headerShown:false}}/><Stack.Screen name="compose" options={{title:'Jouw Snap'}}/><Stack.Screen name="chat/[id]" options={{title:'Chat'}}/><Stack.Screen name="story/[id]" options={{title:'Verhaal'}}/><Stack.Screen name="staff/index" options={{title:'Staffpaneel'}}/><Stack.Screen name="report" options={{title:'Melding maken'}}/><Stack.Screen name="delete-account" options={{title:'Account verwijderen'}}/></Stack></SessionProvider>}
