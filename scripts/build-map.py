# Builds public/maps/<scenario>.json (Tiled JSON, orthogonal, 16x16) from the zone layout in
# content/maps/<scenario>.json, using Kenney Tiny Town (CC0). Run: python3 scripts/build-map.py launch-week
# Tile ids below are 0-based indices into kenney-tiny-town.png (12 columns); Tiled gids are id + 1.
import json, pathlib, random, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else "launch-week"
scn = json.loads((ROOT / f"content/maps/{name}.json").read_text())
W, H = scn["map"]["width"], scn["map"]["height"]
rnd = random.Random(name)

GRASS = [0, 0, 0, 0, 0, 0, 1, 1, 2]
DIRT = 25
TREES = [4, 16, 3, 15, 28, 27]
BUSH, SPROUT, MUSH = 5, 17, 29
SIGN, BEEHIVE, WELL, BARREL, BARREL2, POT, LOG = 83, 94, 104, 130, 131, 107, 106
FENCE_H = [80, 81, 82]
# Roofs (rows), walls
RED_ROOF_TOP, RED_ROOF_BOT = [52, 53, 54], [64, 65, 66]
GREY_ROOF_TOP, GREY_ROOF_BOT = [48, 49, 50], [60, 61, 62]
WOOD_WALL = {"l": 72, "m": 73, "door": 74, "r": 75, "win": 84}
STONE_WALL = {"l": 76, "m": 77, "door": 78, "r": 79, "win": 88}
PLAZA = [[96, 97, 98], [108, 109, 110], [120, 121, 122]]

ground = [[rnd.choice(GRASS) for _ in range(W)] for _ in range(H)]
deco = [[-1] * W for _ in range(H)]
above = [[-1] * W for _ in range(H)]  # drawn over characters (roof tops)
blocked = [[0] * W for _ in range(H)]

def put(layer, x, y, t, block=False):
    if 0 <= x < W and 0 <= y < H:
        layer[y][x] = t
        if block:
            blocked[y][x] = 1

