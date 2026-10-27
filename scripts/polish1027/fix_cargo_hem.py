# Boy bottom-white-cargo: harden the soft alpha fade at the hem without shortening the silhouette.
# Fabric colour and outline length stay the same — only the multi-pixel haze collapses to ~1px AA.
import numpy as np, os
from PIL import Image
from scipy.ndimage import distance_transform_edt

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATH = f'{ROOT}/assets/avatar-art/worn-bands/male/bottom-white-cargo-legs.png'

a = np.array(Image.open(PATH).convert('RGBA'))
al0 = a[..., 3].astype(np.float32)
H, W = al0.shape
new_al = al0.copy()
boosted = 0

for x in range(W):
    ys = np.where(al0[:, x] > 20)[0]
    if len(ys) == 0: continue
    yb = int(ys[-1])
    for y in range(max(0, yb - 12), yb):
        if al0[y, x] > 35:
            new_al[y, x] = 255
            boosted += 1
    new_al[yb, x] = float(np.clip(al0[yb, x], 40, 160))

solid = (new_al >= 250).astype(np.uint8)
outside = solid == 0
_, (iy, ix) = distance_transform_edt(outside, return_indices=True)
edge = (new_al > 0) & (new_al < 250)
bot = np.full(W, -1)
for x in range(W):
    ys = np.where(new_al[:, x] > 20)[0]
    if len(ys): bot[x] = ys[-1]
hem = np.zeros((H, W), bool)
for x in range(W):
    if bot[x] < 0: continue
    hem[max(0, bot[x] - 8):, x] = True
edge &= hem
nb = a[iy, ix, :3].astype(np.float32)
a[..., :3] = np.where(edge[..., None], nb, a[..., :3]).astype(np.uint8)
a[..., 3] = new_al.clip(0, 255).astype(np.uint8)

# Zero any leftover sub-tip haze below the AA row
al = a[..., 3].astype(np.float32)
for x in range(W):
    ys = np.where(al[:, x] > 20)[0]
    if len(ys) == 0: continue
    yb = int(ys[-1])
    tip = yb
    for y in range(yb, max(-1, yb - 4), -1):
        if al[y, x] < 250:
            tip = y; break
    if tip + 1 < H:
        al[tip + 1:, x] = 0
    if al[tip, x] < 40:
        al[tip, x] = 40
a[..., 3] = al.astype(np.uint8)

Image.fromarray(a).save(PATH, optimize=True)
print('cargo hem fixed', 'boosted', boosted, 'soft left', int(((a[..., 3] > 0) & (a[..., 3] < 180)).sum()))
