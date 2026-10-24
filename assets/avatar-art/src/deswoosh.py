"""Paint out the sneaker side swooshes (generated art) with the panel colour. Polygons in cut-image pixels."""
import numpy as np, cv2
from PIL import Image
POLY = {'look-default-hoodie': [[(74,614),(74,638),(92,640),(104,614),(101,608),(90,620),(84,614)], [(202,618),(202,638),(210,638),(210,618)]],
        'look-denim-jacket': [[(77,616),(77,637),(92,639),(96,628),(94,622),(90,625),(86,617)], [(204,614),(204,634),(212,634),(212,614)]],
        'look-ripped-jeans': [[(74,620),(74,639),(89,641),(94,631),(92,625),(88,629),(84,621)], [(201,617),(201,637),(210,637),(210,617)]]}
for n, polys in POLY.items():
    im = np.array(Image.open(f'{n}.png').convert('RGBA')); rgb = im[..., :3].copy()
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    for poly in polys:
        reg = np.zeros(lum.shape, np.uint8); cv2.fillPoly(reg, [np.array(poly, np.int32)], 1)
        x, y, w, h = cv2.boundingRect(np.array(poly, np.int32))
        ring = cv2.dilate(reg, np.ones((7, 7), np.uint8)) - reg
        light = (ring > 0) & (lum > 150) & (im[..., 3] > 200)
        fill = np.median(rgb[light], axis=0) if light.any() else np.array([235, 235, 235])
        dark = (reg > 0) & (lum < 95)
        dark = cv2.dilate(dark.astype(np.uint8), np.ones((3, 3), np.uint8)) & reg
        rgb[dark > 0] = fill
        soft = cv2.GaussianBlur(rgb, (5, 5), 0); edge = cv2.dilate(dark, np.ones((3, 3), np.uint8)) > 0
        rgb[edge] = soft[edge]
    im[..., :3] = rgb; Image.fromarray(im).save(f'{n}.png'); print(n)
