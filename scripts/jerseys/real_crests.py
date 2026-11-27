# Replace the generated / recoloured look-alike crests on the club jerseys with the real club logos.
# Logos: official SVGs from Wikipedia/Wikimedia, rendered to PNG (height 600, transparent) into LOGO_DIR.
# For every item + gender the old crest box (canvas coords of the worn bands, read off zoomed crops) is first filled
# per column by interpolating between the shirt just above and just below the box (keeps vertical stripes and the
# fabric shading), then the logo is pasted at the box centre (height = box height), shaded with the shirt's own
# low-frequency luminance so it sits in the fabric. Applied to the torso + under bands, the Kast preview art
# (assets/avatar-art/worn/<g>/, located by template matching the torso band) and the Kast thumbnail (same).
# usage: python scripts/jerseys/real_crests.py <logo_dir> [club ...]
import sys, json, numpy as np, cv2
from PIL import Image
LOGO_DIR = sys.argv[1]
BOX = {  # club: {gender: (x0, y0, x1, y1)} inclusive, canvas coords — measured 2026-11-27 real kits
    'mvv':      {'male': (218, 274, 247, 310), 'female': (220, 254, 248, 286)},
    'fortuna':  {'male': (210, 272, 252, 314), 'female': (218, 255, 258, 292)},
    'rkc':      {'male': (214, 270, 248, 308), 'female': (220, 256, 250, 290)},
    'heracles': {'male': (214, 272, 247, 314), 'female': (216, 254, 248, 292)},
    'pec':      {'male': (212, 276, 248, 312), 'female': (212, 258, 248, 292)},
    'volendam': {'male': (208, 268, 250, 312), 'female': (212, 250, 250, 290)},
    'nac':      {'male': (210, 280, 248, 316), 'female': (218, 264, 252, 298)},
}
SCALE = {'heracles': 1.0, 'pec': 1.0, 'fortuna': 1.0, 'volendam': 1.0}   # logo height relative to the box height (default 0.97)
ROTATE = {'volendam': -22}  # 2026/27 Volendam crest sits tilted on the shirt
M = json.load(open('scripts/worn-bands/meta.json'))
BEFORE = sys.argv[2] if (len(sys.argv) > 2 and not sys.argv[2].endswith('.png') and '/' in sys.argv[2]) else '/workspace/sx-shots/real-kits-2026-11-27/pre-crest'
ARGS = [a for a in sys.argv[2:] if a in BOX or (not a.startswith('/') and a in BOX)]
# optional before dir: any argv path that exists as a directory
for a in sys.argv[2:]:
    import os
    if os.path.isdir(a): BEFORE = a
CLUBS = [a for a in sys.argv[2:] if a in BOX] or list(BOX)

def logo(club, h):
    im = Image.open(f'{LOGO_DIR}/{club}.png').convert('RGBA'); im = im.crop(im.getbbox())
    if club in ROTATE:
        im = im.rotate(ROTATE[club], expand=True, resample=Image.BICUBIC)
        im = im.crop(im.getbbox())
    w = max(1, round(im.width * h / im.height))
    # downscale in two steps for a crisp but not aliased small crest
    return np.array(im.resize((w * 4, h * 4), Image.LANCZOS).resize((w, h), Image.LANCZOS)).astype(np.float32)

