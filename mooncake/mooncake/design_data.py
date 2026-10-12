"""独立于 Fusion 的 JSON 校验 / Standalone, bounded design validation."""
import json
import math

MAX_BYTES = 4 * 1024 * 1024
MAX_VERTICES = 10000
MOLD_HARDWARE = {'connection': 'M20x2.5', 'baseThickness': 6, 'shaftDiameter': 30, 'shaftLength': 40, 'studLength': 15, 'handleDiameter': 40, 'bossDiameter': 30, 'guideHeight': 6}
MOLD_DEFAULT = {'type': 'hand_press', 'radialClearance': .3, 'wallThickness': 3.5, 'stampThickness': 6, **MOLD_HARDWARE}


class DesignError(ValueError):
    pass


def number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise DesignError('{} 必须在 {}–{} 范围内。'.format(label, low, high))
    return value


def choice(value, options, label):
    if not isinstance(value, str) or value not in options:
        raise DesignError('{} 无效。'.format(label))
    return value


def signed_area(points):
    return sum(p[0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * p[1] for i, p in enumerate(points)) / 2


def contains(loop, point):
    inside = False
    x, y = point
    for i, (ax, ay) in enumerate(loop):
        bx, by = loop[(i + 1) % len(loop)]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return inside


def _cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a, b, p):
    return abs(_cross(a, b, p)) < 1e-8 and min(a[0], b[0]) - 1e-8 <= p[0] <= max(a[0], b[0]) + 1e-8 and min(a[1], b[1]) - 1e-8 <= p[1] <= max(a[1], b[1]) + 1e-8


def intersects(a, b, c, d):
    if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]) or max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]):
        return False
    x, y, z, w = _cross(a, b, c), _cross(a, b, d), _cross(c, d, a), _cross(c, d, b)
    return (x * y < 0 and z * w < 0) or any((_on_segment(a, b, c), _on_segment(a, b, d), _on_segment(c, d, a), _on_segment(c, d, b)))


def validate_loop(loop, radius, label, budget):
    if not isinstance(loop, list) or not 3 <= len(loop) <= 2000:
        raise DesignError('{} 的顶点数量无效。'.format(label))
    budget[0] += len(loop)
    if budget[0] > MAX_VERTICES + 384:
        raise DesignError('轮廓过于复杂，请使用简洁的图片。')
    for p in loop:
        if not isinstance(p, list) or len(p) != 2:
            raise DesignError('轮廓顶点必须是 [x, y]。')
        number(p[0], -radius, radius, 'X 坐标')
        number(p[1], -radius, radius, 'Y 坐标')
        if math.hypot(*p) > radius + .001:
            raise DesignError('{} 超出允许的圆形区域。'.format(label))
    if abs(signed_area(loop)) < .005:
        raise DesignError('{} 面积为零或过小。'.format(label))
    count = len(loop)
    for i, a in enumerate(loop):
        b = loop[(i + 1) % count]
        if math.dist(a, b) < .00001:
            raise DesignError('{} 包含重复顶点。'.format(label))
        for j in range(i + 2, count):
            if i == 0 and j == count - 1:
                continue
            if intersects(a, b, loop[j], loop[(j + 1) % count]):
                raise DesignError('{} 存在自相交，请简化图片后重新导出。'.format(label))
    return loop


def _loops_cross(a, b):
    return any(intersects(p, a[(i + 1) % len(a)], q, b[(j + 1) % len(b)]) for i, p in enumerate(a) for j, q in enumerate(b))


def _object(value, label):
    if not isinstance(value, dict):
        raise DesignError('{} 必须是对象。'.format(label))
    return value


