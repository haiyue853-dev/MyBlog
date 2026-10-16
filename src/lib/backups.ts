import {backup,DatabaseSync} from 'node:sqlite';
import {copyFile,mkdir,mkdtemp,readdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Store} from './store';
import type {BackupInfo} from './backup-types';
import type {Asset} from './types';
import {writeBackupArchive} from './backup-archive';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function backupDirectory(store:Store){return join(store.directory,'backups');}
export function backupArchivePath(store:Store,id:string){
  if(!UUID.test(id))throw new Error('Invalid backup id');
  return join(backupDirectory(store),`${id}.tar.gz`);
}
export function backupFilename(info:BackupInfo){return `my-little-world-${info.createdAt.replace(/[:.]/g,'-')}-${info.id.slice(0,8)}.tar.gz`;}

const RESTORE_INSTRUCTIONS=`# 恢复个人小屋

本备份包含照片、视频原件、文档、公开与私密记录、人物分组、标签、多图顺序、个人设置、账号、点赞及统计。包含私密资料与账号信息，请自己保管。

1. 停止正在运行的小屋服务，避免恢复过程中写入数据。
2. 将本压缩包解压到一个新的目录。该目录应直接包含 world.sqlite 和 files 文件夹；不要覆盖仍在使用的 data，也不要混入旧的 world.sqlite-wal / world.sqlite-shm。
3. 在项目 .env.local 中将 DATA_DIR 指向刚解压的目录。例如 DATA_DIR=D:/MyBlog-restored。阿里云 Docker 部署则修改宿主机 HOST_DATA_DIR，并保证容器对新目录有读写权限。
4. 使用同一项目代码重新启动小屋。本地可执行 npm start；Docker 可执行 docker compose up -d web。
5. 用原站主密码登录，检查照片、视频播放、收藏、标签、日记和私人文件。确认后再继续添加内容。先保留原数据目录，方便切回。

账号和登录会话一同保留。若备份曾泄露，恢复后应重设站主密码并撤销旧会话。

压缩包可用系统解压工具打开，也可以执行 tar -xzf 备份文件.tar.gz -C 新目录（先创建新目录）。backup.json 记录备份时间与内容数量。
`;

// Call while holding exclusive API access for this Store. The standalone CLI
// retains its existing stop-writes requirement.
export async function createBackup(store:Store):Promise<BackupInfo>{
  const root=backupDirectory(store);await mkdir(root,{recursive:true,mode:0o700});
  const stage=await mkdtemp(join(root,'.pending-'));
  const id=randomUUID();const archive=backupArchivePath(store,id);
  const metadata=join(root,`${id}.json`);
  let published=false;
  try{
    const snapshot=join(stage,'world.sqlite');await backup(store.db,snapshot);
    const db=new DatabaseSync(snapshot,{readOnly:true});
    let assets:Asset[];let collectionCount:number;let momentCount:number;let videoCount:number;
    try{
      assets=db.prepare('SELECT data FROM assets').all().map(row=>JSON.parse(String(row.data)) as Asset);
      collectionCount=Number(db.prepare("SELECT count(*) AS n FROM items WHERE kind='collection'").get()!.n);
      momentCount=Number(db.prepare("SELECT count(*) AS n FROM items WHERE kind='moment'").get()!.n);
      videoCount=Number(db.prepare("SELECT count(*) AS n FROM items WHERE kind='video'").get()!.n);
    }finally{db.close();}
    await mkdir(join(stage,'files'));
    for(const asset of assets){
      if(!UUID.test(asset.id))throw new Error('Invalid attachment id in backup');
      await copyFile(join(store.directory,'files',asset.id),join(stage,'files',asset.id));
    }
    const manifest={formatVersion:1,id,createdAt:new Date().toISOString(),collectionCount,momentCount,videoCount,assetCount:assets.length};
    await writeFile(join(stage,'backup.json'),JSON.stringify(manifest,null,2));
    await writeFile(join(stage,'RESTORE.md'),RESTORE_INSTRUCTIONS);
    const pendingArchive=join(stage,'complete.tar.gz');
    await writeBackupArchive(stage,['world.sqlite','backup.json','RESTORE.md',...assets.map(asset=>`files/${asset.id}`)],pendingArchive);
    const size=(await stat(pendingArchive)).size;
    const info:BackupInfo={id,createdAt:manifest.createdAt,size,collectionCount,momentCount,videoCount,assetCount:assets.length};
    await rename(pendingArchive,archive);
    await writeFile(metadata,JSON.stringify(info,null,2),{flag:'wx',mode:0o600});
    published=true;return info;
  }finally{
    if(!published){await rm(archive,{force:true});await rm(metadata,{force:true});}
    const target=resolve(stage);
    if(!target.startsWith(resolve(root)+sep))throw new Error('Invalid backup staging directory');
    await rm(target,{recursive:true,force:true});
  }
}

export async function listBackups(store:Store):Promise<BackupInfo[]>{
  const root=backupDirectory(store);
  let names:string[];
  try{names=await readdir(root);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  const backups:BackupInfo[]=[];
  for(const name of names){
    const id=name.replace(/\.json$/,'');if(!name.endsWith('.json')||!UUID.test(id))continue;
    try{
      const value=JSON.parse(await readFile(join(root,name),'utf8')) as BackupInfo;
      if(value.id!==id||!Number.isFinite(Date.parse(value.createdAt))||![value.size,value.collectionCount,value.momentCount,value.assetCount].every(n=>Number.isInteger(n)&&n>=0))continue;
      if(value.videoCount!==undefined&&(!Number.isInteger(value.videoCount)||value.videoCount<0))continue;
      const file=await stat(backupArchivePath(store,id));if(!file.isFile()||file.size!==value.size)continue;
      backups.push({id,createdAt:value.createdAt,size:file.size,collectionCount:value.collectionCount,momentCount:value.momentCount,...(value.videoCount!==undefined?{videoCount:value.videoCount}:{}),assetCount:value.assetCount});
    }catch(error){if(error instanceof SyntaxError||(error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  }
  return backups.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
