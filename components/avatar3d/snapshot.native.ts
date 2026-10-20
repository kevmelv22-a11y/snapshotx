/**
 * Native: avatar PNG snapshots via an offscreen expo-gl context + GLView.takeSnapshotAsync (file URI), cached.
 * NOTE: needs a dev-client / app build that includes the expo-gl native module.
 */
import * as THREE from 'three';
import { GLView } from 'expo-gl';
import type { AvatarRig3D, Pose3DId } from '../../lib/avatar3d/rig';
import { snapshotKey } from '../../lib/avatar3d/rig';
import { applyRig, buildStage, configureRenderer, createInstance, frameCamera, type Framing } from './scene';
import { loadAvatarTemplate } from './source';
import { rendererForGL } from './glRenderer';

const cache = new Map<string, string>();
let chain: Promise<unknown> = Promise.resolve();

export function cachedSnapshot(rig: AvatarRig3D, pose: Pose3DId, framing: Framing, size: [number, number]): string | null {
  return cache.get(snapshotKey(rig, pose, framing, size[0] * 10000 + size[1])) ?? null;
}
export function supports3D(): boolean { return true; }

export function renderSnapshot(rig: AvatarRig3D, pose: Pose3DId, framing: Framing, size: [number, number]): Promise<string> {
  const key = snapshotKey(rig, pose, framing, size[0] * 10000 + size[1]);
  const hit = cache.get(key); if (hit) return Promise.resolve(hit);
  const job = chain.then(async () => {
    const tpl = await loadAvatarTemplate();
    const gl = await GLView.createContextAsync();
    const [w, h] = size.map(v => Math.round(v * 2));
    const renderer = rendererForGL(gl, w, h); configureRenderer(renderer);
    const { scene } = buildStage();
    const inst = createInstance(tpl); scene.add(inst.root);
    applyRig(inst, rig, pose);
    const cam = new THREE.PerspectiveCamera(); frameCamera(cam, framing, w / h);
    renderer.render(scene, cam); gl.endFrameEXP();
    const snap = await GLView.takeSnapshotAsync(gl, { format: 'png', rect: { x: 0, y: 0, width: w, height: h } });
    await GLView.destroyContextAsync(gl).catch(() => undefined);
    const uri = typeof snap.uri === 'string' ? snap.uri : '';
    cache.set(key, uri); return uri;
  });
  chain = job.catch(() => undefined);
  return job;
}
