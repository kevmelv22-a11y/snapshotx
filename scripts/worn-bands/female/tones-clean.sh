#!/bin/sh
# Skin-tone overlays for the hair-free female bands (scripts/worn-bands/female/clean.py), with the same tones.py
# pipeline as the other bands. Run from the repo root with a python that has numpy + opencv + pillow ($PY).
set -e
PY=${PY:-python3}; T=$(mktemp -d)
mkdir -p $T/src/female $T/src/male
# all original female head / top bands too: the skin vote across items (arms vs skin-coloured cloth) must see the same set
cp assets/avatar-art/worn-bands/female/*-head.png assets/avatar-art/worn-bands/female/*-torso.png assets/avatar-art/worn-bands/female/*-under.png assets/avatar-art/worn-bands/female/*-jacket.png $T/src/female/
rm -f assets/avatar-art/worn-clean/female/*--*.png
cp assets/avatar-art/worn-clean/female/*.png $T/src/female/
cp assets/avatar-art/worn-bands/male/top-blueberry-white-tee-head.png $T/src/male/
$PY scripts/worn-bands/tones.py $T/src $T/out --json $T/tones.json
$PY - "$T" <<'PYEOF'
import json,sys,shutil,os
T=sys.argv[1]; d=json.load(open(f'{T}/tones.json'))['female']['files']; out={}
clean={f[:-4] for f in os.listdir('assets/avatar-art/worn-clean/female') if '--' not in f}
for name,ov in d:
    if name not in clean: continue
    keep=[[k,r] for k,r in ov if k.startswith('s-')]  # no hair is left in these bands
    for k,r in keep: shutil.copy(f'{T}/out/female/{name}--{k}.png',f'assets/avatar-art/worn-clean/female/{name}--{k}.png')
    if keep: out[name]=dict(keep)
json.dump(out,open('scripts/worn-bands/female/clean-tones.json','w'),indent=0)
print(len(out),'clean bands with skin overlays')
PYEOF
rm -rf $T
