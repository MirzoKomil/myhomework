from collections import deque
from PIL import Image

SRC = r"C:\Users\user\.cursor\projects\c-Users-user-OneDrive-Desktop-admin-panel\assets\c__Users_user_AppData_Roaming_Cursor_User_workspaceStorage_0319b3f4c62404570b2457a7ed7e264b_images_homework_logo_white_bg-a7f4d559-90a0-4c51-bfc1-b7e9ba255921.png"
OUT = r"c:\Users\user\OneDrive\Desktop\admin-panel\images\myhomework-logo.png"
FLOOD_TOLERANCE = 40


def color_dist(c1, c2):
    return sum(abs(a - b) for a, b in zip(c1[:3], c2[:3]))


def is_background_pixel(r, g, b):
    if r > 232 and g > 232 and b > 232:
        return True
    peak = max(r, g, b)
    trough = min(r, g, b)
    if peak - trough < 28 and peak > 185:
        return True
    return False


def remove_background(path, output):
    img = Image.open(path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    visited = set()
    queue = deque((x, y) for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or y < 0 or x >= w or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if color_dist((r, g, b), (255, 255, 255)) <= FLOOD_TOLERANCE:
            pixels[x, y] = (r, g, b, 0)
            queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a and is_background_pixel(r, g, b):
                pixels[x, y] = (r, g, b, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(output, "PNG")
    print(f"Saved: {output} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    remove_background(SRC, OUT)
