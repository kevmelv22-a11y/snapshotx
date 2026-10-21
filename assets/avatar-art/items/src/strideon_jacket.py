"""Step 4: own Kast thumbnail for outer-strideon-black-jacket, cut from the boy's worn torso art
(worn-bands/male/outer-strideon-black-jacket-torso.png): drop skin (chin/hands), recolour the grey tee in the
open front to dark lining, add the back collar inside the neck hole, trim the hem, then square + 8 % pad to 384 px."""
from PIL import Image; import numpy as np, cv2, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = f'{HERE}/../../worn-bands/male/outer-strideon-black-jacket-torso.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else f'{HERE}/../outer-strideon-black-jacket.png'
a = np.array(Image.open(SRC).convert('RGBA')).astype(np.int32)
H, W = a.shape[:2]
r, g, b, al = [a[..., i].copy() for i in range(4)]
lum = r * .3 + g * .59 + b * .11
yy, xx = np.mgrid[0:H, 0:W]
# 1) skin (chin, hands)
skin = ((r - b) > 30) & (r > 70)
skin = cv2.dilate(skin.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
al[skin] = 0
# 2) hem trim (below the cuffs / body hem; keep the right zipper pull) + stray bright bits at the edges
cut = np.zeros((H, W), bool)
cut |= (xx < 50) & (yy > 273)
cut |= (xx >= 50) & (xx < 131) & (yy > 263)
cut |= (xx >= 131) & (xx < 148) & (yy > 281)
cut |= (xx >= 148) & (xx < 185) & (yy > 264)
cut |= (xx >= 185) & (yy > 278)
cut |= (xx < 50) & (yy > 250) & (lum > 110)
cut |= (yy < 10) & (lum > 110)
al[cut] = 0
# 3) open front: everything between the zips that is not zipper metal becomes dark lining (keeps shading)
lz = 93 + (yy - 55) * (58 - 93) / (262 - 55)   # left zip line
rz = 128 + (yy - 55) * (136 - 128) / (262 - 55)  # right zip line
inside = (xx > lz + 3) & (xx < rz - 1) & (yy > 40) & (yy <= 263)
tee = ((lum > 58) & (lum < 135) & (np.abs(r - b) < 14)).astype(np.uint8)
n, lab = cv2.connectedComponents(tee)
seeds = {lab[y, 110] for y in (80, 150, 240) if lab[y, 110]}
teem = (np.isin(lab, list(seeds)) | (inside & (lum < 140))) & (al > 0)
rgb = a[..., :3].astype(float)
for i in range(3):
    rgb[..., i] = np.where(teem, np.minimum(rgb[..., i], rgb[..., i] * 0.30 + 6), rgb[..., i])
# 4) back collar inside the neck hole (dark rib, curved top edge, faint highlight line)
xc, half = 128, 36
hole = (al <= 20) & (yy < 60) & (np.abs(xx - xc) < half)
curve = 7 + 17 * (1 - ((xx - xc) / half) ** 2)
fill = hole & (yy >= curve)
for y in range(H):
    for x in np.nonzero(fill[y])[0]:
        if not ((al[y, :x] > 20).any() and (al[y, x + 1:] > 20).any()): fill[y, x] = False
shade = 14 + 10 * np.clip((yy - curve) / 30, 0, 1)
edge = fill & (yy < curve + 2)
for i in range(3):
    rgb[..., i] = np.where(fill, shade, rgb[..., i]); rgb[..., i] = np.where(edge, 48, rgb[..., i])
al[fill] = 255
# 4b) defringe: light halo pixels on the outline (from the old background) go transparent
solid = (al > 20).astype(np.uint8); rim = solid - cv2.erode(solid, np.ones((7, 7), np.uint8))
lum2 = rgb[..., 0] * .3 + rgb[..., 1] * .59 + rgb[..., 2] * .11
al[(rim > 0) & (lum2 > 85) & (yy > 20)] = 0
# 5) largest component only, soft edge
m = (al > 40).astype(np.uint8); n, lab, st, _ = cv2.connectedComponentsWithStats(m)
big = 1 + np.argmax(st[1:, 4]); al = np.where(lab == big, al, 0)
al = np.clip(cv2.GaussianBlur(al.astype(np.float32), (3, 3), 0), 0, 255)
out = np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
im = Image.fromarray(out, 'RGBA')
ys, xs = np.nonzero(out[..., 3] > 20); im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
side = int(max(im.size) * 1.16); can = Image.new('RGBA', (side, side), (0, 0, 0, 0))
can.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
# palette PNG like the pngquant'd siblings (libimagequant = pngquant's engine, `pip install imagequant`)
import imagequant
imagequant.quantize_pil_image(can.resize((384, 384), Image.LANCZOS), dithering_level=1.0, max_colors=256).save(OUT, optimize=True)
