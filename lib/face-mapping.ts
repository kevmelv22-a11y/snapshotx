export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/** Maps image-space bounds into a resizeMode="cover" view, including the cropped edges. */
export function imageRectToCoverView(rect: Rect, image: Size, view: Size): Rect {
  if (image.width <= 0 || image.height <= 0 || view.width <= 0 || view.height <= 0) {
    throw new Error('Image and view dimensions must be positive.');
  }
  const scale = Math.max(view.width / image.width, view.height / image.height);
  const cropX = (image.width * scale - view.width) / 2;
  const cropY = (image.height * scale - view.height) / 2;
  return {
    x: rect.x * scale - cropX,
    y: rect.y * scale - cropY,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}
