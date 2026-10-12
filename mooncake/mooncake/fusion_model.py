"""从共享轮廓生成原生实体 / Native BRep reconstruction from shared outlines."""
import json
import math
import adsk.core
import adsk.fusion
from .design_data import validate_design, signed_area, DesignError, draft_angle, top_outline, inset_loop, mold_settings
from .mold_data import mold_plan


def _plane(component, z, name):
    if abs(z) < 1e-8:
        return component.xYConstructionPlane
    value = component.constructionPlanes.createInput()
    value.setByOffset(component.xYConstructionPlane, adsk.core.ValueInput.createByString('{} mm'.format(z)))
    plane = component.constructionPlanes.add(value)
    plane.name = name
    plane.isLightBulbOn = False
    return plane


def _extrude(component, sketch, profile, length, operation, name):
    extrudes = component.features.extrudeFeatures
    distance = adsk.core.ValueInput.createByString('{} mm'.format(length))
    if operation == adsk.fusion.FeatureOperations.CutFeatureOperation:
        value = extrudes.createInput(profile, operation)
        value.setOneSideExtent(adsk.fusion.DistanceExtentDefinition.create(distance), adsk.fusion.ExtentDirections.PositiveExtentDirection)
        # 同原点建模时只切本零件，避免损坏月饼 / Restrict cuts to this component's bodies.
        value.participantBodies = [component.bRepBodies.item(i) for i in range(component.bRepBodies.count)]
        feature = extrudes.add(value)
    else:
        feature = extrudes.addSimple(profile, distance, operation)
    if not feature:
        raise RuntimeError('{} 生成失败。'.format(name))
    feature.name = name
    sketch.isVisible = False
    return feature


def _circle_feature(component, z, radius, length, operation, name, hole=0):
    sketch = component.sketches.add(_plane(component, z, name + '基准'))
    sketch.name = name
    circles = sketch.sketchCurves.sketchCircles
    circles.addByCenterRadius(adsk.core.Point3D.create(0, 0, 0), radius / 10)
    if hole:
        circles.addByCenterRadius(adsk.core.Point3D.create(0, 0, 0), hole / 10)
    expected = math.pi * (radius * radius - hole * hole) / 100
    profile = min((sketch.profiles.item(i) for i in range(sketch.profiles.count)), key=lambda p: abs(p.areaProperties().area - expected))
    return _extrude(component, sketch, profile, length, operation, name)


def _polygon_feature(component, z, region, length, operation, name):
    sketch, profile = _sketch_region(component, _plane(component, z, name + '基准'), region, name)
    return _extrude(component, sketch, profile, length, operation, name)


def _loft_outline(component, bottom, top, z0, z1, operation, name):
    """同序截面直线放样 / Loft corresponding radial vertices between two sections."""
    sections = []
    for loop, z, suffix in [(bottom, z0, '底面'), (top, z1, '顶面')]:
        sections.append(_sketch_region(component, _plane(component, z, name + suffix), {'outer': loop}, name + suffix))
    lofts = component.features.loftFeatures
    value = lofts.createInput(operation)
    value.isSolid = True
    for _, profile in sections:
        value.loftSections.add(profile)
    if operation == adsk.fusion.FeatureOperations.CutFeatureOperation:
        value.participantBodies = [component.bRepBodies.item(i) for i in range(component.bRepBodies.count)]
    feature = lofts.add(value)
    if not feature:
        raise RuntimeError('{} 生成失败。'.format(name))
    feature.name = name
    for sketch, _ in sections:
        sketch.isVisible = False
    return feature


def _thread(component, feature, internal):
    threads = component.features.threadFeatures
    info = threads.createThreadInfo(internal, 'ISO Metric profile', 'M20x2.5', '6H' if internal else '6g')
    if not info:
        raise RuntimeError('Fusion 螺纹库缺少 ISO M20x2.5，请检查标准螺纹库。')
    faces = adsk.core.ObjectCollection.create()
    for i in range(feature.sideFaces.count):
        face = feature.sideFaces.item(i)
        if adsk.core.Cylinder.cast(face.geometry):
            faces.add(face)
    if faces.count != 1:
        raise RuntimeError('无法识别 M20 连接圆柱面。')
    value = threads.createInput(faces, info)
    value.isModeled = True
    value.isFullLength = True
    thread = threads.add(value)
    if not thread:
        raise RuntimeError('M20 实体螺纹生成失败。')
    thread.name = 'M20x2.5 内螺纹' if internal else 'M20x2.5 外螺纹'


