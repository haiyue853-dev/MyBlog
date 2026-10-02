import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildCloudflare,projectRoot} from './build-cloudflare';
import {CLOUD_PASSWORD_SCHEME} from '../src/lib/cloud-password';
import {parseScryptEncoded} from '../src/lib/security';
import type {Asset} from '../src/lib/types';

const quote=(value:string)=>`'${value.replaceAll("'","''")}'`;
function chunks(value:string){const result:string[]=[];let chunk='';let size=0;for(const char of value){chunk+=char;if(++size===7000){result.push(chunk);chunk='';size=0;}}if(chunk||!result.length)result.push(chunk);return result;}
export function migratePassword(encoded:string){
  const parsed=parseScryptEncoded(encoded);
  if(!parsed)throw new Error('请先在本地初始化有效的站主账号。');
  // 云端只存 sha256(scrypt 结果)，并带上成本 N 以便浏览器按对应成本校验（兼容新旧本地格式）。
  const hash=createHash('sha256').update(Buffer.from(parsed.hash,'hex')).digest('hex');
  return `${CLOUD_PASSWORD_SCHEME}:${parsed.N}:${parsed.salt}:${hash}`;
}
export async function exportCloudflare(source:string,destination:string){
  source=resolve(source);destination=resolve(destination);
  if(destination===source||destination.startsWith(source+sep))throw new Error('部署包目录必须位于数据目录之外。');
  const db=new DatabaseSync(join(source,'world.sqlite'),{readOnly:true});
  const sql:string[]=[];let assets:Asset[];let itemCount=0;
  try{
    db.exec('BEGIN');
    const owner=db.prepare('SELECT name,password FROM owner WHERE id=1').get();
    if(!owner)throw new Error('请先运行 npm run setup-owner 初始化账号，再生成部署包。');
    const password=migratePassword(String(owner.password));
    for(const table of ['items','assets','settings'] as const){
      // Iris tokens/settings and old sessions deliberately do not migrate.
      const rows=db.prepare(table==='settings'?"SELECT key,data FROM settings WHERE key='profile'":`SELECT * FROM ${table}`).all();
      if(table==='items')itemCount=rows.length;
      for(const row of rows){
        const parts=chunks(String(row.data));const key=table==='settings'?'key':'id';const id=String(row[key]);
        if(table==='items')sql.push(`INSERT OR REPLACE INTO items(id,kind,visibility,asset_id,data) VALUES(${quote(id)},${quote(String(row.kind))},${quote(String(row.visibility))},${row.asset_id?quote(String(row.asset_id)):'NULL'},${quote(parts[0])});`);
        else sql.push(`INSERT OR REPLACE INTO ${table}(${key},data) VALUES(${quote(id)},${quote(parts[0])});`);
        for(const part of parts.slice(1))sql.push(`UPDATE ${table} SET data=data||${quote(part)} WHERE ${key}=${quote(id)};`);
      }
    }
    assets=db.prepare('SELECT data FROM assets').all().map(row=>JSON.parse(String(row.data)) as Asset);
    // Owner goes last: a completed remote owner means the initial import has finished.
    sql.push(`INSERT OR IGNORE INTO owner(id,name,password) VALUES(1,${quote(String(owner.name))},${quote(password)});`);
    db.exec('COMMIT');
  }finally{db.close();}
  const code=await buildCloudflare(destination);
  await mkdir(join(destination,'private-import/files'),{recursive:true});
  const filesRoot=await realpath(join(source,'files'));
  if(assets.reduce((total,file)=>total+file.size,0)>8*1024*1024*1024)throw new Error('迁移文件超过本版本 8 GiB 存储上限。');
  for(const asset of assets){
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(asset.id))throw new Error('附件编号无效，已停止打包。');
    const path=await realpath(join(filesRoot,asset.id));if(!path.startsWith(filesRoot+sep))throw new Error('附件位于数据目录之外，已停止打包。');
    await copyFile(path,join(destination,'private-import/files',asset.id));
  }
  await writeFile(join(destination,'private-import/data.sql'),sql.join('\n')+'\n');
  await writeFile(join(destination,'private-import/manifest.json'),JSON.stringify({itemCount,files:assets.map(({id,mime})=>({id,mime}))},null,2));
  for(const file of ['deploy.mjs','deploy.cmd'])await copyFile(join(projectRoot,'cloudflare',file),join(destination,file));
  await copyFile(join(projectRoot,'docs/Cloudflare部署说明.md'),join(destination,'部署说明.md'));
  await writeFile(join(destination,'.gitignore'),'private-import/\n.cloudflare-state.json\n.wrangler/\n.env*\n');
  return {...code,itemCount,assetCount:assets.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(existsSync(join(projectRoot,'.env.local')))process.loadEnvFile(join(projectRoot,'.env.local'));
  const destination=resolve(process.argv[2]||join(projectRoot,'outputs',`cloudflare-full-${new Date().toISOString().replace(/[:.]/g,'-')}`));
  const result=await exportCloudflare(process.env.DATA_DIR||join(projectRoot,'data'),destination);
  console.log(`完整部署包：${destination}\n记录：${result.itemCount}；文件：${result.assetCount}`);
  if(process.platform==='win32'){
    const zip=destination+'.zip';execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      'Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $env:LITTLE_WORLD_CF_DIR -Force | ForEach-Object {$_.FullName}) -DestinationPath $env:LITTLE_WORLD_CF_ZIP -CompressionLevel Optimal'],
      {env:{...process.env,LITTLE_WORLD_CF_DIR:destination,LITTLE_WORLD_CF_ZIP:zip},stdio:'pipe'});
    console.log(`ZIP：${zip}`);
  }
  console.log('包内含私人迁移资料，请勿分享整个 ZIP。只会将 public/ 作为网页静态资源发布。');
}
