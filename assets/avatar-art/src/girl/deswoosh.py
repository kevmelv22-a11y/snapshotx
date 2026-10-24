"""Female set: paint out the sneaker side swooshes (same method as ../deswoosh.py). Polygons in cut-image pixels."""
import numpy as np, cv2
from PIL import Image
POLY = {'look-denim-jacket': [[(92,634),(110,626),(114,630),(110,640),(98,646),(91,642)], [(181,636),(194,630),(197,640),(192,650),(183,648)]],
        'look-ripped-jeans': [[(101,636),(120,627),(124,633),(118,648),(104,653),(99,647)], [(183,640),(198,633),(202,644),(197,656),(185,655)]]}
for n, polys in POLY.items():
    im = np.array(Image.open(f'{n}.png').convert('RGBA')); rgb = im[..., :3].copy()
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    for poly in polys:
        reg = np.zeros(lum.shape, np.uint8); cv2.fillPoly(reg, [np.array(poly, np.int32)], 1)
        ring = cv2.dilate(reg, np.ones((7, 7), np.uint8)) - reg
        light = (ring > 0) & (lum > 150) & (im[..., 3] > 200)
        fill = np.median(rgb[light], axis=0) if light.any() else np.array([235, 235, 235])
        dark = (reg > 0) & (lum < 95)
        dark = cv2.dilate(dark.astype(np.uint8), np.ones((3, 3), np.uint8)) & reg
        rgb[dark > 0] = fill
        soft = cv2.GaussianBlur(rgb, (5, 5), 0); edge = cv2.dilate(dark, np.ones((3, 3), np.uint8)) > 0
        rgb[edge] = soft[edge]
    im[..., :3] = rgb; Image.fromarray(im).save(f'{n}.png'); print(n)
