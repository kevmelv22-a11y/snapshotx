"""Simplified small tier icons (for 22–26 px: profile badge + paywall tabs), 96x96 RGBA in assets/tiers/small/.
Built from the source logo crops so colours stay identical:
  plus     - the bare flame/lightning X badge, outer lightning wisps trimmed, X redrawn bold white so it reads at 22 px
  lens     - one thick cyan ring (colour sampled from the lens ring) around a bold X in the same cyan
  platinum - the silver ghost with the X filled solid dark (no see-through interior)
  family   - the X badge with one small cyan ghost (cropped from the family row) at its lower right"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sx-assets/tier-logos.png'
OUT = 'assets/tiers/small'; os.makedirs(OUT, exist_ok=True)
im = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
S = 96
def unmatte(c, floor=10):
    a = c.max(2); a = np.where(a < floor, 0, a); al = a / 255.0
    rgb = np.where(al[..., None] > 0, c / np.maximum(al[..., None], 1e-6), 0).clip(0, 255)
    return Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')
def tight(img, thr=40):
    a = np.asarray(img)[..., 3]; ys, xs = np.where(a > thr)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
def fit(img, size=S, pad=4):
    img = img.copy(); img.thumbnail((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    c = Image.new('RGBA', (size, size)); c.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2)); return c
def badge():
    reg = im[60:436, 660:960]                   # row-1 icon
    a = unmatte(reg, floor=40)
    # keep only the dense badge body: thin lightning wisps have low local density
    m = Image.fromarray(((reg.max(2) > 120) * 255).astype(np.uint8))
    dens = np.asarray(m.filter(ImageFilter.BoxBlur(14)), float) / 255
    keep = Image.fromarray(((dens > 0.45) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))
    arr = np.asarray(a).astype(float); arr[..., 3] *= np.asarray(keep, float) / 255
    return tight(Image.fromarray(arr.astype(np.uint8)), 60)
def save(img, name): fit(img).save(f'{OUT}/{name}.png', optimize=True); print(name)
def crisp_x(img):
    """Overdraw a bold white X (dark outline, cyan glow) on the badge centre so the X survives 22 px."""
    W, H = img.size; L = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(L)
    cx, cy, r = W * 0.5, H * 0.52, W * 0.2; sw = max(3, round(W * 0.12))
    for col, w in (((10, 14, 24, 235), sw + round(W * 0.07)), ((255, 255, 255, 255), sw)):
        for sg in (1, -1): d.line([(cx - r, cy - sg * r * 1.15), (cx + r, cy + sg * r * 1.15)], fill=col, width=w)
    glow = Image.new('RGBA', (W, H)); gd = ImageDraw.Draw(glow)
    for sg in (1, -1): gd.line([(cx - r, cy - sg * r * 1.15), (cx + r, cy + sg * r * 1.15)], fill=(120, 245, 255, 200), width=sw + round(W * 0.14))
    out = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(W * 0.03))); return Image.alpha_composite(out, L)
b = crisp_x(badge())
# boost: slightly stronger alpha so it reads on dark at tiny size
def solid(img, gain=1.35):
    arr = np.asarray(img).astype(float); arr[..., 3] = (arr[..., 3] * gain).clip(0, 255); return Image.fromarray(arr.astype(np.uint8))
save(solid(b), 'plus')
# lens: sample ring colour from row-2 icon ring pixels
ring = im[442:754, 340:651]; m = ring.max(2) > 200; cyan = tuple(int(v) for v in ring[m & (ring[..., 2] > ring[..., 0] + 60)].mean(0))
L = Image.new('RGBA', (S * 4, S * 4)); d = ImageDraw.Draw(L); c = S * 2
d.ellipse([16, 16, S * 4 - 16, S * 4 - 16], outline=cyan + (255,), width=34)
w = 30; r = 92
for sgn in (1, -1): d.line([(c - r, c - sgn * r), (c + r, c + sgn * r)], fill=cyan + (255,), width=w)
glow = L.filter(ImageFilter.GaussianBlur(10)); out = Image.alpha_composite(glow, L)
save(out, 'lens')
# platinum: ghost from row 3; fill transparent interior (holes enclosed by the ghost) with dark grey
p = unmatte(im[805:1084, 358:549], floor=10); p = tight(p, 30); arr = np.asarray(p).astype(float)
alpha = arr[..., 3] > 60
from collections import deque
H, W = alpha.shape; outside = np.zeros_like(alpha); q = deque()
for y in range(H):
    for x in (0, W - 1):
        if not alpha[y, x]: outside[y, x] = True; q.append((y, x))
for x in range(W):
    for y in (0, H - 1):
        if not alpha[y, x] and not outside[y, x]: outside[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and not alpha[ny, nx] and not outside[ny, nx]: outside[ny, nx] = True; q.append((ny, nx))
inside = ~outside
dark = np.array([18, 18, 24], float); a01 = arr[..., 3:4] / 255
filled = arr[..., :3] * a01 + dark * (1 - a01)              # composite over dark where inside the ghost
arr[..., :3] = np.where(inside[..., None], filled, arr[..., :3]); arr[..., 3] = np.where(inside, 255, arr[..., 3])
save(Image.fromarray(arr.astype(np.uint8)), 'platinum')
# family: badge + one small ghost (right ghost of row 4)
g = tight(unmatte(im[1215:1376, 335:445], floor=30), 60)
F = Image.new('RGBA', (S * 4, S * 4)); bb = b.copy(); bb.thumbnail((S * 3, int(S * 3.6)), Image.LANCZOS)
F.alpha_composite(solid(bb), (S * 4 // 2 - bb.width // 2 - 60, (S * 4 - bb.height) // 2))
gg = g.copy(); gg.thumbnail((int(S * 2.1), int(S * 2.5)), Image.LANCZOS); gg = solid(gg, 1.3)
F.alpha_composite(gg, (S * 4 - gg.width - 4, S * 4 - gg.height - 4))
save(F, 'family')
