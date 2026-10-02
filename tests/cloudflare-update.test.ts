import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareCloudflareUpdate} from '../scripts/update-cloudflare';

test('code updates preserve the deployed account, resources and private data',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'little-world-update-'));
  const config={name:'home',account_id:'a'.repeat(32),main:'worker.js',assets:{directory:'./public',binding:'ASSETS'},
    d1_databases:[{binding:'DB',database_name:'existing-db',database_id:'11111111-1111-4111-8111-111111111111'}],
    r2_buckets:[{binding:'FILES',bucket_name:'existing-files'}]};
  const configText=JSON.stringify(config,null,2)+'\n';
  const stateText=JSON.stringify({accountId:config.account_id,initialized:true,bucketCreated:true});
  try{
    mkdirSync(join(directory,'public'),{recursive:true});mkdirSync(join(directory,'private-import/files'),{recursive:true});
    writeFileSync(join(directory,'wrangler.jsonc'),configText);writeFileSync(join(directory,'.cloudflare-state.json'),stateText);
    writeFileSync(join(directory,'private-import/data.sql'),'PRIVATE_MIGRATION_MARKER');
    writeFileSync(join(directory,'private-import/files/original'),'PRIVATE_FILE_MARKER');
    writeFileSync(join(directory,'worker.js'),'obsolete-code');
    writeFileSync(join(directory,'schema.sql'),'obsolete-schema');
    const result=await prepareCloudflareUpdate(directory);
    assert.equal(result.name,'home');
    assert.equal(readFileSync(join(directory,'wrangler.jsonc'),'utf8'),configText);
    assert.equal(readFileSync(join(directory,'.cloudflare-state.json'),'utf8'),stateText);
    assert.equal(readFileSync(join(directory,'private-import/data.sql'),'utf8'),'PRIVATE_MIGRATION_MARKER');
    assert.equal(readFileSync(join(directory,'private-import/files/original'),'utf8'),'PRIVATE_FILE_MARKER');
    assert.notEqual(readFileSync(join(directory,'worker.js'),'utf8'),'obsolete-code');
    const schema=readFileSync(join(directory,'schema.sql'),'utf8');
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS item_like_visits'));
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS site_stats_events'));
    assert.ok(!schema.includes('PRIVATE_MIGRATION_MARKER'));
    assert.ok(readFileSync(join(directory,'public/assets/site.js'),'utf8').length>1000);
    assert.ok(!readFileSync(join(directory,'public/assets/site.js'),'utf8').includes('PRIVATE_MIGRATION_MARKER'));
    const materialImages=join(directory,'public/editing-materials');
    assert.ok(existsSync(materialImages),'code updates must include the migrated public material images');
    const originals=join(process.cwd(),'public/editing-materials');
    const names=readdirSync(originals);
    assert.equal(names.length,18);
    for(const name of names)assert.deepEqual(readFileSync(join(materialImages,name)),readFileSync(join(originals,name)),name);
    config.d1_databases[0].database_id='00000000-0000-0000-0000-000000000000';
    writeFileSync(join(directory,'wrangler.jsonc'),JSON.stringify(config));
    await assert.rejects(()=>prepareCloudflareUpdate(directory),/已经部署/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
