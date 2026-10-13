/** three.js WebGLRenderer on an expo-gl context (native). */
import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

export function rendererForGL(gl: ExpoWebGLRenderingContext, width: number, height: number): THREE.WebGLRenderer {
  const canvas = {
    width, height, style: {}, clientWidth: width, clientHeight: height,
    addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl,
  } as unknown as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true, alpha: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  return renderer;
}
