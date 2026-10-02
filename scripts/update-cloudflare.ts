import {readFile,copyFile,cp,mkdtemp,rm,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildCloudflare,projectRoot} from './build-cloudflare';

export async function prepareCloudflareUpdate(directory:string){
  directory=await realpath(resolve(directory));
  const config=JSON.parse(await readFile(join(directory,'wrangler.jsonc'),'utf8'));
  const state=JSON.parse(await readFile(join(directory,'.cloudflare-state.json'),'utf8'));
  const database=config.d1_databases?.find((binding:{binding:string})=>binding.binding==='DB');
  if(!config.account_id||state.accountId!==config.account_id||!state.initialized||!config.name||
    !database?.database_id||database.database_id==='00000000-0000-0000-0000-000000000000'||
    !config.r2_buckets?.some((binding:{binding:string;bucket_name:string})=>binding.binding==='FILES'&&binding.bucket_name)){
    throw new Error('请选择已经部署的完整小屋目录，保留其真实账号、数据库和存储配置。');
  }
  if(config.main!=='worker.js'||config.assets?.directory!=='./public')throw new Error('部署包代码目录配置不符合预期。');
  const publicPath=await realpath(join(directory,'public'));
  if(!publicPath.startsWith(directory+sep))throw new Error('网页资源目录必须位于部署包之内。');
  const temporaryRoot=await realpath(tmpdir());
  const staging=await mkdtemp(join(temporaryRoot,'little-world-update-'));
  try{
    const compiled=join(staging,'compiled');await buildCloudflare(compiled);
    await cp(join(compiled,'public'),publicPath,{recursive:true});
    await copyFile(join(compiled,'worker.js'),join(directory,'worker.js'));
    await copyFile(join(compiled,'schema.sql'),join(directory,'schema.sql'));
    return {directory,name:config.name,accountId:config.account_id};
  }finally{
    if(!resolve(staging).startsWith(temporaryRoot+sep))throw new Error('临时目录不在预期位置，已停止清理。');
    await rm(staging,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);const publish=args.includes('--deploy');
  const directory=args.find(value=>!value.startsWith('--'))||join(projectRoot,'outputs/MyBlog-Cloudflare-Full-20261002');
  const result=await prepareCloudflareUpdate(directory);
  console.log(`代码已更新到：${result.directory}\n应用：${result.name}；沿用已有账号、D1 与 R2。`);
  if(publish){
    const cli=join(projectRoot,'node_modules/wrangler/bin/wrangler.js');
    const configPath=join(result.directory,'wrangler.jsonc');
    const options={cwd:projectRoot,stdio:'inherit' as const,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:result.accountId,WRANGLER_SEND_METRICS:'false'}};
    // Add missing tables/triggers before new code uses them; never replay private-import/data.sql.
    execFileSync(process.execPath,[cli,'d1','execute','DB','--remote','--yes','--file',join(result.directory,'schema.sql'),'--config',configPath],options);
    execFileSync(process.execPath,[cli,'deploy','--config',configPath],options);
  }else console.log('本次只准备代码，没有上传。确认本地效果后，运行 npm run update:cloudflare -- --deploy 发布。');
}
