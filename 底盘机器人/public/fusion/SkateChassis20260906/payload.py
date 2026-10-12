"""Validate data files without executing expressions or accepting code. / 配置校验。"""
import ast
import json
import math
import re

SCHEMA='sophistudio.skatechassis.fusion/v1'
LIMITS={'length':(400,1000),'width':(350,800),'mast':(600,1600),'wheel':(150,300),
        'payload':(10,100),'speed':(.2,2),'batteryAh':(10,60),'quantity':(1,100)}
OPTIONS={'material':['aluminum','steel'],'drive':['differential','mecanum'],
         'motor':['250w','350w'],'controller':['stm32','industrial'],'compute':['none','rpi5','jetson'],
         'arm':['none','dual6','dual12'],'lidar':['none','a1','mid360'],'camera':['none','depth','rgb']}

def expression_value(expression, config):
    if not isinstance(expression,str) or len(expression)>180: raise ValueError('尺寸表达式无效')
    names={'body_length':config['length'],'body_width':config['width'],
           'mast_height':config['mast'],'wheel_diameter':config['wheel']}
    parsed=ast.parse(re.sub(r'\bmm\b','',expression).strip(), mode='eval')
    def number(node):
        if isinstance(node,ast.Constant) and type(node.value) in (int,float): return node.value
        if isinstance(node,ast.Name) and node.id in names: return names[node.id]
        if isinstance(node,ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            return number(node.operand)*(1 if isinstance(node.op,ast.UAdd) else -1)
        if isinstance(node,ast.BinOp):
            a,b=number(node.left),number(node.right)
            if isinstance(node.op,ast.Add): return a+b
            if isinstance(node.op,ast.Sub): return a-b
            if isinstance(node.op,ast.Mult): return a*b
            if isinstance(node.op,ast.Div): return a/b
        raise ValueError('仅允许数字、主参数和四则运算')
    value=number(parsed.body)
    if not math.isfinite(value): raise ValueError('尺寸必须为有限数值')
    return value

def validate_payload(value):
    if not isinstance(value,dict) or value.get('schema',SCHEMA)!=SCHEMA: raise ValueError('不是 SkateChassis 配置文件')
    cfg=value.get('config',{})
    for key,(low,high) in LIMITS.items():
        n=cfg.get(key)
        if type(n) not in (int,float) or not math.isfinite(n) or not low<=n<=high or (key!='speed' and n!=int(n)):
            raise ValueError('参数超出范围：'+key)
    for key,options in OPTIONS.items():
        if cfg.get(key) not in options: raise ValueError('选项无效：'+key)
    for key in ['imu','estop']:
        if type(cfg.get(key)) is not bool: raise ValueError('开关无效：'+key)
    bodies=value.get('bodies')
    if not isinstance(bodies,list) or not 1<=len(bodies)<=64: raise ValueError('缺少有效零件数据')
    ids=set()
    for body in bodies:
        name=body.get('id','')
        if not re.fullmatch(r'[a-z][a-z0-9_]{0,39}',name) or name in ids: raise ValueError('零件名称重复或无效')
        ids.add(name)
        if body.get('shape') not in ['box','cylinder']: raise ValueError('不支持的形状')
        dims=body.get('sizeExpr',[])
        if len(dims)!=(3 if body['shape']=='box' else 2): raise ValueError('零件尺寸缺失')
        if any(not .01<=expression_value(x,cfg)<=5000 for x in dims): raise ValueError('零件尺寸超出范围')
        pos=body.get('positionExpr',[])
        if len(pos)!=3 or any(abs(expression_value(x,cfg))>10000 for x in pos): raise ValueError('装配位置无效')
        rotation=body.get('rotation',[])
        if len(rotation)!=3 or any(type(x) not in (int,float) or not math.isfinite(x) for x in rotation): raise ValueError('旋转参数无效')
    return value

def load_payload(file):
    with open(file,'rb') as stream:
        content=stream.read(1024*1024+1)
    if len(content)>1024*1024: raise ValueError('配置文件超过 1 MB')
    return validate_payload(json.loads(content.decode('utf-8-sig')))