def _new_component(parent, name):
    occurrence = parent.occurrences.addNewComponent(adsk.core.Matrix3D.create())
    occurrence.component.name = name
    return occurrence


def _place(occurrence, x, y, z=0):
    transform = adsk.core.Matrix3D.create()
    transform.translation = adsk.core.Vector3D.create(x / 10, y / 10, z / 10)
    occurrence.transform2 = transform


def _layout(root, plan):
    # 先解除所有固定，再一次性排布；固定特征重算会撤销未捕获的位移。
    # Release every grounded occurrence before moving; recomputation resets uncaptured transforms.
    occurrences = sorted(list(root.occurrences), key=lambda o: o.component.name)
    if len(occurrences) != 4:
        raise RuntimeError('月饼或模具组件数量不完整。')
    for occurrence in occurrences:
        if occurrence.isGrounded:
            occurrence.isGrounded = False
        if hasattr(occurrence, 'isGroundToParent') and occurrence.isGroundToParent:
            occurrence.isGroundToParent = False
    pitch = plan['layoutPitch'] / 2
    positions = [(-pitch, -pitch, 0), (pitch, -pitch, 0), (-pitch, pitch, plan['bossHeight']), (pitch, pitch, plan['studLength'])]
    for occurrence, position in zip(occurrences, positions):
        _place(occurrence, *position)
    if root.parentDesign.snapshots.hasPendingSnapshot:
        root.parentDesign.snapshots.add()
    for occurrence, position in zip(occurrences, positions):
        actual = occurrence.transform2.translation.asArray()
        if any(abs(v * 10 - target) > .001 for v, target in zip(actual, position)):
            raise RuntimeError('组件展开位置未能保存，请重新生成。')


def _solid(component, name):
    if component.bRepBodies.count != 1 or not component.bRepBodies.item(0).isSolid or component.bRepBodies.item(0).volume <= .000001:
        raise RuntimeError('{} 不是单一封闭实体。'.format(name))
    component.bRepBodies.item(0).name = name


