// Only createPortal is used (components/FriendMap.web.tsx); @types/react-dom is not installed.
declare module 'react-dom' {
  import type {ReactNode, ReactPortal} from 'react';
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}
