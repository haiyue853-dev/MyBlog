import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';

const directory=dirname(fileURLToPath(import.meta.url));
export function parseJsonOutput(output){const text=output.trim();for(let i=0;i<text.length;i++){if(text[i]!=='{'&&text[i]!=='[')continue;try{return JSON.parse(text.slice(i));}catch{}}throw new Error('Cloudflare 返回了无法识别的结果，请保留窗口里的错误提示。');}
export function redact(output){return output.replace(/[a-f0-9]{64,}/gi,'[已隐藏敏感值]');}
export async function deploy(){
  if(Number(process.versions.node.split('.')[0])<22)throw new Error('请安装 Node.js 22.16 或更新版本（安装器包含 npm）。');
  const npmCandidates=[join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),'/usr/share/nodejs/npm/bin/npm-cli.js','/usr/local/lib/node_modules/npm/bin/npm-cli.js'];
  const npmCli=npmCandidates.find(path=>existsSync(path));if(!npmCli)throw new Error('未找到 npm，请重新安装包含 npm 的 Node.js。');
  const configPath=join(directory,'wrangler.jsonc');const statePath=join(directory,'.cloudflare-state.json');
  const config=JSON.parse(readFileSync(configPath,'utf8'));
  if(config.assets?.directory!=='./public'||realpathSync(resolve(directory,config.assets.directory))!==realpathSync(join(directory,'public')))throw new Error('静态资源目录配置异常，已停止部署以保护私人资料。');
  let state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{};
  const persist=()=>{writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');};
  const run=(args,{interactive=false,optional=false}={})=>{
    const child=spawnSync(process.execPath,[npmCli,'exec','--yes','--package=wrangler@4.146.0','--','wrangler',...args],
      {cwd:directory,env:{...process.env,WRANGLER_SEND_METRICS:'false',...(state.accountId?{CLOUDFLARE_ACCOUNT_ID:state.accountId}:{}),...(interactive?{}:{CI:'1'})},encoding:'utf8',stdio:interactive?'inherit':'pipe',maxBuffer:10*1024*1024});
    if(child.error)throw child.error;
    if(child.status!==0){if(optional)return null;throw new Error(redact((child.stderr||child.stdout||'Cloudflare 操作失败').trim()));}
    return child.stdout||'';
  };
  console.log('准备部署完整小屋：免费 Workers 档 + D1 + 私有 R2。不会升级 Workers 套餐。\nR2 需要已开通，超出账号免费额度会计费；说明见“部署说明.md”。');
  let identity=run(['whoami','--json'],{optional:true});
  if(!identity){console.log('请在打开的浏览器中登录并授权 Cloudflare。');run(['login'],{interactive:true});identity=run(['whoami','--json']);}
  const accounts=parseJsonOutput(identity).accounts||[];
  if(!accounts.length)throw new Error('没有找到可部署的 Cloudflare 账号。');
  let account=accounts.find(item=>item.id===(state.accountId||config.account_id));
  if((state.accountId||config.account_id)&&!account)throw new Error('当前登录账号与上次部署不同，请切回原账号再运行。');
  if(!account&&accounts.length===1)account=accounts[0];
  if(!account){console.log(accounts.map((item,index)=>`${index+1}. ${item.name}`).join('\n'));const input=createInterface({input:process.stdin,output:process.stdout});try{const value=await input.question('选择部署账号编号：');account=accounts[Number(value)-1];}finally{input.close();}if(!account)throw new Error('账号编号无效。');}
  state.accountId=account.id;config.account_id=account.id;persist();
  const database=config.d1_databases[0];const bucket=config.r2_buckets[0];
  if(database.database_id==='00000000-0000-0000-0000-000000000000'){
    console.log('创建 D1 数据库…');
    const databases=parseJsonOutput(run(['d1','list','--json']));
    const existing=databases.find(item=>item.name===database.database_name);
    if(existing)database.database_id=existing.uuid;
    else{
      const result=run(['d1','create',database.database_name,'--location','apac','--update-config=false']);
      const id=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.exec(result)?.[0];
      if(!id)throw new Error('数据库已创建但未找到编号，请将 D1 控制台编号填入 wrangler.jsonc 后重新运行。');database.database_id=id;
    }
    persist();
  }
  if(!state.bucketCreated){
    console.log('准备私有 R2 存储桶…');
    const listed=run(['r2','bucket','list']);
    if(!listed.includes(bucket.bucket_name))run(['r2','bucket','create',bucket.bucket_name,'--location','apac','--storage-class','Standard','--update-config=false']);
    state.bucketCreated=true;persist();
  }
  run(['d1','execute','DB','--remote','--file','schema.sql','--yes']);
  const owners=parseJsonOutput(run(['d1','execute','DB','--remote','--command','SELECT COUNT(*) AS n FROM owner','--json']));
  const initialized=(owners[0]?.results?.[0]?.n||0)>0;
  if(!initialized){
    const manifest=JSON.parse(readFileSync(join(directory,'private-import/manifest.json'),'utf8'));
    for(const [index,file] of manifest.files.entries()){
      if(!/^[a-f0-9-]{36}$/.test(file.id))throw new Error('迁移附件编号异常。');
      console.log(`迁移文件 ${index+1}/${manifest.files.length}…`);
      run(['r2','object','put',`${bucket.bucket_name}/${file.id}`,'--remote','--file',`private-import/files/${file.id}`,'--content-type',file.mime]);
    }
    console.log('迁移账号和内容…');run(['d1','execute','DB','--remote','--file','private-import/data.sql','--yes']);
  }else console.log('已有站主账号，保留云端数据。');
  const verified=parseJsonOutput(run(['d1','execute','DB','--remote','--command','SELECT COUNT(*) AS n FROM owner WHERE id=1','--json']));
  if(verified[0]?.results?.[0]?.n!==1)throw new Error('站主账号尚未完成初始化，已停止发布。');
  state.initialized=true;persist();console.log('发布网页和后端…');
  const published=run(['deploy']);console.log(redact(published));
  console.log('完成后请打开上面的 workers.dev 地址，用原来的密码登录，验证头像和文件上传。\n整个部署包含私人迁移资料，请保留在本机，不要公开分享。');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){deploy().catch(error=>{console.error(error.message);console.error('部署未完成。若提示 R2 未开通，请先在 Cloudflare 控制台开通 R2，再重新运行；已保存的进度会继续使用。');process.exitCode=1;});}
