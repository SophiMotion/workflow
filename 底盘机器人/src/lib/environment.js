// Static builds and GitHub Pages run without a project server. / 静态部署直接使用本地编辑。
export const isStatic = import.meta.env.MODE === 'static' || location.hostname.endsWith('.github.io');
export const workspaceUrl = isStatic ? './' : '/studio/#/workflow';
