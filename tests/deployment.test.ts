import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store} from '../src/lib/store';
import {hashPassword} from '../src/lib/security';

test('public deployment refuses missing owner or insecure URL without creating a database',()=>{
  const directory=mkdtempSync(join(tmpdir(),'world-deploy-'));
  const check=(appUrl:string)=>spawnSync(process.execPath,['scripts/check-deployment.mjs'],{cwd:process.cwd(),env:{...process.env,DATA_DIR:directory,APP_URL:appUrl},encoding:'utf8'});
  try{
    const missing=check('https://home.example');assert.notEqual(missing.status,0);assert.match(missing.stderr,/站主|数据库/);
    assert.equal(existsSync(join(directory,'world.sqlite')),false);
    const store=new Store(directory);
    assert.notEqual(check('https://home.example').status,0);
    store.setOwner('测试',hashPassword('deployment-test-password'));store.close();
    for(const url of ['', 'http://home.example','https://user:password@home.example','https://home.example/path','not a url'])assert.notEqual(check(url).status,0,url);
    const ready=check('https://home.example');assert.equal(ready.status,0,ready.stderr);assert.match(ready.stdout,/部署检查通过/);
  }finally{rmSync(directory,{recursive:true,force:true});}
});