def _build_mold(parent, data, progress):
    plan = mold_plan(data)
    new = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
    join = adsk.fusion.FeatureOperations.JoinFeatureOperation
    cut = adsk.fusion.FeatureOperations.CutFeatureOperation
    sleeve = _new_component(parent, '02_模具外套筒')
    stamp = _new_component(parent, '03_可换镜像凹纹压片')
    rod = _new_component(parent, '04_螺纹推杆与手柄')
    sc, pc, rc = sleeve.component, stamp.component, rod.component
    height, radius = plan['sleeveHeight'], plan['outerRadius']
    _circle_feature(sc, 0, radius, height, new, '套筒外壁')
    if plan['draftAngle']:
        # 成形段向上收小；压片上方采用等径通道，可向大端顶出。
        # Taper only the cake cavity; a straight upper guide lets the stamp eject toward the wide end.
        start = inset_loop(plan['cavity'], -.03 * math.tan(math.radians(plan['draftAngle'])))
        _loft_outline(sc, start, plan['topCavity'], -.03, plan['cavityTaperHeight'], cut, '脱模斜度内腔')
        _polygon_feature(sc, plan['cavityTaperHeight'] - .03, {'outer': plan['topCavity']}, height - plan['cavityTaperHeight'] + .06, cut, '小端压片导向腔')
    else:
        _polygon_feature(sc, -.03, {'outer': plan['cavity']}, height + .06, cut, '配合花边内腔')
    _circle_feature(sc, height, radius, plan['baseThickness'], join, '腔底 6mm 与推杆导向孔', plan['guideRadius'])
    for direction in [-1, 1]:
        x1, x2 = direction * (radius - 2), direction * (radius + 16)
        loop = [[min(x1,x2),-9], [max(x1,x2),-9], [max(x1,x2),9], [min(x1,x2),9]]
        _polygon_feature(sc, height - 8, {'outer': loop}, 6, join, '套筒握耳')
    _solid(sc, '带握耳和导向孔的外套筒')
    _polygon_feature(pc, 0, {'outer': plan['stampOutline']}, plan['stampThickness'], new, '可换压片基体')
    _circle_feature(pc, -plan['bossHeight'], plan['bossRadius'], plan['bossHeight'] + .03, join, '压片背面螺纹座')
    socket = _circle_feature(pc, -plan['bossHeight'] - .03, plan['tapRadius'], plan['socketDepth'] + .03, cut, 'M20 盲孔')
    _thread(pc, socket, True)
    for i, region in enumerate(plan['grooves']):
        adsk.doEvents()
        if progress.wasCancelled:
            raise DesignError('已取消建模，新创建的模型已清理。')
        # 低层先切，较高的浮雕再切得更深 / Increasing depths preserve nested image layers.
        _polygon_feature(pc, plan['stampThickness'] - region['height'], region, region['height'] + .03, cut, '镜像凹纹_{:03d}'.format(i + 1))
        progress.progressValue += 1
    _solid(pc, '镜像凹纹压片（正面朝上）')
    _circle_feature(rc, 0, plan['shaftRadius'], plan['shaftLength'], new, '导向推杆')
    stud = _circle_feature(rc, -plan['studLength'], plan['threadDiameter'] / 2, plan['studLength'] + .03, join, 'M20 连接螺柱 15mm')
    _thread(rc, stud, False)
    _circle_feature(rc, plan['shaftLength'], plan['handleRadius'], plan['handleThickness'], join, '推压手柄')
    _solid(rc, 'M20 推杆与手柄')
    parent.attributes.add('Mooncake', 'mold', json.dumps(plan['settings'], ensure_ascii=False))
    return plan


def _sketch_region(component, plane, region, name):
    sketch = component.sketches.add(plane)
    sketch.name = name
    sketch.isComputeDeferred = True
    try:
        for loop in [region['outer']] + region.get('holes', []):
            points = [adsk.core.Point3D.create(p[0] / 10, p[1] / 10, 0) for p in loop]
            for i, p in enumerate(points):
                sketch.sketchCurves.sketchLines.addByTwoPoints(p, points[(i + 1) % len(points)])
    finally:
        sketch.isComputeDeferred = False
    expected = (abs(signed_area(region['outer'])) - sum(abs(signed_area(h)) for h in region.get('holes', []))) / 100
    # 通过净面积选择带孔区域，避免错误填充汉字内孔 / Match net area, preserving counters.
    candidates = [(abs(sketch.profiles.item(i).areaProperties().area - expected), sketch.profiles.item(i)) for i in range(sketch.profiles.count)]
    if not candidates:
        raise DesignError('{} 没有形成闭合草图。'.format(name))
    difference, profile = min(candidates, key=lambda item: item[0])
    if difference > max(.00002, expected * .0001):
        raise DesignError('{} 草图轮廓不匹配，请简化图案。'.format(name))
    return sketch, profile


