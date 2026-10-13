// Static snapshots also support custom domains. / 静态快照支持自定义域名。
const workflowMount = decodeURIComponent(location.pathname).match(/^(.*)\/底盘机器人\/dist(?:-static)?(?:\/|$)/)?.[1];
export const isStatic = import.meta.env.MODE === 'static'
  || location.hostname.endsWith('.github.io')
  || workflowMount !== undefined;
export const workspaceUrl = isStatic
  ? (workflowMount === undefined ? './' : `${workflowMount}/index.html#/workflow`)
  : '/studio/#/workflow';
