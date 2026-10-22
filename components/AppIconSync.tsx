import {useEffect} from 'react';
import {applyAppIcon} from '../lib/app-icon-apply';
import {useEffectiveAppIcon} from '../stores/plus';
/** Keeps favicon / native icon in sync with the persisted (and X+-gated) choice, incl. on app start. */
export function AppIconSync(){const id=useEffectiveAppIcon();useEffect(()=>{void applyAppIcon(id)},[id]);return null}
