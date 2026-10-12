import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider, useI18n } from './i18n';
import './styles.css';
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <ErrorScreen/> : this.props.children; }
}
function ErrorScreen() { const { t } = useI18n(); return <main className="app-error"><h1>{t('页面遇到了一点问题')}</h1><p>{t('请重新加载后继续设计。')}</p><button onClick={() => location.reload()}>{t('重新加载')}</button></main>; }
createRoot(document.getElementById('root')).render(<LanguageProvider><ErrorBoundary><App/></ErrorBoundary></LanguageProvider>);
