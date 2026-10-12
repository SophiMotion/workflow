import('./app.js').catch(error => {
  const notice=document.getElementById('fatal');notice.hidden=false;notice.textContent='场景资源加载失败，请检查本地服务是否运行，然后刷新页面。';
  for(const id of ['upload','play','restart'])document.getElementById(id).disabled=true;
  console.error(error);
});
