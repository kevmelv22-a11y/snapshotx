/** Routes a signed-out visitor may open. Everything else (settings, plus, memories, avatar editor, chat, call …) sends them to /login. */
const PUBLIC=new Set(['/','/login','/register','/privacy','/voorwaarden','/help','/account-verwijderen','/reset-password','/auth/callback']);
const PUBLIC_PREFIX=['/add/','/dev-'];
export function needsSignIn(pathname:string):boolean{
  const p=(pathname||'/').split(/[?#]/)[0].replace(/\/+$/,'')||'/';
  return !PUBLIC.has(p)&&!PUBLIC_PREFIX.some(x=>p.startsWith(x));
}
