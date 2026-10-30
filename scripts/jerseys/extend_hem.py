# Male cloned jerseys shorter than the base (hem above ~y 485) show the trousers' belt under the hem. Stretches the
# lowest 40 shirt rows of the torso band down to TARGET (canvas y), only inside the shirt span, keeping hands/arms.
# Run after clean_hem.py (same HEM= override).  usage: extend_hem.py <gender> <target_y> <item> ...
import os, sys, json, numpy as np
from PIL import Image
sys.path.insert(0, 'scripts/jerseys')
g, T = sys.argv[1], int(sys.argv[2])
M = json.load(open('scripts/worn-bands/meta.json'))[g]['pieces']
def masks(a):
    r, gg, bl = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(2), a[..., :3].min(2)
    light = (mn > 110) & (mx - mn < 55)
    return (r > gg + 12) & (gg > bl + 4) & (r > 110) & (gg > 0.58 * r) & (bl > 0.38 * r) & ~light
for item in sys.argv[3:]:
    x, y, w, h = M[item]['torso']; p = f'assets/avatar-art/worn-bands/{g}/{item}-torso.png'
    a = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
    skin = masks(a); shirt = (a[..., 3] > 128) & ~skin
    rows = shirt.sum(1); hem = int(os.environ['HEM']) - y if os.environ.get('HEM') else int(np.nonzero(rows > 0.2 * shirt.any(0).sum())[0].max())
    t = T - y; s0 = hem - 40
    if t <= hem or t >= h: print(item, 'skip', y + hem); continue
    cols = np.nonzero(shirt[hem - 6:hem + 1].any(0))[0]; l, r = cols.min(), cols.max()
    src = a.copy(); print('  span', l, r, 'hem', hem, 's0', s0, 't', t)
    for ry in range(s0, t + 1):
        sy = s0 + (ry - s0) * (hem - s0) / (t - s0); sy = int(round(sy))
        row = src[sy, l:r + 1]; keep = skin[ry, l:r + 1] | masks(row[None])[0]
        a[ry, l:r + 1] = np.where(keep[:, None], a[ry, l:r + 1], row)
    Image.fromarray(a.astype(np.uint8)).save(p); print(item, 'hem', y + hem, '->', T)
