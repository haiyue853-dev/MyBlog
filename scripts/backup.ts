import {backup,DatabaseSync} from 'node:sqlite';
import {cp,mkdir,access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';

if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const source=resolve(process.env.DATA_DIR||'data');const destination=resolve(process.argv[2]||join('backups',new Date().toISOString().replace(/[:.]/g,'-')));
if(destination===source||destination.startsWith(source+'\\')||destination.startsWith(source+'/'))throw new Error('备份位置必须在数据目录之外。');
await access(join(source,'world.sqlite'));
await mkdir(dirname(destination),{recursive:true});
await mkdir(destination,{recursive:false});
const db=new DatabaseSync(join(source,'world.sqlite'),{readOnly:true});
try{await backup(db,join(destination,'world.sqlite'));await cp(join(source,'files'),join(destination,'files'),{recursive:true});console.log(`备份已保存：${destination}`);}finally{db.close();}
