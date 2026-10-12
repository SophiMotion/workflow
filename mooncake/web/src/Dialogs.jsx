import { useI18n } from './i18n';
import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Upload, Box, Check, ArrowUpRight, Minus, Plus } from 'lucide-react';
import { SIDE_NAMES, PATTERN_NAMES, MOLD_DEFAULT, download, topDiameter, currentMold, moldFitError } from './design';
export function Modal({ title, onClose, children, className = '' }) {
  const { t } = useI18n();
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); return () => { if (el.open) el.close(); }; }, []);
  return <dialog className={`modal ${className}`} ref={ref} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} aria-labelledby="dialog-title"><div className="modal-content"><div className="modal-head"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label={t("关闭弹窗")} onClick={onClose}><X size={20}/></button></div>{children}</div></dialog>;
}
export function PurchaseDialog({ design: d, getDocument, onClose }) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(1), [note, setNote] = useState(''), [saved, setSaved] = useState(false);
  const save = () => {
    const order = { schema: 'mooncake.order', version: 1, id: `MC-${Date.now()}`, createdAt: new Date().toISOString(), status: 'draft', paymentStatus: 'unpaid', quantity, note, design: getDocument() };
    download(`${order.id}.json`, JSON.stringify(order, null, 2)); setSaved(true);
  };
  return <Modal title={t(saved ? '心意已保存' : '确认你的专属定制')} onClose={onClose}><p className="modal-description">{t(saved ? '定制订单已下载到本机，请交给商家确认价格与制作。' : '核对设计，保存一份属于你的定制清单。')}</p>{saved && <div className="success-mark"><Check size={28}/></div>}<div className="order-summary"><span className="order-character serif" style={{ fontSize: (d.character?.length || 1) > 2 ? 48 / d.character.length : d.character?.length === 2 ? 23 : 32 }}>{d.character || '月'}</span><div><strong>{t("专属月饼 ·")} {d.character || t('无字款')}</strong><p>{d.diameter} × {d.thickness} mm · {t(SIDE_NAMES[d.side])}</p><p>{d.mode === 'image' ? t('专属图片浮雕') : t(PATTERN_NAMES[d.pattern])} · {t('浮雕')} {d.relief} mm</p></div></div><div className="quantity-row"><span>{t("定制数量")}</span><div className="quantity-control"><button aria-label={t("减少数量")} disabled={quantity <= 1} onClick={() => { setQuantity(q => q - 1); setSaved(false); }}><Minus size={16}/></button><input aria-label={t("定制数量")} type="number" min="1" max="999" value={quantity} onChange={e => { setQuantity(Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1)))); setSaved(false); }}/><button aria-label={t("增加数量")} disabled={quantity >= 999} onClick={() => { setQuantity(q => q + 1); setSaved(false); }}><Plus size={16}/></button></div></div><label className="field-title" htmlFor="order-note">{t("给商家的备注")} <span className="muted">{t("（选填）")}</span></label><textarea id="order-note" maxLength={300} rows={3} value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} placeholder={t("写下你的包装、数量或制作需求…")}/><div className="order-status"><span>{t("订单状态")}</span><strong>{t("待商家确认 · 未付款")}</strong></div><p className="field-note">{t("此页面尚未连接商城。保存清单不会提交订单或扣款，最终价格与交付时间由商家确认。")}</p><button className="primary full-width" onClick={save}><Download size={18}/>{t(saved ? '再次下载定制订单' : '保存定制订单')}</button></Modal>;
}
export function AdminDialog({ onClose, onExport, onImport, onBuild, fusion, busy, status }) {
  const { t } = useI18n();
  const file = useRef(null);
  return <Modal title={t("设计文件管理")} onClose={onClose}><p className="modal-description">{t("将你的设计带到 Fusion 360，继续完成制作。")}</p><div className="admin-actions"><button onClick={onExport}><span className="action-icon blue"><Download size={21}/></span><span><strong>{t("导出设计 JSON")}</strong><small>{t("包含尺寸、花纹、文字与实体轮廓")}</small></span><ArrowUpRight size={18}/></button><button onClick={() => file.current.click()}><span className="action-icon green"><Upload size={21}/></span><span><strong>{t("导入已有设计")}</strong><small>{t("恢复参数，继续调整你的设计")}</small></span><ArrowUpRight size={18}/></button><button disabled={busy} onClick={onBuild}><span className="action-icon yellow"><Box size={21}/></span><span><strong>{t(busy ? '正在创建实体…' : '导入 Fusion')}</strong><small>{t("打开本机插件，生成月饼与对应模具")}</small></span><ArrowUpRight size={18}/></button></div><input className="visually-hidden" ref={file} type="file" accept=".json,application/json" aria-label={t("导入设计文件")} onChange={onImport}/><div className="fusion-connection">{status?.filePath ? <>{t("F3D 已保存到")}<code>{status.filePath}</code></> : status?.pluginPath ? <>{t("已连接插件")}<code>{status.pluginPath}</code></> : t('本机插件：mooncake/mooncake.py · 与 Mooncake.html 同目录')}</div><p className="field-note admin-note">{t("当前是本地管理员工具，无账号登录功能。设计文件保存在你的设备上。")}</p></Modal>;
}
export function MoldDialog({ design, update, fusion, busy, onConfirm, onClose }) {
  const { t } = useI18n();
  const mold = currentMold(design.mold), fitError = moldFitError(design);
  return <Modal title={t("确认月饼与配套模具")} onClose={onClose}>
    <p className="modal-description">{t("沿用当前尺寸、花纹和居中文字，生成可拆装的手压月饼模具。")}</p>
    <p className="draft-note mold-draft">{t('底面')} ⌀ {design.diameter} → {t('文字面')} ⌀ {topDiameter(design).toFixed(2)} mm · {t('脱模斜度')} {design.draftAngle}°</p><div className="mold-parts">{[['01', '月饼实体', `${design.diameter} × ${design.thickness} mm · ${design.character || t('无字款')}`], ['02', '外套筒', `${t('成形腔高度')} ${design.thickness} mm · ${t('内部直壁段')} 6 mm · ${t('腔底厚度')} 6 mm`], ['03', '可更换压片', '镜像凹纹 · Ø30 螺纹座 · M20 × 2.5 盲孔'], ['04', '推杆与手柄', '光杆 Ø30 × 40 mm · 螺纹段 M20 × 15 mm · 手柄 Ø40 mm']].map(([n, title, note]) => <div key={n}><span>{n}</span><div><strong>{t(title)}</strong><small>{t(note)}</small></div></div>)}</div>
    <div className="mold-fields">{[['radialClearance', '径向间隙', .15, .8, .05], ['wallThickness', '套筒壁厚', 2, 8, .5], ['stampThickness', '压片厚度', 4, 6, .5]].map(([key, label, min, max, step]) => <label key={key}>{t(label)}<span><input aria-label={t(label)} type="number" min={min} max={max} step={step} defaultValue={mold[key]} onBlur={e => { const value = Math.min(max, Math.max(min, Number(e.target.value) || mold[key])); e.target.value = value; update({ mold: { ...mold, [key]: value } }); }}/>mm</span></label>)}</div>
    <p className="field-note">{t('套筒总高为月饼厚度加 12 mm：内部直壁段 6 mm，腔底 6 mm。Ø30 螺纹座穿过导向孔；M20 盲孔深 16 mm。')}</p>
    {fitError && <p className="inline-error" role="alert">{t(fitError)}</p>}
    <p className="fusion-connection">{t(fusion ? '已连接 Fusion 设计器' : '连接本机 Mooncake 插件；Fusion 未启动时将自动唤起。首次使用需将 mooncake 文件夹加入“脚本和附加模块”并启用“启动时运行”。')}</p><button className="primary full-width" disabled={busy || !!fitError} onClick={onConfirm}><Box size={18}/>{t(busy ? '正在连接 Fusion…' : '确认并导入 Fusion')}</button>
  </Modal>;
}
export function GuideDialog({ onClose }) {
  const { t } = useI18n(); return <Modal title={t("让心意，慢慢成形")} onClose={onClose}><div className="guide-steps"><div><span>01</span><h3>{t("选一个喜欢的轮廓")}</h3><p>{t("设置直径与厚度，挑选花边。拖动月饼可以查看每个角度。")}</p></div><div><span>02</span><h3>{t("给团圆添点花样")}</h3><p>{t("选择参数化花纹，或上传黑白图案制作浮雕。花纹直径和凸起高度都可以调整。")}</p></div><div><span>03</span><h3>{t("把祝福刻在中间")}</h3><p>{t("输入最多两个汉字或五个英文字母，英文可沿内圈排列。满意后保存定制订单，交给商家确认制作。")}</p></div></div><div className="tip">{t("厚度指饼身高度，浮雕会额外凸起。预览颜色仅用于展示，实际效果以制作工艺为准。")}</div></Modal>; }
