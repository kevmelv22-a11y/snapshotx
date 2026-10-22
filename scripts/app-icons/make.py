"""Kevin's 10 logo images (Oct 22 2026) -> selectable app icons.
For each: square 1024x1024 RGB (no alpha) on pure black (iOS rejects alpha icons), plus a 192px preview.
- 'schild' has white rounded-square corners: flood-filled from the corners to black.
- 'snapx' comes from the SNAP SHOT wordmark: only the fire/lightning X, cropped square.
Usage: python3 scripts/app-icons/make.py <attachments dir>"""
import sys
from collections import deque
from PIL import Image
import numpy as np
SRC = sys.argv[1]
ICONS = [('bliksem', '01M5GHNPVXARZN0AKERSX2WSV7'), ('vuurijs', '01M5GHNS9Y827PNATHG7PCTEDR'), ('ringen', '01M5GHNVHSX87RYKVAQM57G6HP'),
         ('lens', '01M5GHNY5YY6EF4ZGEKH42WBFR'), ('schild', '01M5GHP0CYNK4FB9PC56PJVJ84'), ('neonspook', '01M5GHP2PH3VEF1Z7XFWRY86QH'),
         ('glas', '01M5GHPCZETTQ5FEFRJDB75CYY'), ('gloed', '01M5GHQ4PGNSRH345J99JPWFRX'), ('snapx', '01M5GHQE3ET435EKT9EAK1QTGF'),
         ('boog', '01M5GHQWN9M1BEETDCFA1QVQ7T')]
def corners_to_black(a, thr=200):
    """Flood fill near-white pixels connected to the image border -> black (removes the white rounded-square corners)."""
    h, w, _ = a.shape; white = a.min(2) > thr; seen = np.zeros((h, w), bool); q = deque()
    for y in range(h):
        for x in (0, w - 1): q.append((y, x))
    for x in range(w):
        for y in (0, h - 1): q.append((y, x))
    while q:
        y, x = q.popleft()
        if seen[y, x] or not white[y, x]: continue
        seen[y, x] = True
        if y > 0: q.append((y - 1, x))
        if y < h - 1: q.append((y + 1, x))
        if x > 0: q.append((y, x - 1))
        if x < w - 1: q.append((y, x + 1))
    out = a.copy(); out[seen] = 0
    # soften the anti-aliased fringe next to the removed corners
    near = np.zeros_like(seen); near[1:] |= seen[:-1]; near[:-1] |= seen[1:]; near[:, 1:] |= seen[:, :-1]; near[:, :-1] |= seen[:, 1:]
    fringe = near & ~seen & (a.min(2) > 120); out[fringe] = (out[fringe] * 0.25).astype(out.dtype)
    return out
TEXT_END = 1400
def x_square(a):
    """Crop the X of the SNAP SHOT wordmark: right part of the colourful content, made square with black padding."""
    # drop the white/cyan-ish "SNAP SHOT" letters left of the X (they end at x≈1367 in the 2752px source); keep the X's flames
    a = a.copy(); L = a[:, :TEXT_END].astype(int); letters = (L.max(2) - L.min(2) < 90) | (L[..., 2] > L[..., 0])
    L[letters] = 0; L[:, :TEXT_END - 120] = 0; a[:, :TEXT_END] = L.astype(np.uint8)
    sat = a.max(2).astype(int) - a.min(2).astype(int); m = (sat > 60) & (a.max(2) > 90)
    ys, xs = np.where(m); x0 = xs.min(); y0, y1, x1 = ys.min(), ys.max(), xs.max()
    side = int(max(x1 - x0, y1 - y0) * 1.18); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    out = np.zeros((side, side, 3), np.uint8); sx, sy = cx - side // 2, cy - side // 2
    for oy in range(side):
        yy = sy + oy
        if 0 <= yy < a.shape[0]:
            xa, xb = max(sx, 0), min(sx + side, a.shape[1]); out[oy, xa - sx:xb - sx] = a[yy, xa:xb]
    return out
for name, f in ICONS:
    a = np.asarray(Image.open(f'{SRC}/{f}.png').convert('RGB'))
    if name == 'schild': a = corners_to_black(a)
    if name == 'snapx': a = x_square(a)
    if a.shape[0] != a.shape[1]:
        s = max(a.shape[:2]); pad = np.zeros((s, s, 3), np.uint8); pad[(s - a.shape[0]) // 2:(s - a.shape[0]) // 2 + a.shape[0], (s - a.shape[1]) // 2:(s - a.shape[1]) // 2 + a.shape[1]] = a; a = pad
    a = a.copy(); a[a.max(2) < 6] = 0  # true black background
    im = Image.fromarray(a, 'RGB').resize((1024, 1024), Image.LANCZOS)
    im.save(f'assets/app-icons/{name}.png', optimize=True); im.resize((192, 192), Image.LANCZOS).save(f'assets/app-icons/preview/{name}.png', optimize=True)
    print(name, im.size, im.mode)
d = Image.open('assets/snapshotx-app-icon.png').convert('RGB').resize((192, 192), Image.LANCZOS); d.save('assets/app-icons/preview/default.png', optimize=True); print('default preview')
