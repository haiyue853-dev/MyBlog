import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {newArticle,parseArticleConfig} from '../src/lib/articles';
import {Store} from '../src/lib/store';
import {itemsApi} from '../src/lib/api/items';
import {withRuntime} from '../src/lib/runtime';
import {handleErrors,newToken} from '../src/lib/http';
import {initialEditorDraft,readEditorDraft,writeEditorDraft} from '../src/lib/editor-draft';
import {articleShareData} from '../src/lib/article-share-data';
import {ArticleReader} from '../src/components/article-reader';
import {Editor} from '../src/components/editor';
import {DEFAULT_PROFILE,type Item} from '../src/lib/types';

const crop={x:75,y:30,zoom:2};
test('cover crop parsing preserves legacy positions and validates finite bounded values',()=>{
  const old={...newArticle(),coverPosition:'top' as const};assert.deepEqual(parseArticleConfig(old),old);
  assert.deepEqual(parseArticleConfig({...old,coverCrop:crop})?.coverCrop,crop);
  for(const value of [null,[],{...crop,x:-1},{...crop,y:101},{...crop,zoom:.9},{...crop,zoom:3.1},{...crop,x:'75'},{...crop,y:Infinity},{...crop,zoom:NaN}])assert.equal(parseArticleConfig({...old,coverCrop:value}),null);
});
test('dragging moves the picture in the intended direction and cannot expose empty frame edges',async()=>{
  const m=await import('../src/lib/article-cover').catch(()=>null);assert.ok(m,'封面取景几何尚未实现');
  const size={imageWidth:1000,imageHeight:500,frameWidth:500,frameHeight:500};
  const moved=m.moveCoverCrop({x:50,y:50,zoom:1},125,200,size);assert.equal(moved.x,25);assert.equal(moved.y,50);
  for(const original of [{x:0,y:0,zoom:1},{x:100,y:100,zoom:3},{x:75,y:30,zoom:2}]){
    for(const delta of [-100000,0,100000]){
      const next=m.moveCoverCrop(original,delta,delta,size);const rect=m.coverImageRect(next,size);
      assert.ok(rect.left<=0&&rect.top<=0);assert.ok(rect.left+rect.width>=size.frameWidth&&rect.top+rect.height>=size.frameHeight);
    }
  }
  assert.deepEqual(m.articleCoverCrop({...newArticle(),coverPosition:'bottom'}),{x:50,y:100,zoom:1});
});
test('saved crop survives API validation, reopening the database and cached editor drafts',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'article-crop-'));const store=new Store(directory);const token=newToken();store.createSession(token,Date.now()+60000);
  try{
    const input={kind:'moment',title:'取景测试',body:'正文',tags:[],category:'旅游',visibility:'private',assetId:null,url:'',article:{...newArticle(),coverCrop:crop}};
    const call=(body:unknown,owner=true)=>withRuntime(store,{appUrl:'http://localhost:3000'},()=>handleErrors(()=>itemsApi(new Request('http://localhost:3000/api/items',{method:'POST',headers:{origin:'http://localhost:3000',cookie:owner?`world-session=${token}`:''},body:JSON.stringify(body)}),['items'])));
    assert.equal((await call(input,false)).status,401);assert.equal((await call({...input,article:{...input.article,coverCrop:{...crop,zoom:4}}})).status,400);
    const response=await call(input);assert.equal(response.status,201);const item=(await response.json()).item as Item;
    assert.deepEqual(item.article?.coverCrop,crop);const reopened=new Store(directory);try{assert.deepEqual(reopened.getItem(item.id)?.article?.coverCrop,crop);}finally{reopened.close();}
    const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
    assert.ok(writeEditorDraft(storage,'moment',item.id,initialEditorDraft('moment',item)));assert.deepEqual(readEditorDraft(storage,'moment',item.id)?.article?.coverCrop,crop);
  }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
const item:Item={id:'88499e97-e6bc-4f2e-8e51-4e53ad1739c5',kind:'moment',title:'封面取景',body:'正文',tags:[],category:'旅游',assetId:'88499e97-e6bc-4f2e-8e51-4e53ad1739c6',url:'',visibility:'public',createdAt:'2026-10-05T00:00:00Z',updatedAt:'2026-10-05T00:00:00Z',article:{...newArticle(),coverCrop:crop}};
test('the reader and share data use the saved crop while legacy images retain their placement',()=>{
  const html=renderToStaticMarkup(createElement(ArticleReader,{item,articles:[item],profile:DEFAULT_PROFILE,owner:false,embedded:true}));
  assert.match(html,/object-position:75% 30%/);assert.match(html,/transform:scale\(2\)/);assert.match(html,/transform-origin:75% 30%/);
  assert.deepEqual(articleShareData(item,DEFAULT_PROFILE,'https://example.com')?.coverCrop,crop);
});
test('the article editor exposes a crop frame and zoom control for the selected cover',()=>{
  const html=renderToStaticMarkup(createElement(Editor,{kind:'moment',item,onClose(){},onSaved(){}}));
  assert.match(html,/aria-label="封面取景框"/);assert.match(html,/aria-label="封面缩放"/);assert.match(html,/手机预览/);assert.match(html,/200%/);
});