def validate_design(data):
    _object(data, '设计')
    if data.get('schema') != 'mooncake.design' or type(data.get('version')) is not int or data['version'] not in (1, 2) or data.get('units') != 'mm':
        raise DesignError('请选择 Mooncake 导出的 v1/v2 毫米制设计 JSON，不是订单文件。')
    dim, side = _object(data.get('dimensions'), '尺寸'), _object(data.get('side'), '周边')
    front, text = _object(data.get('front'), '正面'), _object(data.get('text'), '文字')
    diameter = number(dim.get('diameter'), 50, 120, '直径')
    thickness = number(dim.get('thickness'), 10, 40, '厚度')
    angle = draft_angle(data)
    choice(side.get('pattern'), ('round', 'scallop', 'wave'), '周边花纹')
    count = number(side.get('count'), 12, 36, '花边数量')
    if int(count) != count:
        raise DesignError('花边数量必须是整数。')
    top_d = diameter - 2 * thickness * math.tan(math.radians(angle))
    pattern_max = math.floor(min(diameter - 10, top_d - 6) * 10 + 1e-8) / 10
    pattern_d = number(front.get('diameter'), 30, pattern_max, '花纹直径')
    relief = number(front.get('relief'), .5, 3, '浮雕高度')
    choice(front.get('mode'), ('parametric', 'image'), '正面模式')
    choice(front.get('pattern'), ('petals', 'rays', 'cloud', 'lotus', 'rosette', 'blossom', 'brocade', 'stars', 'fan', 'moon'), '正面花纹')
    petals = number(front.get('petals'), 8, 24, '花纹数量')
    if int(petals) != petals or not isinstance(front.get('invert'), bool):
        raise DesignError('花纹数量或图片反相格式无效。')
    if front['mode'] == 'image':
        image = _object(front.get('image'), '图片数据')
        if image.get('size') != 64 or not isinstance(image.get('values'), list) or len(image['values']) != 4096 or not isinstance(image.get('name'), str):
            raise DesignError('图片必须包含 64×64 灰度数据。')
        for value in image['values']:
            number(value, 0, 1, '灰度')
    character = text.get('character')
    def is_han(c):
        cp = ord(c)
        return 0x3400 <= cp <= 0x4DBF or 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF or 0x20000 <= cp <= 0x323AF or cp in (0x3005, 0x3007)
    english = isinstance(character, str) and 1 <= len(character) <= 5 and all('A' <= c <= 'Z' or 'a' <= c <= 'z' for c in character)
    if not isinstance(character, str) or not (character == '' or english or (len(character) <= 2 and all(is_han(c) for c in character))):
        raise DesignError('内部文字最多为 2 个汉字或 5 个英文字母，不能混用。')
    layout = text.get('layout', 'straight')
    choice(layout, ('straight', 'circular'), '文字排列')
    if layout == 'circular' and not english:
        raise DesignError('环形排列仅支持英文字母。')
    number(text.get('size'), 10, math.floor(pattern_d * .38), '文字大小')
    choice(text.get('font'), ('serif', 'sans'), '字体')
    mold_settings(data)
    geometry = _object(data.get('geometry'), '实体轮廓')
    budget = [0]
    body = validate_loop(geometry.get('outline'), diameter / 2 + .001, '基体轮廓', budget)
    if len(body) != 384:
        raise DesignError('基体轮廓不匹配，请从设计器重新导出。')
    amp = {'round': 0, 'wave': 1, 'scallop': 2}[side['pattern']]
    for i, point in enumerate(body):
        a = i * math.pi * 2 / 384
        radius = diameter / 2 - amp / 2 + amp / 2 * math.cos(a * count)
        if math.dist(point, [radius * math.cos(a), radius * math.sin(a)]) > .001:
            raise DesignError('基体轮廓与尺寸/周边参数不一致。')
    if data['version'] == 2:
        top = validate_loop(geometry.get('topOutline'), top_d / 2 + .001, '文字面轮廓', [0])
        expected = top_outline(data)
        if len(top) != len(body) or any(math.dist(p, q) > .001 for p, q in zip(top, expected)):
            raise DesignError('文字面轮廓与脱模斜度不一致，请重新导出。')
    regions = geometry.get('reliefs')
    if not isinstance(regions, list) or len(regions) > 400:
        raise DesignError('浮雕区域过多，请简化图片。')
    for i, region in enumerate(regions):
        _object(region, '浮雕区域')
        number(region.get('height'), .05, relief + .001, '浮雕层高度')
        outer = validate_loop(region.get('outer'), pattern_d / 2 + .001, '浮雕 {}'.format(i + 1), budget)
        holes = region.get('holes')
        if not isinstance(holes, list) or len(holes) > 150:
            raise DesignError('浮雕孔洞格式无效。')
        for j, hole in enumerate(holes):
            validate_loop(hole, pattern_d / 2 + .001, '内孔', budget)
            if not contains(outer, hole[0]) or _loops_cross(outer, hole):
                raise DesignError('内孔必须完整地位于外轮廓内。')
            for other in holes[:j]:
                if contains(other, hole[0]) or contains(hole, other[0]) or _loops_cross(other, hole):
                    raise DesignError('内孔不能相交或嵌套。')
        if abs(signed_area(outer)) - sum(abs(signed_area(h)) for h in holes) < .005:
            raise DesignError('浮雕有效面积过小。')
    return data


def draft_angle(data):
    """旧文件保持直壁；v2 显式指定角度 / Preserve v1 geometry; require the draft in v2."""
    if data.get('version') == 1:
        if data['dimensions'].get('draftAngle', 0) != 0:
            raise DesignError('带脱模斜度的设计必须使用 v2 JSON。')
        return 0
    return number(data['dimensions'].get('draftAngle'), 0, 8, '脱模斜度')


def inset_loop(loop, distance):
    return [[x * (1 - distance / math.hypot(x, y)), y * (1 - distance / math.hypot(x, y))] for x, y in loop]


def top_outline(data):
    return inset_loop(data['geometry']['outline'], data['dimensions']['thickness'] * math.tan(math.radians(draft_angle(data))))


def mold_settings(data):
    """保留配合参数，旧 M8 升级为现行硬件 / Preserve fit settings; upgrade legacy M8 hardware."""
    mold = data.get('mold', MOLD_DEFAULT)
    _object(mold, '模具参数')
    choice(mold.get('type'), ('hand_press',), '模具类型')
    choice(mold.get('connection'), ('M8x1.25', 'M20x2.5'), '压片连接')
    for key, low, high in [('radialClearance', .15, .8), ('wallThickness', 2, 8), ('stampThickness', 4, 10)]:
        number(mold.get(key), low, high, key)
    for key, value in MOLD_HARDWARE.items():
        if key != 'connection' and key in mold:
            if key == 'bossDiameter' and 'guideHeight' not in mold and mold[key] == 40:
                continue  # v1.5 旧螺纹座升级 / Upgrade the legacy v1.5 boss.
            number(mold[key], value, value, key)
    return {**mold, **MOLD_HARDWARE}


def parse_design(content):
    if not isinstance(content, str) or len(content.encode('utf-8')) > MAX_BYTES:
        raise DesignError('设计文件不能超过 4 MB。')
    try:
        data = json.loads(content)
    except (ValueError, TypeError, RecursionError) as exc:
        raise DesignError('JSON 文件无法解析。') from exc
    return validate_design(data)


def load_design(path):
    with open(path, 'r', encoding='utf-8-sig') as source:
        return parse_design(source.read(MAX_BYTES + 1))
