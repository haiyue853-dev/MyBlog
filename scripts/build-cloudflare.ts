import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {LIKES_SCHEMA} from '../src/lib/likes-schema';
import {STATISTICS_SCHEMA} from '../src/lib/statistics-schema';

export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function buildCloudflare(destination:string){
  destination=resolve(destination);await mkdir(dirname(destination),{recursive:true});
  await mkdir(destination,{recursive:false});await mkdir(join(destination,'public/assets'),{recursive:true});
  await build({absWorkingDir:projectRoot,entryPoints:['cloudflare/browser.tsx'],outfile:join(destination,'public/assets/site.js'),
    bundle:true,minify:true,format:'esm',target:'es2022',jsx:'automatic',legalComments:'none',sourcemap:false,
    define:{'process.env.NODE_ENV':'"production"'}});
  await build({absWorkingDir:projectRoot,entryPoints:['cloudflare/worker.ts'],outfile:join(destination,'worker.js'),
    bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['node:*'],legalComments:'none',sourcemap:false});
  await writeFile(join(destination,'public/icon.svg'),await readFile(join(projectRoot,'src/app/icon.svg')));
  await cp(join(projectRoot,'public/editing-materials'),join(destination,'public/editing-materials'),{recursive:true});
  const policy="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";
  await writeFile(join(destination,'public/index.html'),`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${policy}"><title>我的个人小屋</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/site.css">
<script type="module" src="/assets/site.js"></script></head><body><div id="root"></div>
<noscript>请启用 JavaScript 来浏览小屋。</noscript></body></html>`);
  await writeFile(join(destination,'public/_headers'),`/*
  Content-Security-Policy: ${policy}; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: no-cache
`);
  await writeFile(join(destination,'schema.sql'),await readFile(join(projectRoot,'cloudflare/schema.sql'),'utf8')+'\n'+LIKES_SCHEMA+'\n'+STATISTICS_SCHEMA+'\n');
  const name=`little-world-${randomBytes(3).toString('hex')}`;
  const config={name,main:'worker.js',compatibility_date:'2026-10-02',compatibility_flags:['nodejs_compat'],workers_dev:true,
    assets:{directory:'./public',binding:'ASSETS',run_worker_first:['/api/*'],not_found_handling:'404-page'},
    d1_databases:[{binding:'DB',database_name:`${name}-db`,database_id:'00000000-0000-0000-0000-000000000000'}],
    r2_buckets:[{binding:'FILES',bucket_name:`${name}-files`}],observability:{enabled:false}};
  await writeFile(join(destination,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
  return {destination,config};
}