def build_model(data):
    validate_design(data)
    data = {**data, 'mold': mold_settings(data)}
    mold_plan(data)  # 创建文档前检查装配空间 / Check fit before creating a document.
    app = adsk.core.Application.get()
    ui = app.userInterface
    previous_document = app.activeDocument
    document = None
    occurrence = None
    progress = None
    regions = sorted(data['geometry']['reliefs'], key=lambda r: r['height'])
    try:
        document = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            raise RuntimeError('无法创建 Fusion 设计文档。')
        if design.designType != adsk.fusion.DesignTypes.ParametricDesignType:
            design.designType = adsk.fusion.DesignTypes.ParametricDesignType
        # Fusion 2026 默认零件设计不允许子组件 / New releases default to part intent.
        if hasattr(design, 'designIntent'):
            design.designIntent = adsk.fusion.DesignIntentTypes.HybridDesignIntentType
        progress = ui.createProgressDialog()
        progress.isCancelButtonShown = True
        progress.show('Mooncake · 月饼与配套模具', '正在构建轮廓 %v / %m', 0, len(regions) * 2 + 2, 0)
        occurrence = design.rootComponent.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        component = occurrence.component
        component.name = '01_月饼_{}_{}mm'.format(data['text']['character'] or 'custom', data['dimensions']['diameter'])
        thickness = data['dimensions']['thickness']
        extrudes = component.features.extrudeFeatures
        if draft_angle(data):
            feature = _loft_outline(component, data['geometry']['outline'], top_outline(data), 0, thickness, adsk.fusion.FeatureOperations.NewBodyFeatureOperation, '月饼脱模斜度 {}°'.format(draft_angle(data)))
        else:
            sketch, profile = _sketch_region(component, component.xYConstructionPlane, {'outer': data['geometry']['outline']}, '周边轮廓')
            feature = extrudes.addSimple(profile, adsk.core.ValueInput.createByString('{} mm'.format(thickness)), adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
            sketch.isVisible = False
            if feature:
                feature.name = '月饼厚度'
        if not feature or feature.bodies.count != 1:
            raise RuntimeError('月饼基体生成失败。')
        body = feature.bodies.item(0)
        body.name = '月饼实体'
        progress.progressValue = 1
        if regions:
            plane_input = component.constructionPlanes.createInput()
            # 轻微重叠确保所有浮雕与基体稳定融合 / Overlap for reliable joins.
            plane_input.setByOffset(component.xYConstructionPlane, adsk.core.ValueInput.createByString('{} mm'.format(thickness - .03)))
            plane = component.constructionPlanes.add(plane_input)
            plane.name = '正面浮雕基准'
            for i, region in enumerate(regions):
                adsk.doEvents()
                if progress.wasCancelled:
                    raise DesignError('已取消建模，新创建的模型已清理。')
                label = '{}_{:03d}'.format(str(region.get('label', '浮雕'))[:40], i + 1)
                sketch, profile = _sketch_region(component, plane, region, label)
                feature = extrudes.addSimple(profile, adsk.core.ValueInput.createByString('{} mm'.format(region['height'] + .03)), adsk.fusion.FeatureOperations.JoinFeatureOperation)
                if not feature:
                    raise RuntimeError('{} 拉伸失败。'.format(label))
                feature.name = label
                sketch.isVisible = False
                progress.progressValue = i + 2
            plane.isLightBulbOn = False
        _solid(component, '月饼实体')
        component.attributes.add('Mooncake', 'design', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        root = design.rootComponent
        document.name = 'Mooncake_{}_{}mm_月饼与模具'.format(data['text']['character'] or 'custom', data['dimensions']['diameter'])
        plan = _build_mold(root, data, progress)
        _layout(root, plan)
        root.attributes.add('Mooncake', 'design', json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        if root.occurrences.count != 4:
            raise RuntimeError('月饼或模具组件数量不完整。')
        for i in range(root.occurrences.count):
            part = root.occurrences.item(i).component
            _solid(part, part.name)
        progress.progressValue = len(regions) * 2 + 2
        app.activeViewport.fit()
        return root
    except Exception:
        if occurrence and occurrence.isValid:
            occurrence.deleteMe()
        if document and document.isValid:
            document.close(False)
        if previous_document and previous_document.isValid:
            previous_document.activate()
        raise
    finally:
        if progress:
            progress.hide()


def save_model(component):
    """可取消的本地 .f3d 导出 / Optional local archive export."""
    app = adsk.core.Application.get()
    dialog = app.userInterface.createFileDialog()
    dialog.title = '保存月饼与模具装配（取消仍会保留四个组件）'
    dialog.filter = 'Fusion 360 archive (*.f3d)'
    dialog.initialFilename = component.name + '.f3d'
    if dialog.showSave() != adsk.core.DialogResults.DialogOK:
        return None
    path = dialog.filename
    if not path.lower().endswith('.f3d'):
        path += '.f3d'
    design = adsk.fusion.Design.cast(app.activeProduct)
    options = design.exportManager.createFusionArchiveExportOptions(path, component)
    if not options or not design.exportManager.execute(options):
        raise RuntimeError('实体已创建，但 3D 文件导出失败。请在 Fusion 中手动保存。')
    return path
