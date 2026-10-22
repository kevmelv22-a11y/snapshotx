import {Platform} from 'react-native';
import {Asset} from 'expo-asset';
import {APP_ICON_PREVIEW} from './app-icon-assets';
import {appIconInfo,type AppIconId} from './plus';

function setLink(rel:string,href:string){
  let el=document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el)}
  el.type='image/png';el.href=href;el.dataset.sxIcon='1';
}
/** Apply the effective app icon: web swaps favicon + apple-touch-icon now; native asks the OS (alternate icons need a build containing the plugin). */
export async function applyAppIcon(id:AppIconId){
  if(Platform.OS==='web'){
    if(typeof document==='undefined')return;
    const uri=Asset.fromModule(APP_ICON_PREVIEW[id]).uri;
    setLink('icon',uri);setLink('apple-touch-icon',uri);document.documentElement.dataset.sxAppIcon=id;return;
  }
  try{
    const m=require('expo-alternate-app-icons');
    if(!m?.supportsAlternateIcons)return;
    const want=appIconInfo(id).native;
    if((m.getAppIconName?.()??null)!==want)await m.setAlternateAppIcon(want);
  }catch{/* native module missing in builds made before the plugin was added */}
}
