"""可测试的模具尺寸和镜像轮廓 / Pure mold dimensions and mirrored geometry."""
import math
from .design_data import mold_settings, draft_angle, top_outline, inset_loop, DesignError


def mirror_loop(loop):
    # 正面向上看压片时左右反字；翻转 Y 轴后与月饼吻合 / Mirror X, then preserve winding.
    return [[-x, y] for x, y in reversed(loop)]


def mold_plan(data):
    settings = mold_settings(data)
    diameter, thickness = data['dimensions']['diameter'], data['dimensions']['thickness']
    gap, wall, plate = (settings[key] for key in ('radialClearance', 'wallThickness', 'stampThickness'))
    outline = data['geometry']['outline']
    cavity = [point[:] for point in outline]
    top = top_outline(data)
    stamp_outline = inset_loop(top, gap)
    boss_height = settings['studLength'] + 3
    # 小直径螺纹座穿过导向孔，直壁段只容纳压片 / The boss passes through the guide; only the stamp occupies this segment.
    sleeve_height = thickness + settings['guideHeight']
    travel = settings['shaftLength'] + boss_height + plate - settings['guideHeight'] - settings['baseThickness']
    if plate > settings['guideHeight']:
        raise DesignError('压片厚度不能超过 6 mm 内部直壁段，请将压片厚度调至 4–6 mm。')
    if min(math.hypot(*p) for p in top) < settings['bossDiameter'] / 2 + gap:
        raise DesignError('文字面内腔不足以容纳直径 30 mm 螺纹座，请增大月饼直径或减小斜度。')
    # 压片背面独立螺纹座，盲孔与正面凹纹隔开 / Blind socket never opens into engraving.
    return {
        'settings': settings, 'cavity': cavity, 'topCavity': top, 'draftAngle': draft_angle(data), 'cavityTaperHeight': thickness, 'stampOutline': mirror_loop(stamp_outline),
        'grooves': [{**r, 'outer': mirror_loop(r['outer']), 'holes': [mirror_loop(h) for h in r['holes']]} for r in sorted(data['geometry']['reliefs'], key=lambda r: r['height'])],
        'outerRadius': diameter / 2 + wall, 'sleeveHeight': sleeve_height,
        'baseThickness': settings['baseThickness'], 'guideHeight': settings['guideHeight'], 'ejectionTravel': travel,
        'guideRadius': settings['shaftDiameter'] / 2 + gap, 'shaftRadius': settings['shaftDiameter'] / 2, 'shaftLength': settings['shaftLength'],
        'stampThickness': plate, 'bossRadius': settings['bossDiameter'] / 2, 'bossHeight': boss_height,
        'socketDepth': settings['studLength'] + 1, 'studLength': settings['studLength'], 'threadDiameter': 20, 'tapRadius': 8.75,
        'handleRadius': settings['handleDiameter'] / 2, 'handleThickness': 7,
        'layoutPitch': diameter + 2 * (gap + wall) + 40,
    }