def path_rect(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                ground[y][x] = DIRT

def row3(arr, n):
    """Stretch a 3-tile row [l, m, r] to n tiles."""
    return [arr[0]] + [arr[1]] * (n - 2) + [arr[2]] if n >= 2 else [arr[1]]

def building(x, y, w, roof_top, roof_bot, wall, door_at=None, windows=()):
    for i, t in enumerate(row3(roof_top, w)):
        put(above, x + i, y, t, True)
    for i, t in enumerate(row3(roof_bot, w)):
        put(above, x + i, y + 1, t, True)
    for i in range(w):
        t = wall["l"] if i == 0 else wall["r"] if i == w - 1 else wall["m"]
        if door_at is not None and i == door_at:
            t = wall["door"]
        elif i in windows:
            t = wall["win"]
        put(deco, x + i, y + 2, t, True)

def plaza(x, y, w, h):
    for j in range(h):
        r = PLAZA[0] if j == 0 else PLAZA[2] if j == h - 1 else PLAZA[1]
        for i, t in enumerate(row3(r, w)):
            put(ground, x + i, y + j, t)

zones = {z["id"]: z for z in scn["zones"]}

# Paths: a main east-west street and a north-south avenue, plus spurs into each zone.
path_rect(1, 17, W - 2, 18)
path_rect(19, 2, 20, H - 1)
path_rect(6, 10, 7, 17)     # volunteers
path_rect(31, 10, 32, 17)   # vendors
path_rect(26, 7, 37, 8)     # vendor row walkway
path_rect(6, 18, 7, 22)     # storage
path_rect(32, 18, 33, 23)   # sponsor
path_rect(4, 7, 11, 8)      # volunteer yard

# Entrance gate (top): fence line with an opening and two signs.
for x in range(1, W - 1):
    if not 17 <= x <= 22:
        put(deco, x, 0, FENCE_H[1], True)
put(deco, 16, 2, SIGN, True)
put(deco, 23, 2, SIGN, True)

# Volunteer Station: a small red tent with a table.
building(4, 3, 4, RED_ROOF_TOP, RED_ROOF_BOT, WOOD_WALL, door_at=1, windows=(2,))
put(deco, 9, 6, BARREL, True)
put(deco, 10, 6, POT, True)
for i, t in enumerate(FENCE_H):
    put(deco, 8 + i, 9, t, True)

# Vendor Row: three stalls alternating roof colours.
for k, x in enumerate([27, 31, 35]):
    top, bot = (RED_ROOF_TOP, RED_ROOF_BOT) if k % 2 == 0 else (GREY_ROOF_TOP, GREY_ROOF_BOT)
    building(x, 3, 3, top, bot, WOOD_WALL, windows=(1,))
put(deco, 26, 6, BARREL2, True)
put(deco, 38, 6, BEEHIVE, True)

# HQ Tent (centre): the biggest tent, with your desk out front.
building(16, 11, 6, RED_ROOF_TOP, RED_ROOF_BOT, WOOD_WALL, door_at=2, windows=(1, 4))
put(deco, 22, 14, POT, True)
put(deco, 15, 15, SIGN, True)

# Storage Shed: grey roof, barrels and logs.
building(3, 19, 4, GREY_ROOF_TOP, GREY_ROOF_BOT, WOOD_WALL, door_at=2)
for (x, y, t) in [(8, 20, BARREL), (9, 20, BARREL2), (8, 21, LOG), (3, 23, BARREL), (9, 23, POT)]:
    put(deco, x, y, t, True)

# Sponsor Office: stone building.
building(29, 19, 5, GREY_ROOF_TOP, GREY_ROOF_BOT, STONE_WALL, door_at=2, windows=(1, 3))
put(deco, 35, 21, SIGN, True)

# Main Stage: a stone plaza with a well and signs.
plaza(15, 24, 10, 4)
put(deco, 14, 24, SIGN, True)
put(deco, 25, 24, SIGN, True)
put(deco, 12, 15, WELL, True)

# Trees around the edges and in gaps, never on paths, zones' NPC tiles or building footprints.
npc_tiles = {(n["tile"]["x"], n["tile"]["y"]) for n in scn["npcs"]}
def free(x, y):
    return ground[y][x] in GRASS and deco[y][x] == -1 and above[y][x] == -1 and (x, y) not in npc_tiles
for y in range(1, H):
    for x in [0, W - 1]:
        put(deco, x, y, rnd.choice(TREES), True)
for x in range(1, W - 1):
    put(deco, x, H - 1, rnd.choice(TREES), True)
for _ in range(70):
    x, y = rnd.randrange(1, W - 1), rnd.randrange(2, H - 1)
    inside_zone = any(z["x"] <= x < z["x"] + z["w"] and z["y"] <= y < z["y"] + z["h"] for z in scn["zones"])
    if free(x, y) and not inside_zone:
        put(deco, x, y, rnd.choice(TREES + [BUSH, BUSH, SPROUT, MUSH]), rnd.random() < 0.85)

# Keep NPC tiles and one tile around them walkable.
for (x, y) in npc_tiles:
    blocked[y][x] = 0

def layer(name, data, visible=True, props=None):
    l = {"name": name, "type": "tilelayer", "width": W, "height": H, "x": 0, "y": 0, "opacity": 1, "visible": visible,
         "data": [t + 1 if t >= 0 else 0 for row in data for t in row]}
    if props:
        l["properties"] = props
    return l

tiled = {
    "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal", "renderorder": "right-down",
    "width": W, "height": H, "tilewidth": 16, "tileheight": 16, "infinite": False, "nextlayerid": 6, "nextobjectid": 1,
    "tilesets": [{"firstgid": 1, "name": "kenney-tiny-town", "image": "/assets/tiles/kenney-tiny-town.png", "imagewidth": 192, "imageheight": 176,
                  "tilewidth": 16, "tileheight": 16, "columns": 12, "tilecount": 132, "margin": 0, "spacing": 0}],
    "layers": [
        layer("ground", ground),
        layer("deco", deco),
        layer("above", above),
        layer("collision", [[0 if b == 0 else 0 for b in row] for row in blocked], visible=False),
    ],
    "properties": [{"name": "generatedFrom", "type": "string", "value": f"content/maps/{name}.json"}],
}
# Collision is stored as a grid (1 = blocked) the game reads directly, and mirrored as a Tiled layer.
tiled["layers"][3]["data"] = [1 if b else 0 for row in blocked for b in row]
out = ROOT / f"public/maps/{name}.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(tiled))
print("wrote", out, f"{W}x{H}", sum(map(sum, blocked)), "blocked tiles")
