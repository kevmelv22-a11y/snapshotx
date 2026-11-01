/** The chat currently on screen (set by app/chat/[id].tsx while focused). Read by the foreground push handler so a
 *  push for the open chat does not show a banner on top of it (Snapchat behaviour). */
let openThread:string|null=null;
export const setActiveChat=(id:string|null)=>{openThread=id};
export const activeChat=()=>openThread;
