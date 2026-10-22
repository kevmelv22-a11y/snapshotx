"""Append a '+' in the cyan neon style of the 'X' to the SNAPSHOT X row (source on black, before unmatting).
Core colour and glow tint are sampled from the X itself; glow = two gaussian blurs of the core mask, added like light."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
def add_plus(im, y0=60, y1=436, x_left=1976, x_right=2076, top=195, bottom=312):
    row = im[y0:y1]; X = row[:, x_left-30:x_right+30]
    core = X[X.max(2) > 200]; halo = X[(X.max(2) > 50) & (X.max(2) < 140)]
    core_c, halo_c = core.mean(0), halo.mean(0) / halo.mean(0).max()
    cap = bottom - top; arm = round(cap * 0.62); sw = 13; gap = 22
    W = x_right + gap + arm + 90; cy = (top + bottom) / 2 - y0
    out = np.zeros((row.shape[0], max(W, row.shape[1]), 3)); out[:, :row.shape[1]] = row
    mask = Image.new('L', (out.shape[1], out.shape[0])); d = ImageDraw.Draw(mask)
    cx = x_right + gap + arm / 2
    d.rounded_rectangle([cx - arm/2, cy - sw/2, cx + arm/2, cy + sw/2], radius=1, fill=255)
    d.rounded_rectangle([cx - sw/2, cy - arm/2, cx + sw/2, cy + arm/2], radius=1, fill=255)
    m = np.asarray(mask, float) / 255
    g1 = np.asarray(mask.filter(ImageFilter.GaussianBlur(7)), float) / 255
    g2 = np.asarray(mask.filter(ImageFilter.GaussianBlur(22)), float) / 255
    light = m[..., None] * core_c + (g1 * 0.5 + g2 * 0.6)[..., None] * halo_c * 255
    out = 255 - (255 - out) * (255 - light.clip(0, 255)) / 255  # screen blend
    return out
