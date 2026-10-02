import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
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
    const salt=randomBytes(16).toString('hex');
    const legacy=`scrypt:${salt}:${scryptSync('deployment-test-password',salt,64).toString('hex')}`;
    const legacyStore=new Store(directory);legacyStore.setOwner('测试',legacy);legacyStore.close();
    assert.equal(check('https://home.example').status,0,'旧格式站主密码仍可部署');
    for(const invalid of ['not-a-hash','scrypt$32768$8$1$bad$bad','scrypt:bad:bad']){
      const invalidStore=new Store(directory);invalidStore.setOwner('测试',invalid);invalidStore.close();
      assert.notEqual(check('https://home.example').status,0,'损坏的密码格式不能部署');
    }
  }finally{rmSync(directory,{recursive:true,force:true});}
});
