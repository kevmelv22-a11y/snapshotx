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
# canvas coords measured on the 2026-11-27 real-kit redesign: (cx, cy, max w, max h)
# RKC: keep generated WILLY NAESSENS INDUSTRIEBOUW (official prep is the red GROUP mark, wrong for this shirt)
# NAC: keep generated white OK (official prep is brand-red, wrong on the yellow/black sash)
SP = {
    'mvv':      {'male': (193, 340, 130, 48), 'female': (202, 315, 110, 52)},
    'fortuna':  {'male': (188, 343, 128, 32), 'female': (200, 320, 112, 28)},
    'heracles': {'male': (196, 342, 132, 34), 'female': (200, 315, 102, 30)},
    'pec':      {'male': (191, 337, 128, 32), 'female': (203, 318, 110, 28)},
    'volendam': {'male': (190, 343, 122, 40), 'female': (199, 319, 100, 40)},
}
KIT = {
    'mvv':      {'male': (140, 292, 24, 24), 'female': (165, 274, 20, 20)},
    'fortuna':  {'male': (141, 294, 22, 24), 'female': (165, 274, 18, 20)},
    'rkc':      {'male': (140, 295, 30, 24), 'female': (168, 278, 30, 20)},
    'heracles': {'male': (140, 294, 24, 20), 'female': (165, 275, 20, 14)},
    'pec':      {'male': (142, 298, 32, 20), 'female': (162, 278, 26, 18)},
    'nac':      {'male': (140, 296, 22, 22), 'female': (165, 278, 18, 18)},
}
# erase the generated mark (inpaint) before pasting the official one
SPW = {'fortuna': 1.0, 'volendam': 1.0, 'mvv': 1.0, 'heracles': 1.0, 'pec': 1.0}
SKIP_SP = {'rkc', 'nac'}
SKIP_KIT = {'volendam'}  # official UCAN asset is a text stand-in; generated mark is clearer
CLUBS = sys.argv[3:] or ['mvv', 'fortuna', 'rkc', 'heracles', 'pec', 'nac', 'volendam']

def fill(a, box):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    x0, y0 = max(1, x0), max(1, y0)
    x1, y1 = min(a.shape[1]-2, x1), min(a.shape[0]-2, y1)
    if x1 <= x0 or y1 <= y0: return
    mask = np.zeros(a.shape[:2], np.uint8); mask[y0:y1+1, x0:x1+1] = 255
    bgr = cv2.cvtColor(np.clip(a[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    inp = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
    a[..., :3] = cv2.cvtColor(inp, cv2.COLOR_BGR2RGB).astype(np.float32)

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
    ok = ok2 = 'skip'
    if club not in SKIP_SP and club in SP:
        cx, cy, mw, mh = SP[club][g]
        fill(a, ((cx-mw/2)*s+ox, (cy-mh/2)*s+oy, (cx+mw/2)*s+ox, (cy+mh/2)*s+oy))
        ok = paste(a, f'{PREP}/{club}.png', cx * s + ox, cy * s + oy, mw * s * SPW.get(club, 0.92), mh * s)
    if club not in SKIP_KIT and club in KIT:
        kx, ky, kw, kh = KIT[club][g]
        fill(a, ((kx-kw/2)*s+ox, (ky-kh/2)*s+oy, (kx+kw/2)*s+ox, (ky+kh/2)*s+oy))
        ok2 = paste(a, f'{PREP}/kit-{club}.png', kx * s + ox, ky * s + oy, kw * s, kh * s)
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
    targets = [(g, f'worn/{g}/{item}.png') for g in ['male', 'female']]  # items rebuilt later by thumb_clean
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
