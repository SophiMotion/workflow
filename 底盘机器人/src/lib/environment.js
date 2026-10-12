// Static builds and GitHub Pages run without a project server. / 静态部署直接使用本地编辑。
export const isStatic = import.meta.env.MODE === 'static' || location.hostname.endsWith('.github.io');
const workflowMount = decodeURIComponent(location.pathname).match(/^(.*)\/底盘机器人\/dist(?:-static)?(?:\/|$)/)?.[1];
export const workspaceUrl = isStatic
  ? (workflowMount === undefined ? './' : `${workflowMount}/index.html#/workflow`)
  : '/studio/#/workflow';
