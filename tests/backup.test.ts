import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../src/lib/store';
import {hashPassword,verifyPassword} from '../src/lib/security';

test('default backup creates its parent and restores records, owner and attachments without overwriting',()=>{
  const root=mkdtempSync(join(tmpdir(),'little-world-backup-'));const source=join(root,'source');
  const args=[resolve('node_modules/tsx/dist/cli.mjs'),resolve('scripts/backup.ts')];
  try{
    const store=new Store(source);store.setOwner('站主',hashPassword('backup-test-password'));
    const asset=store.addAsset({name:'note.md',mime:'application/octet-stream',size:7,category:'文档'});
    writeFileSync(join(source,'files',asset.id),'private');
    store.saveItem({kind:'moment',title:'restored note',body:'private memory',visibility:'private',tags:[],category:'生活',url:'',assetId:null});
    store.close();
    execFileSync(process.execPath,args,{cwd:root,env:{...process.env,DATA_DIR:source},stdio:'pipe'});
    const destination=join(root,'backups',readdirSync(join(root,'backups'))[0]);
    const restored=new Store(destination);
    try{
      assert.equal(restored.listItems(true)[0].body,'private memory');assert.equal(restored.listItems(false).length,0);
      assert.ok(verifyPassword('backup-test-password',restored.getOwner()!.password));
      assert.equal(readFileSync(join(destination,'files',asset.id),'utf8'),'private');
    }finally{restored.close();}
    assert.throws(()=>execFileSync(process.execPath,[...args,destination],{cwd:root,env:{...process.env,DATA_DIR:source},stdio:'pipe'}));
    assert.equal(readFileSync(join(destination,'files',asset.id),'utf8'),'private');
  }finally{rmSync(root,{recursive:true,force:true});}
});
