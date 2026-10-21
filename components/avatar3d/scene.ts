/**
 * three.js side of the 3D avatar (shared by web canvas and native expo-gl):
 * loads assets/avatar3d/avatar.glb once, builds per-avatar instances (visibility, recoloured materials, bone pose),
 * soft studio lighting and framing presets.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { BONE_NAMES, faceFor, isNodeVisible, pose3D, type AvatarRig3D, type BoneName, type Pose3DId } from '../../lib/avatar3d/rig';

export type Framing = 'full' | 'hero' | 'card' | 'bust' | 'head' | 'sticker';

let gltfPromise: Promise<THREE.Group> | null = null;
export function loadAvatarGltf(getBuffer: () => Promise<ArrayBuffer>): Promise<THREE.Group> {
  if (!gltfPromise) {
    gltfPromise = getBuffer().then(buf => new Promise<THREE.Group>((resolve, reject) => {
      new GLTFLoader().parse(buf, '', g => resolve(g.scene), reject);
    }));
    gltfPromise.catch(() => { gltfPromise = null; });
  }
  return gltfPromise;
}

const DEG = Math.PI / 180;
type Instance = { root: THREE.Object3D; bones: Map<BoneName, { node: THREE.Object3D; rest: THREE.Quaternion; worldRest: THREE.Quaternion }>; mats: Map<string, THREE.MeshStandardMaterial>; meshes: THREE.Mesh[] };

export function createInstance(template: THREE.Group): Instance {
  const root = cloneSkinned(template);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const meshes: THREE.Mesh[] = [];
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const src = m.material as THREE.MeshStandardMaterial;
      let mat = mats.get(src.name);
      if (!mat) { mat = tuneMaterial(src.clone()); mats.set(src.name, mat); }
      m.material = mat; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; meshes.push(m);
    }
  });
  root.updateMatrixWorld(true);
  const bones = new Map<BoneName, { node: THREE.Object3D; rest: THREE.Quaternion; worldRest: THREE.Quaternion }>();
  for (const n of BONE_NAMES) {
    const node = root.getObjectByName(n);
    if (node) bones.set(n, { node, rest: node.quaternion.clone(), worldRest: node.getWorldQuaternion(new THREE.Quaternion()) });
  }
  return { root, bones, mats, meshes };
}

function tuneMaterial(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const name = m.name;
  const phys = m as THREE.MeshPhysicalMaterial;
  if (phys.isMeshPhysicalMaterial) { phys.sheen = 0; phys.clearcoat = ['EyeWhite', 'Iris', 'Pupil'].includes(name) ? 0.6 : 0; }
  // soft "toy-like" shading: fabrics matte with sheen, skin smooth, eyes glossy
  if (['Outer', 'OuterTrim', 'Top', 'Bottom', 'BottomSeam'].includes(name)) { m.roughness = 0.92; m.metalness = 0; }
  if (name === 'Skin' || name === 'Lip') { m.roughness = 0.55; m.metalness = 0; }
  if (name === 'Hair') { m.roughness = 0.6; m.metalness = 0; }
  if (['EyeWhite', 'Iris', 'Pupil'].includes(name)) { m.roughness = 0.12; }
  if (name === 'Highlight') { m.emissive = new THREE.Color('#FFFFFF'); m.emissiveIntensity = 1.4; }
  m.envMapIntensity = name === 'Skin' ? 0.28 : 0.2;
  return m;
}

export function applyRig(inst: Instance, rig: AvatarRig3D, poseId: Pose3DId) {
  const pose = pose3D(poseId);
  const face = faceFor(pose.expression);
  for (const m of inst.meshes) m.visible = isNodeVisible(nodeName(m), rig, face);
  for (const [slot, hex] of Object.entries(rig.colors)) {
    const mat = inst.mats.get(slot);
    if (mat && hex) { mat.color.set(hex); if (slot === 'Hair' || slot === 'Brow') mat.color.multiplyScalar(0.72); }
  }
  const q = new THREE.Quaternion(), e = new THREE.Euler(), inv = new THREE.Quaternion();
  for (const [name, b] of inst.bones) {
    const r = pose.bones[name];
    if (!r) { b.node.quaternion.copy(b.rest); continue; }
    // rotation about character axes expressed in the bone's rest frame: rest * (W⁻¹ · R · W)
    e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'ZXY'); q.setFromEuler(e);
    inv.copy(b.worldRest).invert();
    const local = inv.multiply(q).multiply(b.worldRest);
    b.node.quaternion.copy(b.rest).multiply(local);
  }
  inst.root.updateMatrixWorld(true);
}

/** glTF meshes with several primitives become Groups of Meshes: the module name is on the parent. */
function nodeName(m: THREE.Object3D): string {
  return m.name && !/_\d+$/.test(m.name) ? m.name : (m.parent?.name ?? m.name);
}

