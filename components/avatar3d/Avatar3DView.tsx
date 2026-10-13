/**
 * Live, interactive 3D avatar (web): one WebGL canvas, soft studio lighting + contact shadow, gentle idle
 * breathing, drag to turn. Used for the Mode hero and the avatar screens. Native: Avatar3DView.native.tsx.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as THREE from 'three';
import type { Outfit } from '../../lib/avatar/outfit';
import type { Pose3DId } from '../../lib/avatar3d/rig';
import { addEnvironment, applyRig, buildStage, configureRenderer, createInstance, frameCamera, type Framing } from './scene';
import { loadAvatarTemplate } from './source';
import { avatar3DSupported, useAvatarRig } from './Avatar3D';

type Props = { outfit: Outfit; pose?: Pose3DId; framing?: Framing; width: number; height: number; fallback?: React.ReactNode; testID?: string; interactive?: boolean };

export function Avatar3DView({ outfit, pose = 'stand', framing = 'hero', width, height, fallback, testID, interactive = true }: Props) {
  const host = useRef<View>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; inst: ReturnType<typeof createInstance>; yaw: number; raf: number; draw: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const rig = useAvatarRig(outfit);

  useEffect(() => {
    if (!avatar3DSupported()) return;
    let disposed = false;
    const el = host.current as unknown as HTMLElement | null;
    if (!el) return;
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block'; canvas.style.touchAction = 'pan-y';
    el.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    configureRenderer(renderer); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const { scene } = buildStage({ shadow: true });
    const cam = new THREE.PerspectiveCamera();
    (async () => {
      await addEnvironment(renderer, scene);
      const tpl = await loadAvatarTemplate();
      if (disposed) return;
      const inst = createInstance(tpl); scene.add(inst.root);
      const t0 = performance.now();
      const st = { renderer, scene, cam, inst, yaw: 0, raf: 0, draw: () => {} };
      st.draw = () => {
        const t = (performance.now() - t0) / 1000;
        inst.root.rotation.y = st.yaw + Math.sin(t * 0.6) * 0.04;
        inst.root.position.y = Math.sin(t * 1.6) * 0.003;
        renderer.render(scene, cam);
        st.raf = requestAnimationFrame(st.draw);
      };
      state.current = st;
      setReady(true);
    })().catch(() => undefined);
    let drag: { x: number; yaw: number } | null = null;
    const down = (e: PointerEvent) => { if (interactive && state.current) drag = { x: e.clientX, yaw: state.current.yaw }; };
    const move = (e: PointerEvent) => { if (drag && state.current) state.current.yaw = drag.yaw + (e.clientX - drag.x) * 0.012; };
    const up = () => { drag = null; };
    canvas.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => {
      disposed = true;
      if (state.current) cancelAnimationFrame(state.current.raf);
      canvas.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      renderer.dispose(); canvas.remove(); state.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const st = state.current; if (!st || !ready) return;
    st.renderer.setSize(width, height, false);
    frameCamera(st.cam, framing, width / height);
    applyRig(st.inst, rig, pose);
    cancelAnimationFrame(st.raf); st.draw();
  }, [ready, rig, pose, framing, width, height]);

  return <View style={{ width, height }} testID={testID}>
    <View ref={host} style={{ position: 'absolute', left: 0, top: 0, width, height }}/>
    {!ready && fallback ? <View style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">{fallback}</View> : null}
  </View>;
}
