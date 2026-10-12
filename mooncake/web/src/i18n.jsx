import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, translate } from './translations';
const Context = createContext(null);
const STORAGE = 'mooncake.locale';
export function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(() => { try { const saved = localStorage.getItem(STORAGE); return Object.hasOwn(LANGUAGES, saved) ? saved : 'zh'; } catch { return 'zh'; } });
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    document.title = `Mooncake · ${translate(locale, '设计工坊')}`;
    try { localStorage.setItem(STORAGE, locale); } catch { /* 不影响语言切换 / Keep switching available without storage. */ }
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: key => translate(locale, key), numberLabel: label => locale === 'zh' ? `${label}数值` : `${label} (${{en: 'value', fr: 'valeur', ja: '数値'}[locale]})` }), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() { return useContext(Context); }
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  return <label className="language-selector"><span aria-hidden="true">◎</span><select id="language" aria-label={t('界面语言')} value={locale} onChange={e => setLocale(e.target.value)}>{Object.entries(LANGUAGES).map(([key, name]) => <option key={key} value={key} lang={key}>{name}</option>)}</select></label>;
}