export function buildStage(opts: { shadow?: boolean; ground?: string | null } = {}) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight('#FFF6E8', '#B89400', 0.35); scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFF4E6', 2.2); key.position.set(-1.6, 3.2, 3.0); scene.add(key);
  const fill = new THREE.DirectionalLight('#FFF0D6', 0.35); fill.position.set(2.4, 1.4, 2.2); scene.add(fill);
  const rim = new THREE.DirectionalLight('#FFE9B8', 1.4); rim.position.set(1.0, 2.6, -2.6); scene.add(rim);
  const rimL = new THREE.DirectionalLight('#FFFFFF', 0.8); rimL.position.set(-2.0, 1.8, -2.2); scene.add(rimL);
  if (opts.shadow) {
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const cam = key.shadow.camera as THREE.OrthographicCamera; cam.left = -1.2; cam.right = 1.2; cam.top = 2.4; cam.bottom = -0.4; cam.near = 0.5; cam.far = 8;
  }
  // soft contact shadow under the feet (radial gradient texture, no canvas needed)
  const N = 64, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot((x + 0.5) / N * 2 - 1, (y + 0.5) / N * 2 - 1);
    const a = Math.max(0, 1 - d) ** 1.8; const i = (y * N + x) * 4;
    data[i] = 90; data[i + 1] = 66; data[i + 2] = 0; data[i + 3] = Math.round(a * 150);
  }
  const tex = new THREE.DataTexture(data, N, N); tex.needsUpdate = true;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.42), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.002, 0.02); blob.name = 'ContactShadow'; scene.add(blob);
  return { scene, blob };
}

/** Camera presets in avatar metres (feet at y=0, hair top ≈ 1.93). */
export function frameCamera(cam: THREE.PerspectiveCamera, framing: Framing, aspect: number) {
  const P: Record<Framing, { cy: number; h: number; tilt: number; yaw: number }> = {
    full: { cy: 0.97, h: 2.15, tilt: 0.05, yaw: 0.12 },
    hero: { cy: 0.93, h: 2.32, tilt: 0.04, yaw: 0.18 },
    card: { cy: 0.74, h: 1.6, tilt: 0.03, yaw: 0.1 },
    sticker: { cy: 1.36, h: 1.2, tilt: 0.04, yaw: 0.1 },
    bust: { cy: 1.6, h: 0.98, tilt: 0.02, yaw: 0.16 },
    head: { cy: 1.64, h: 0.62, tilt: 0.0, yaw: 0.12 },
  };
  const p = P[framing];
  cam.fov = 18; cam.aspect = aspect;
  const vh = Math.max(p.h, p.h * 0.62 / aspect); // keep width for wide/narrow boxes
  const dist = (vh / 2) / Math.tan((cam.fov / 2) * Math.PI / 180);
  cam.position.set(Math.sin(p.yaw) * dist, p.cy + dist * p.tilt, Math.cos(p.yaw) * dist);
  cam.near = 0.1; cam.far = dist + 10;
  cam.lookAt(0, p.cy, 0); cam.updateProjectionMatrix();
}

export type AvatarRenderer = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; inst: Instance | null };

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.setClearColor(0x000000, 0);
}

/** Optional PBR environment (web only; needs PMREM which works on expo-gl too but costs a frame). */
export async function addEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}
