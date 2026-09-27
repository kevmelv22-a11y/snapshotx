import {create} from 'zustand';
import type {Captured} from '../lib/types';
type AppState={capture:Captured|null;setCapture:(capture:Captured|null)=>void;language:'nl'|'en';setLanguage:(language:'nl'|'en')=>void};
export const useApp=create<AppState>(set=>({capture:null,setCapture:capture=>set({capture}),language:'nl',setLanguage:language=>set({language})}));
