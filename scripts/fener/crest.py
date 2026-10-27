# Replace the Fenerbahce crest on a jersey image with the real crest (reference PNG),
# fitted to the white ring of the existing badge (ellipse = perspective), shaded like the cloth.
# usage: crest.py <img.png> <x0,y0,x1,y1 search box> <crest.png> [out.png]
import sys, numpy as np, cv2
from PIL import Image
p, box, cp = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], sys.argv[3]
out = sys.argv[4] if len(sys.argv) > 4 else p
im = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
x0, y0, x1, y1 = box
reg = im[y0:y1, x0:x1, :3]
# old badge = bright/neutral or non-stripe pixels: anything not yellow and not navy
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
yellow = (r > 150) & (g > 120) & (b < 110)
navy = (b > r + 8) & (r < 90) & (g < 100)
skin_hair = (r > g + 25) & (g > b + 15) & (r > 120)   # hair/skin (girl's hand, hair)
white = (reg.min(axis=2) > 165) & ~skin_hair                      # the badge's white ring
cand = (~yellow & ~navy & ~skin_hair) | (im[y0:y1, x0:x1, 3] < 128)  # whole old badge (incl. transparent holes)
cand = cand.astype(np.uint8)
cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(cand)
k = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
wy, wx = np.nonzero(white & (lab == k))
pts = np.stack([wx, wy], 1).astype(np.float32)
hull = cv2.convexHull(pts)
bx, by, ew, eh = cv2.boundingRect(hull.astype(np.int32)); cx, cy = bx + ew / 2, by + eh / 2; ang = 0.0  # upright badge
cx += x0; cy += y0
ew *= 1.04; eh *= 1.04
print(p, 'ellipse', round(cx, 1), round(cy, 1), round(ew, 1), round(eh, 1), round(ang, 1))
# cloth shading: luminance of surrounding stripes, low-pass, relative to its mean
H, W = im.shape[:2]
S = int(max(ew, eh) * 0.7) + 4
ys, xs = slice(max(0, int(cy) - S), min(H, int(cy) + S)), slice(max(0, int(cx) - S), min(W, int(cx) + S))
patch = im[ys, xs, :3]
L = patch.max(axis=2)
ring = np.zeros(L.shape, np.uint8)
cv2.ellipse(ring, ((cx - xs.start, cy - ys.start), (ew * 1.5, eh * 1.5), ang), 1, -1)
cv2.ellipse(ring, ((cx - xs.start, cy - ys.start), (ew * 1.05, eh * 1.05), ang), 0, -1)
yl = yellow_full = (patch[..., 0] > 150) & (patch[..., 1] > 120) & (patch[..., 2] < 110) & (ring > 0)
shade = 1.0
if yl.sum() > 10:
    ref = np.median(L[yl])
    Lb = np.where(yl, L, ref).astype(np.float32)
    Lb = cv2.GaussianBlur(Lb, (0, 0), max(2, ew / 4))
    shade = np.clip(Lb / ref, 0.8, 1.1)
# warp crest to ellipse
c = np.array(Image.open(cp).convert('RGBA')).astype(np.float32)
cs = c.shape[0]
M = cv2.getRotationMatrix2D((0, 0), -ang, 1.0)
A = np.array([[ew / cs, 0, 0], [0, eh / cs, 0]], np.float32)
A[:, 2] = [-ew / 2, -eh / 2]
R = M[:, :2]
Af = R @ A[:, :2]; tf = R @ A[:, 2] + [cx - xs.start, cy - ys.start]
Afull = np.hstack([Af, tf[:, None]]).astype(np.float32)
pw = cv2.warpAffine(c, Afull, (patch.shape[1], patch.shape[0]), flags=cv2.INTER_AREA if ew < cs else cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
# slight blur so it sits at the art's resolution, then shade
pw[..., :3] = cv2.GaussianBlur(pw[..., :3], (0, 0), 0.35)
col = pw[..., :3] * (shade[..., None] if np.ndim(shade) else shade) * 0.96
a = (pw[..., 3:] / 255.0)
# cover old badge (the ellipse) fully: fill outside-crest pixels of the old badge with nearby cloth via inpaint
old = np.zeros(L.shape, np.uint8)
lab_full = np.zeros((H, W), np.uint8); lab_full[y0:y1, x0:x1] = (lab == k)
old = np.zeros(L.shape, np.uint8); cv2.ellipse(old, ((cx - xs.start, cy - ys.start), (ew * 1.12 + 2, eh * 1.12 + 2), 0), 1, -1)
old = old & (cv2.dilate(lab_full[ys, xs], np.ones((5, 5), np.uint8)) | (a[..., 0] > 0)).astype(np.uint8)
base = cv2.inpaint(patch.astype(np.uint8), (old & (a[..., 0] < 0.99)).astype(np.uint8), 4, cv2.INPAINT_TELEA).astype(np.float32)
base = np.where(old[..., None] > 0, base, patch)
im[ys, xs, :3] = base * (1 - a) + col * a
im[ys, xs, 3] = np.maximum(im[ys, xs, 3], np.maximum(a[..., 0] * 255, old * 255.0))
Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(out)
