# Girl outer-strideon-black-jacket: fill punched holes along the open-zip edge, smooth the
# zip silhouette, and clean the sparse thin dark tip at the inner hem (avatar-right).
import numpy as np, cv2, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
B = f'{ROOT}/assets/avatar-art/worn-bands/female/outer-strideon-black-jacket-'
C = f'{ROOT}/assets/avatar-art/worn-clean/female/outer-strideon-black-jacket-'

def zip_edges(a):
    H, W = a.shape[:2]
    rows, left, right = [], [], []
    for r in range(40, H - 2):
        cols = np.where(a[r, :, 3] > 128)[0]
        if len(cols) < 2: continue
        gaps = [(cols[i], cols[i + 1]) for i in range(len(cols) - 1) if cols[i + 1] - cols[i] > 5]
        if not gaps: continue
        g = max(gaps, key=lambda t: t[1] - t[0])
        if g[1] - g[0] < 8: continue
        if not (W * 0.2 < (g[0] + g[1]) / 2 < W * 0.8): continue
        rows.append(r); left.append(g[0]); right.append(g[1])
    return np.array(rows), np.array(left, float), np.array(right, float)

def fill_edge_holes(a):
    """Fill 1–3px transparent holes that sit inside the jacket fabric near the zip."""
    al = a[..., 3]
    solid = (al > 200).astype(np.uint8)
    # holes = transparent pixels fully enclosed by solid (or almost)
    hole = (al < 40).astype(np.uint8)
    # only near solid fabric
    near = cv2.dilate(solid, np.ones((5, 5), np.uint8)) > 0
    cand = hole & near
    # keep only small components
    n, lab, st, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), 8)
    fill = np.zeros_like(cand)
    H, W = al.shape
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area > 12: continue
        if x == 0 or y == 0 or x + w >= W or y + h >= H: continue
        # must be mostly surrounded by solid
        dil = cv2.dilate((lab == i).astype(np.uint8), np.ones((3, 3), np.uint8))
        ring = dil.astype(bool) & ~(lab == i)
        if ring.sum() == 0: continue
        if (solid[ring] > 0).mean() < 0.6: continue
        fill |= lab == i
    if not fill.any():
        return a
    rgb = cv2.inpaint(a[..., :3], fill.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
    a[..., :3] = np.where(fill[..., None], rgb, a[..., :3])
    a[..., 3] = np.where(fill, 255, al)
    return a

def smooth1d(y, k=9):
    if len(y) < k: return y.copy()
    pad = k // 2
    return np.convolve(np.pad(y, (pad, pad), mode='edge'), np.ones(k) / k, mode='valid')

def rebuild_zip(a):
    rows, L, R = zip_edges(a)
    if len(rows) < 8: return a
    Ls, Rs = smooth1d(L, 9), smooth1d(R, 9)
    al = a[..., 3].astype(np.float32)
    H, W = al.shape
    for i, r in enumerate(rows):
        lo, hi = Ls[i], Rs[i]
        # clear interior of gap
        x0, x1 = int(np.floor(lo)) + 1, int(np.ceil(hi))
        if x1 > x0:
            al[r, x0:x1] = 0
        # soft AA on fabric side only (don't invent pixels)
        for x in range(max(0, int(lo) - 2), min(W, int(lo) + 3)):
            d = (x + 0.5) - lo
            if a[r, x, 3] < 8:
                al[r, x] = 0; continue
            if -1.0 < d < 1.0:
                t = 0.5 - 0.5 * d
                al[r, x] = 0 if t < 0.25 else max(al[r, x] * t, 220 * t)
            elif d >= 1.0:
                al[r, x] = 0
        for x in range(max(0, int(hi) - 2), min(W, int(hi) + 3)):
            d = (x + 0.5) - hi
            if a[r, x, 3] < 8:
                al[r, x] = 0; continue
            if -1.0 < d < 1.0:
                t = 0.5 + 0.5 * d
                al[r, x] = 0 if t < 0.25 else max(al[r, x] * t, 220 * t)
            elif d <= -1.0:
                al[r, x] = 0
    a[..., 3] = al.clip(0, 255).astype(np.uint8)
    return a

def clean_inner_hem_tip(a):
    """Remove the sparse thin dark tip at the bottom of the left zip panel."""
    al = a[..., 3]
    H, W = al.shape
    rows, L, R = zip_edges(a)
    if len(rows) < 4: return a
    # left panel tip: columns around the lower left zip edge
    lo = float(np.median(L[-12:]))
    # for each col near lo, find bottom; if the bottom few rows are sparse (<50% opaque in a 4px window), trim
    for x in range(max(0, int(lo) - 18), min(W, int(lo) + 4)):
        ys = np.where(al[:, x] > 128)[0]
        if len(ys) == 0: continue
        yb = int(ys[-1])
        if yb < int(H * 0.75): continue
        # look at density in last 8 rows of this column neighborhood
        y0 = max(0, yb - 7)
        win = al[y0:yb + 1, max(0, x - 1):min(W, x + 2)] > 128
        dens = win.mean()
        if dens < 0.55:
            # trim back to where density becomes solid
            for y in range(yb, y0 - 1, -1):
                local = al[max(0, y - 1):y + 2, max(0, x - 1):min(W, x + 2)] > 128
                if local.mean() >= 0.7:
                    al[y + 1:, x] = 0
                    break
            else:
                al[y0:, x] = 0
    a[..., 3] = al
    # also drop tiny islands in bottom 12%
    bot = np.zeros((H, W), bool); bot[int(H * 0.88):] = True
    n, lab, st, _ = cv2.connectedComponentsWithStats(((al > 24) & bot).astype(np.uint8), 8)
    for i in range(1, n):
        if st[i, 4] < 20 and st[i, 2] <= 6:
            a[..., 3] = np.where(lab == i, 0, a[..., 3])
    return a

def defringe_zip(a):
    al = a[..., 3]
    hole = (al < 40).astype(np.uint8)
    near = cv2.dilate(hole, np.ones((5, 5), np.uint8)) > 0
    edge = (al > 0) & (al < 250) & near
    op = ((al >= 250) & ~near).astype(np.float32)
    sm = cv2.blur(a[..., :3].astype(np.float32) * op[..., None], (7, 7))
    nn = cv2.blur(op, (7, 7))[..., None]
    nb = sm / np.maximum(nn, 1e-3)
    light = edge & (a[..., :3].astype(np.float32).mean(-1) > nb.mean(-1) + 12) & (nn[..., 0] > 0.05)
    a[..., :3] = np.where(light[..., None], nb, a[..., :3]).astype(np.uint8)
    return a

def fix(path):
    a = np.array(Image.open(path).convert('RGBA'))
    a = fill_edge_holes(a)
    a = rebuild_zip(a)
    a = clean_inner_hem_tip(a)
    a = defringe_zip(a)
    Image.fromarray(a).save(path, optimize=True)
    print('fixed', os.path.basename(path))

for name in ['jacket', 'torso']:
    fix(B + name + '.png')
    cp = C + name + '.png'
    if os.path.exists(cp):
        fix(cp)
