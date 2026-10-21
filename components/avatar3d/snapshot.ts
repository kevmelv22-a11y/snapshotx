/**
 * Web: renders avatar PNG snapshots (stickers, chat, map pins, grid cards, portraits) with ONE shared offscreen
 * WebGL renderer, serialised through a queue and cached by rig/pose/framing/size. Native: snapshot.native.ts.
 */
import * as THREE from 'three';
import type { AvatarRig3D, Pose3DId } from '../../lib/avatar3d/rig';
import { snapshotKey } from '../../lib/avatar3d/rig';
import { addEnvironment, applyRig, buildStage, configureRenderer, createInstance, frameCamera, type Framing } from './scene';
import { loadAvatarTemplate } from './source';

const cache = new Map<string, string>();
let chain: Promise<unknown> = Promise.resolve();
let ctx: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; inst: ReturnType<typeof createInstance> } | null = null;

export function cachedSnapshot(rig: AvatarRig3D, pose: Pose3DId, framing: Framing, size: [number, number]): string | null {
  return cache.get(snapshotKey(rig, pose, framing, size[0] * 10000 + size[1])) ?? null;
}

export function supports3D(): boolean {
  if (typeof document === 'undefined') return false;
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function renderSnapshot(rig: AvatarRig3D, pose: Pose3DId, framing: Framing, size: [number, number]): Promise<string> {
  const key = snapshotKey(rig, pose, framing, size[0] * 10000 + size[1]);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const job = chain.then(async () => {
    const again = cache.get(key); if (again) return again;
    if (!ctx) {
      const tpl = await loadAvatarTemplate();
      const canvas = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      configureRenderer(renderer);
      const { scene } = buildStage();
      await addEnvironment(renderer, scene);
      const inst = createInstance(tpl); scene.add(inst.root);
      ctx = { renderer, scene, cam: new THREE.PerspectiveCamera(), inst };
    }
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const [w, h] = size;
    ctx.renderer.setPixelRatio(dpr); ctx.renderer.setSize(w, h, false);
    applyRig(ctx.inst, rig, pose);
    frameCamera(ctx.cam, framing, w / h);
    ctx.renderer.render(ctx.scene, ctx.cam);
    const url = (ctx.renderer.domElement as HTMLCanvasElement).toDataURL('image/png');
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(key, url);
    return url;
  });
  chain = job.catch(() => undefined);
  return job;
}
