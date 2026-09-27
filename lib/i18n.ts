import {useApp} from '../stores/app';
const strings={
 camera:['Camera','Camera'],chats:['Chats','Chats'],stories:['Verhalen','Stories'],friends:['Vrienden','Friends'],profile:['Profiel','Profile'],
 send:['Versturen','Send'],save:['Opslaan','Save'],share:['Delen','Share'],login:['Inloggen','Log in'],register:['Account maken','Sign up'],
 settings:['Instellingen','Settings'],logout:['Uitloggen','Log out'],empty:['Nog niets te zien','Nothing here yet'],
} as const;
export function useT(){const lang=useApp(s=>s.language);return (key:keyof typeof strings)=>strings[key][lang==='nl'?0:1];}
