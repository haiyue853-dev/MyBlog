import {spawn} from 'node:child_process';
import {cpSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const root=process.cwd();if(existsSync(join(root,'.env.local')))process.loadEnvFile(join(root,'.env.local'));
const portIndex=process.argv.indexOf('--port');const port=portIndex>=0?process.argv[portIndex+1]:process.env.PORT||'3000';
if(!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('端口需要在 1 到 65535 之间。');
const standalone=join(root,'.next','standalone');if(!existsSync(join(standalone,'server.js')))throw new Error('请先运行 npm run build。');
cpSync(join(root,'.next','static'),join(standalone,'.next','static'),{recursive:true});
if(existsSync(join(root,'public')))cpSync(join(root,'public'),join(standalone,'public'),{recursive:true});
const child=spawn(process.execPath,[join(standalone,'server.js')],{stdio:'inherit',env:{...process.env,HOSTNAME:process.env.HOSTNAME||'127.0.0.1',PORT:port,DATA_DIR:resolve(root,process.env.DATA_DIR||'data'),NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code||0));