def patch(a, box, club, scale=1.0, pad=(2, 2, 2, 3), keep=None, top_min=None):
    """a: float RGBA array; box in a's coords (may be fractional for scaled targets). The fill covers the box + pad
    (old crest rings / drop shadows reaching past the box, mostly below it; pad = left, top, right, bottom); the logo is sized on the box itself. keep: bool mask of original
    pixels drawn back on top (the girl's pendant just above her crest)."""
    orig = a.copy()
    bx0, by0, bx1, by1 = [int(round(v)) for v in box]
    x0, y0, x1, y1 = bx0 - pad[0], by0 - pad[1], bx1 + pad[2], by1 + pad[3]
    H, W = a.shape[:2]
    if x0 < 1 or y0 < 3 or x1 >= W - 1 or y1 >= H - 3: return False
    # Inpaint the old crest so hoops, stripes and sashes stay intact (vertical lerp left a grey box).
    mask = np.zeros(a.shape[:2], np.uint8); mask[y0:y1 + 1, x0:x1 + 1] = 255
    bgr = cv2.cvtColor(np.clip(a[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    inp = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
    a[..., :3] = cv2.cvtColor(inp, cv2.COLOR_BGR2RGB).astype(np.float32)
    lum = a[y0:y1 + 1, x0:x1 + 1, :3].mean(2)
    h = max(4, round((by1 - by0 + 1) * SCALE.get(club, 0.97) * scale * (0.9 if top_min is not None else 1)))
    L = logo(club, h); lh, lw = L.shape[:2]
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
    if top_min is not None: cy = max(cy, top_min + h / 2)   # logo starts below the girl's pendant
    lx, ly = int(round(cx - lw / 2)), int(round(cy - lh / 2))
    shade = cv2.GaussianBlur(lum, (0, 0), 3); shade = shade / max(shade.mean(), 1)
    shade = cv2.resize(shade, (lw, lh)) if shade.shape != (lh, lw) else shade
    shade = np.clip(0.75 + 0.25 * shade, 0.85, 1.08)[..., None]
    rgb = np.clip(L[..., :3] * shade, 0, 255); al = L[..., 3:4] / 255 * 0.97
    sub = a[ly:ly + lh, lx:lx + lw]
    sub[..., :3] = sub[..., :3] * (1 - al) + rgb * al
    if keep is not None: a[keep] = orig[keep]
    return True

def flat(a):
    """RGBA float -> grey on a mid-grey backdrop (transparent areas must not drive the match)."""
    al = a[..., 3:4] / 255; rgb = a[..., :3] * al + 128 * (1 - al)
    return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)

def locate(target, tmpl_rgba, scales):
    """Best (score, scale, (x, y)) placing the template (a chest window of the band) into target."""
    T = flat(target); best = None
    for s in scales:
        t = cv2.resize(tmpl_rgba, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] >= T.shape[0] or t.shape[1] >= T.shape[1]: continue
        r = cv2.matchTemplate(T, flat(t), cv2.TM_CCOEFF_NORMED)
        _, v, _, loc = cv2.minMaxLoc(r)
        if best is None or v > best[0]: best = (v, s, loc)
    return best

for club in CLUBS:
    item = f'top-{club}-jersey'
    for g, box in BOX[club].items():
        P = M[g]['pieces'][item]
        for b in ['torso', 'under']:
            bx, by, bw, bh = P[b]; p = f'assets/avatar-art/worn-bands/{g}/{item}-{b}.png'
            a = np.array(Image.open(f'{BEFORE}/worn-bands/{g}/{item}-{b}.png').convert('RGBA')).astype(np.float32)
            ok = patch(a, (box[0] - bx, box[1] - by, box[2] - bx, box[3] - by), club)
            Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(p); print(club, g, b, ok)
    print(club, 'bands done', flush=True)

# Kast preview art + thumbnail: find where the (unpatched) torso band sits in them, map the crest box, patch.
for club in CLUBS:
    item = f'top-{club}-jersey'
    targets = [(g, f'assets/avatar-art/worn/{g}/{item}.png', f'{BEFORE}/worn/{g}/{item}.png') for g in BOX[club]]
    # items/ Kast thumbnails are rebuilt later by thumb_clean.py from the patched bands
    for g, out, src in targets:
        x, y, w, h = M[g]['pieces'][item]['torso']
        t = np.array(Image.open(f'{BEFORE}/worn-bands/{g}/{item}-torso.png').convert('RGBA')).astype(np.float32)
        # template = chest window around the crest (robust to the thumbnail's cut arms / hem)
        bx0, by0, bx1, by1 = BOX[club][g]
        cx0, cy0, cx1, cy1 = bx0 - 45 - x, by0 - 40 - y, bx1 + 15 - x, by1 + 25 - y
        cx0, cy0 = max(cx0, 0), max(cy0, 0)
        tm = t[cy0:cy1, cx0:cx1]
        tgt = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
        best = locate(tgt, tm, np.arange(0.30, 1.61, 0.02))
        v, s, (lx, ly) = best
        # refine scale
        best = locate(tgt, tm, np.arange(s - 0.02, s + 0.021, 0.004)); v, s, (lx, ly) = best
        box = ((bx0 - x - cx0) * s + lx, (by0 - y - cy0) * s + ly, (bx1 - x - cx0) * s + lx, (by1 - y - cy0) * s + ly)
        a = tgt.copy()
        pad = tuple(max(1, round(p_ * s)) for p_ in (3, 2, 3, 7))
        ok = patch(a, box, club, pad=pad)
        Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(out)
        print(club, out.split('/')[-3], g, 'match %.3f scale %.3f' % (v, s), [round(b) for b in box], ok, flush=True)
