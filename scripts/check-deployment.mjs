import {DatabaseSync} from 'node:sqlite';
import {join,resolve} from 'node:path';
import {existsSync} from 'node:fs';

// 只读验收：不初始化数据库，不输出账号或密码哈希。
let database;
try{
  const url=new URL(process.env.APP_URL||'');
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('APP_URL 必须是完整的 HTTPS 站点来源，不包含账号、路径或查询参数。');
  const directory=resolve(process.env.DATA_DIR||'data');
  const filename=join(directory,'world.sqlite');
  if(!existsSync(filename))throw new Error('数据库不存在，请先在本地设置站主账号，再迁移完整数据目录。');
  database=new DatabaseSync(filename,{readOnly:true});
  const owner=database.prepare('SELECT password FROM owner WHERE id=1').get();
  if(!owner||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(String(owner.password)))throw new Error('缺少有效站主账号，请先在本地运行 npm run setup-owner，再迁移完整数据目录。');
  console.log('部署检查通过：HTTPS 来源与站主账号已就绪。');
}catch(error){
  console.error(`[deployment] 无法启动公开网站：${error instanceof Error?error.message:'数据库或站主账号检查失败。'}`);
  process.exitCode=1;
}finally{database?.close();}
