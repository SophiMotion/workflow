import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../boss/boss-1/want/store.mjs';
export async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'want-test-'));await fs.mkdir(path.join(root,'boss'));
 const config={timezone:'Asia/Shanghai',roles:[{id:'electrical',name:'电控',reviewTarget:100,contactTarget:20,requirements:'CAN 控制',greeting:'你好'}],archivedRoles:[{id:'3d',name:'3D'}]};
 const data={updatedAt:'2026-09-27T12:00:00Z',reviews:[
 {id:'a',candidateKey:'id:a',name:'同名',roleId:'electrical',skills:'CAN',evidence:'控制调试',reviewLevel:'详细',status:'已发送',reviewedAt:'2026-09-26T15:00:00Z',sentAt:'2026-09-26T16:01:00Z',verification:'对话出现',message:'你好'},
 {id:'b',candidateKey:'id:b',name:'同名',roleId:'electrical',reviewLevel:'摘要',status:'待核验',reviewedAt:'2026-09-27T03:00:00Z',message:'<script>x</script>'},
 {id:'c',candidateKey:'id:c',name:'归档',roleId:'3d',status:'未发送',reviewedAt:'2026-09-25T03:00:00Z'}],runs:[{id:'run'}]};
 await fs.writeFile(path.join(root,'boss/recruitment-config.json'),JSON.stringify(config));await fs.writeFile(path.join(root,'boss/recruitment-data.json'),JSON.stringify(data));
 const store=new Store(root);await store.init();return {root,store,data,config};
}
