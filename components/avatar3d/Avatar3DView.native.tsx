/**
 * Live 3D avatar on native via expo-gl (needs a build that includes the expo-gl native module).
 * Same scene/rig code as web; renders on demand plus a light idle loop.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import type { Outfit } from '../../lib/avatar/outfit';
import type { Pose3DId } from '../../lib/avatar3d/rig';
import { applyRig, buildStage, configureRenderer, createInstance, frameCamera, type Framing } from './scene';
import { loadAvatarTemplate } from './source';
import { rendererForGL } from './glRenderer';
import { useAvatarRig } from './Avatar3D';

type Props = { outfit: Outfit; pose?: Pose3DId; framing?: Framing; width: number; height: number; fallback?: React.ReactNode; testID?: string; interactive?: boolean };

export function Avatar3DView({ outfit, pose = 'stand', framing = 'hero', width, height, testID }: Props) {
  const rig = useAvatarRig(outfit);
  const latest = useRef({ rig, pose, framing });
  useEffect(() => { latest.current = { rig, pose, framing }; }, [rig, pose, framing]);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const renderer = rendererForGL(gl, gl.drawingBufferWidth, gl.drawingBufferHeight); configureRenderer(renderer);
    const { scene } = buildStage();
    const cam = new THREE.PerspectiveCamera();
    const inst = createInstance(await loadAvatarTemplate()); scene.add(inst.root);
    let applied: unknown = null; const t0 = Date.now();
    const loop = () => {
      const l = latest.current;
      if (applied !== l) { applyRig(inst, l.rig, l.pose); frameCamera(cam, l.framing, gl.drawingBufferWidth / gl.drawingBufferHeight); applied = l; }
      inst.root.rotation.y = Math.sin((Date.now() - t0) / 1000 * 0.6) * 0.04;
      renderer.render(scene, cam); gl.endFrameEXP();
      raf.current = requestAnimationFrame(loop);
    };
    loop();
  };
  return <View style={{ width, height }} testID={testID}><GLView style={{ width, height }} onContextCreate={onContextCreate}/></View>;
}
