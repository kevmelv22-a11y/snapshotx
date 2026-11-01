# Club jerseys: real 2026/27 main shirt sponsor across the chest + real kit-maker mark on the left chest (replacing the
# generated fake maker marks on Heracles / PEC), on boy+girl torso/under bands, Kast preview art and Kast thumbnail.
# Sponsor / maker logos were downloaded from the sponsors' own sites / Wikimedia and prepared (crop, mono colour,
# white panel where the shirt is striped) into <prep>/<club>.png and <prep>/kit-<club>.png.
# Every run starts from <base> (the crest-only state written by scripts/jerseys/real_crests.py).
# usage: python scripts/jerseys/sponsors.py <prep_dir> <base_dir> [club ...]
import sys, json, numpy as np, cv2
from PIL import Image
PREP, BASE = sys.argv[1], sys.argv[2]
M = json.load(open('scripts/worn-bands/meta.json'))
# canvas coords: sponsor box (centre x, centre y, max w, max h), maker mark box, fake maker marks to erase
SP = {'male': (181, 323, 66, 19), 'female': (205, 307, 54, 15)}
KIT = {'male': (149, 294, 14, 11), 'female': (168, 276, 11, 9)}
ERASE = {('heracles', 'male'): (135, 284, 160, 305), ('pec', 'male'): (136, 282, 162, 306),
         ('heracles', 'female'): (155, 270, 179, 285), ('pec', 'female'): (156, 264, 180, 287)}
SPW = {'fortuna': 1.0, 'rkc': 1.0}   # wide logos may use the full width; default 0.92
CLUBS = sys.argv[3:] or ['mvv', 'fortuna', 'rkc', 'heracles', 'pec', 'nac', 'volendam']

def fill(a, box):
    x0, y0, x1, y1 = [int(round(v)) for v in box]; ya, yb = y0 - 2, y1 + 2
    if ya < 1 or yb + 2 > a.shape[0] or x0 < 0 or x1 >= a.shape[1]: return
    for x in range(x0, x1 + 1):
        top, bot = a[ya - 1:ya + 1, x].mean(0), a[yb:yb + 2, x].mean(0)
        for y in range(y0, y1 + 1):
            t = (y - ya) / (yb - ya); a[y, x, :3] = top[:3] * (1 - t) + bot[:3] * t

def paste(a, path, cx, cy, mw, mh):
    im = Image.open(path).convert('RGBA'); s = min(mw / im.width, mh / im.height)
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    L = np.array(im.resize((w * 4, h * 4), Image.LANCZOS).resize((w, h), Image.LANCZOS)).astype(np.float32)
    x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    # clip to the band (the boy's 'under' band only covers part of the chest)
    lx0, ly0 = max(0, -x0), max(0, -y0); lx1, ly1 = min(w, a.shape[1] - x0), min(h, a.shape[0] - y0)
    if lx1 <= lx0 or ly1 <= ly0: return False
    L = L[ly0:ly1, lx0:lx1]; sub = a[y0 + ly0:y0 + ly1, x0 + lx0:x0 + lx1]
    lum = cv2.GaussianBlur(sub[..., :3].mean(2), (0, 0), 3); shade = np.clip(0.75 + 0.25 * lum / max(lum.mean(), 1), 0.85, 1.08)[..., None]
    al = L[..., 3:4] / 255 * 0.96 * (sub[..., 3:4] > 128)          # only on the shirt (not over the background / arm cut-outs)
    sub[..., :3] = sub[..., :3] * (1 - al) + np.clip(L[..., :3] * shade, 0, 255) * al
    return True

def apply(a, club, g, T):
    """T maps canvas (x, y) -> a's coords: (sx, sy, scale)."""
    ox, oy, s = T
    if (club, g) in ERASE:
        x0, y0, x1, y1 = ERASE[(club, g)]; fill(a, (x0 * s + ox, y0 * s + oy, x1 * s + ox, y1 * s + oy))
    cx, cy, mw, mh = SP[g]; ok = paste(a, f'{PREP}/{club}.png', cx * s + ox, cy * s + oy, mw * s * SPW.get(club, 0.92), mh * s)
    kx, ky, kw, kh = KIT[g]; ok2 = paste(a, f'{PREP}/kit-{club}.png', kx * s + ox, ky * s + oy, kw * s, kh * s)
    return ok, ok2

def flat(a):
    al = a[..., 3:4] / 255; rgb = a[..., :3] * al + 128 * (1 - al)
    return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
def locate(target, tm, scales):
    T = flat(target); best = None
    for s in scales:
        t = cv2.resize(tm, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] >= T.shape[0] or t.shape[1] >= T.shape[1]: continue
        _, v, _, loc = cv2.minMaxLoc(cv2.matchTemplate(T, flat(t), cv2.TM_CCOEFF_NORMED))
        if best is None or v > best[0]: best = (v, s, loc)
    return best

for club in CLUBS:
    item = f'top-{club}-jersey'
    for g in ['male', 'female']:
        P = M[g]['pieces'][item]
        for b in ['torso', 'under']:
            bx, by, bw, bh = P[b]
            a = np.array(Image.open(f'{BASE}/worn-bands/{g}/{item}-{b}.png').convert('RGBA')).astype(np.float32)
            r = apply(a, club, g, (-bx, -by, 1.0))
            Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'assets/avatar-art/worn-bands/{g}/{item}-{b}.png'); print(club, g, b, r)
    targets = [(g, f'worn/{g}/{item}.png') for g in ['male', 'female']] + [('male', f'items/{item}.png')]
    for g, rel in targets:
        x, y, w, h = M[g]['pieces'][item]['torso']
        t = np.array(Image.open(f'{BASE}/worn-bands/{g}/{item}-torso.png').convert('RGBA')).astype(np.float32)
        wx0, wy0, wx1, wy1 = 120 - x, 255 - y, 255 - x, 340 - y        # chest window (canvas 120..255 x 255..340)
        tm = t[max(wy0, 0):wy1, max(wx0, 0):wx1]; wx0, wy0 = max(wx0, 0), max(wy0, 0)
        tgt = np.array(Image.open(f'{BASE}/{rel}').convert('RGBA')).astype(np.float32)
        v, s, _ = locate(tgt, tm, np.arange(0.3, 1.61, 0.02)); v, s, (lx, ly) = locate(tgt, tm, np.arange(s - 0.02, s + 0.021, 0.004))
        T = (lx - (x + wx0) * s, ly - (y + wy0) * s, s)
        a = tgt.copy(); r = apply(a, club, g, T)
        Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(f'assets/avatar-art/{rel}')
        print(club, rel, 'match %.3f scale %.3f' % (v, s), r, flush=True)
