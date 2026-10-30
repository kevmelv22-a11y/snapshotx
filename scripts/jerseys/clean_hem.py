# Cloned jerseys whose generated shirt is shorter than the base jersey: below the hem the bands still carry the
# generated image's white cargo (waistband, pocket next to the hand, light halos). Works for striped shirts with
# white stripes too: the hem is the lowest row that still has >= 20 % coloured (not light, not skin) shirt pixels,
# rows below it keep only skin; in the 45 rows above it only light pixels OUTSIDE that row's shirt span are cut.
# Where the base jersey's band has arm/hand skin at a cut pixel, that skin is used (no holes in the wrist).
# HEM=<canvas y> overrides the detected hem (a dark waistband counted as shirt).
# usage: clean_hem.py <gender> <item> ...   (edits assets/avatar-art/worn-bands/<g>/<item>-{torso,under,head}.png)
import os, sys, json, numpy as np, cv2
from PIL import Image
g = sys.argv[1]
BASE = {'male': 'top-acmilan-jersey', 'female': 'top-sparta-jersey'}[g]
M = json.load(open('scripts/worn-bands/meta.json'))[g]['pieces']
REACH = 45
def masks(a):
    r, gg, bl = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(2), a[..., :3].min(2)
    light = (mn > 110) & (mx - mn < 55)
    skin = (r > gg + 12) & (gg > bl + 4) & (r > 110) & (gg > 0.58 * r) & (bl > 0.38 * r) & ~light
    return light, skin, mn
for item in sys.argv[2:]:
    P = M[item]; x, y, w, h = P['torso']
    t = np.array(Image.open(f'assets/avatar-art/worn-bands/{g}/{item}-torso.png').convert('RGBA')).astype(np.float32)
    light, skin, _ = masks(t)
    colr = (t[..., 3] > 128) & ~light & ~skin
    rows = colr.sum(1)
    span = np.nonzero(colr.any(0))[0]; sw = span.max() - span.min()
    hem = int(os.environ['HEM']) if os.environ.get('HEM') else y + int(np.nonzero(rows > 0.2 * sw)[0].max())
    # per canvas row: the coloured shirt span
    spans = {}
    for ry in range(h):
        xs = np.nonzero(colr[ry])[0]
        if len(xs) > 0.2 * sw: spans[y + ry] = (x + xs.min(), x + xs.max())
    print(item, 'hem y', hem)
    for b in ['head', 'torso', 'under']:
        if b not in P: continue
        bx, by, bw, bh = P[b]; p = f'assets/avatar-art/worn-bands/{g}/{item}-{b}.png'
        a = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
        light, skin, mn = masks(a)
        yy = np.arange(bh)[:, None] + by; xx = np.arange(bw)[None, :] + bx
        outside = np.zeros((bh, bw), bool)
        for ry in range(bh):
            cy = by + ry
            if hem - REACH < cy <= hem and cy in spans:
                l, rr = spans[cy]; outside[ry] = (xx[0] < l - 1) | (xx[0] > rr + 1)
        cut = ((yy > hem) & ~skin) | (light & outside)
        cut = (cv2.dilate(cut.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~skin & ((yy > hem) | outside) & (mn > 60) | ((yy > hem) & ~skin)
        n = int((cut & (a[..., 3] > 0)).sum())
        a[..., 3] = np.where(cut, 0, a[..., 3])
        bp = np.array(Image.open(f'assets/avatar-art/worn-bands/{g}/{BASE}-{b}.png').convert('RGBA')).astype(np.float32)
        if bp.shape == a.shape:
            _, bskin, _ = masks(bp); a = np.where((cut & bskin & (bp[..., 3] > 128))[..., None], bp, a)
        Image.fromarray(a.astype(np.uint8)).save(p); print(' ', b, 'cut', n)
