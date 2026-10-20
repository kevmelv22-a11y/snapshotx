/** Loads the avatar glTF bytes (web + native) through expo-asset. */
import { Asset } from 'expo-asset';
import type * as THREE from 'three';
import { loadAvatarGltf } from './scene';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GLB = require('../../assets/avatar3d/avatar.glb');

export function loadAvatarTemplate(): Promise<THREE.Group> {
  return loadAvatarGltf(async () => {
    const asset = Asset.fromModule(GLB);
    if (!asset.localUri) await asset.downloadAsync().catch(() => undefined);
    const res = await fetch(asset.localUri ?? asset.uri);
    if (!res.ok && res.status !== 0) throw new Error(`avatar.glb ${res.status}`);
    return res.arrayBuffer();
  });
}
