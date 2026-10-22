import type {AppIconId} from './plus';
/** 192px previews (also used as web favicon / apple-touch-icon). Full 1024 icons live in assets/app-icons/<id>.png. */
export const APP_ICON_PREVIEW:Record<AppIconId,number>={
  default:require('../assets/app-icons/preview/default.png'),bliksem:require('../assets/app-icons/preview/bliksem.png'),
  vuurijs:require('../assets/app-icons/preview/vuurijs.png'),ringen:require('../assets/app-icons/preview/ringen.png'),
  lens:require('../assets/app-icons/preview/lens.png'),schild:require('../assets/app-icons/preview/schild.png'),
  neonspook:require('../assets/app-icons/preview/neonspook.png'),glas:require('../assets/app-icons/preview/glas.png'),
  gloed:require('../assets/app-icons/preview/gloed.png'),snapx:require('../assets/app-icons/preview/snapx.png'),
  boog:require('../assets/app-icons/preview/boog.png'),
};
