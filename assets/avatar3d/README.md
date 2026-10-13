# 3D avatar assets

- `src/build_avatar.py` — Blender 4.2 (headless) script that procedurally builds the whole avatar: armature
  (hips/spine/chest/neck/head, arms, legs), skinned modular meshes (body, 7 hair styles, tee / long sleeves,
  pullover hoodie, open jacket, straight trousers, joggers, sneakers), face variants (smile, neutral, laugh,
  surprised, wink lids) and named materials that the app recolours.
- `avatar.glb` — generated output (quantized with gltf-transform `quantize`, KHR_mesh_quantization).

Rebuild:

    blender -b -P assets/avatar3d/src/build_avatar.py -- --out /tmp/raw.glb
    npx @gltf-transform/cli@4 quantize /tmp/raw.glb assets/avatar3d/avatar.glb

Optional Cycles preview: add `--render out.png [--hair curly] [--look hoodie|jacket]`.

License: all geometry is original procedural work of the Snapshot X project (no third-party models,
textures or HDRIs; no brand logos). Tools used: Blender (GPL — output is not covered by the GPL),
gltf-transform (MIT), three.js (MIT, runtime).
