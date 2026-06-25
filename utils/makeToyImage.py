"""Extract toy: detect black frame border, crop bottom text, set frame+text to black, keep content intact."""
import sys
from PIL import Image


def detect_bottom_crop(img):
    """Find where bottom text/decoration starts."""
    w, h = img.size
    px = img.load()
    text_rows = []
    for y in range(h - 1, h // 3, -1):
        dark = sum(1 for x in range(0, w, 5) if sum(px[x, y][:3]) < 280)
        if dark > w * 0.02:
            text_rows.append(y)
        elif text_rows:
            return max(h // 3, min(text_rows) - 3)
    return h


def find_content_bounds(img, crop_bottom):
    """Detect where the black decorative frame ends on each side.
    Scans from edges inward, finding the transition from frame to content."""
    w, h = img.size
    px = img.load()

    # Left: find column where at least 5% of rows have non-black content
    left = 0
    for x in range(w):
        non_black = sum(1 for y in range(0, crop_bottom, 5) if sum(px[x, y]) > 120)
        if non_black > crop_bottom * 0.03:
            left = x
            break

    # Right
    right = w - 1
    for x in range(w - 1, 0, -1):
        non_black = sum(1 for y in range(0, crop_bottom, 5) if sum(px[x, y]) > 120)
        if non_black > crop_bottom * 0.03:
            right = x
            break

    # Top
    top = 0
    for y in range(crop_bottom):
        non_black = sum(1 for x in range(0, w, 5) if sum(px[x, y]) > 120)
        if non_black > w * 0.03:
            top = y
            break

    return max(0, left - 2), max(0, top - 2), min(w - 1, right + 2)


def make_toy(src_path, out_path):
    img = Image.open(src_path).convert('RGB')
    w, h = img.size
    px = img.load()

    # 1. Detect bottom crop and content window
    crop_bottom = detect_bottom_crop(img)
    left, top, right = find_content_bounds(img, crop_bottom)

    # 2. Set everything outside content window + below crop to black
    # Keep content window intact (no processing of toy or its background)
    for y in range(h):
        for x in range(w):
            outside = (x < left or x > right or y < top or y >= crop_bottom)
            if outside:
                px[x, y] = (0, 0, 0)

    img.save(out_path, 'PNG')
    print(f'  {w}x{h}, content={left},{top}-{right},{crop_bottom}')


if __name__ == '__main__':
    make_toy(sys.argv[1], sys.argv[2])
