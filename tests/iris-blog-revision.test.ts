import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialEditorDraft} from '../src/lib/editor-draft';
import {newArticle} from '../src/lib/articles';
import {revisionSource,protectRevisionPhotos,restoreRevisionPhotos,applyIrisBlogRevision,readRevisionSource} from '../src/lib/iris-blog-revision';
const id='00000000-0000-0000-0000-000000000001';
const draft={...initialEditorDraft('moment'),title:'我手动改过的标题',body:`开头\n\n![说明](/api/files/${id}?inline=1 "article-25")\n\n结尾\n\n![同图][photo]\n\n[photo]: /api/files/${id}?inline=1 "article-wide"`,category:'生活',tags:'散步，日常',photos:[{assetId:id,width:324,height:258}],assetId:id,articleMode:true,article:{...newArticle(),summary:'手动摘要',kicker:'保留引导',coverCrop:{x:50,y:50,zoom:1}},visibility:'private' as const,pinned:true};
test('revision protects repeated photos and reference definitions without losing sizes or captions',()=>{
 const source=revisionSource(draft);const protectedPhotos=protectRevisionPhotos(source);
 assert.doesNotMatch(protectedPhotos.body,/\/api\/files\//);assert.equal(protectedPhotos.photos.length,3);
 assert.equal(restoreRevisionPhotos(protectedPhotos.body,protectedPhotos),draft.body);
 assert.throws(()=>restoreRevisionPhotos(protectedPhotos.body.replace(protectedPhotos.photos[0].token,''),protectedPhotos));
 assert.throws(()=>restoreRevisionPhotos(protectedPhotos.body+protectedPhotos.photos[0].token,protectedPhotos));
 assert.throws(()=>restoreRevisionPhotos(protectedPhotos.body.replace(protectedPhotos.photos[0].token,'{IRIS_IMAGE_99}'),protectedPhotos));
 const swapped=protectedPhotos.body.replace(protectedPhotos.photos[0].token,'SWAP').replace(protectedPhotos.photos[1].token,protectedPhotos.photos[0].token).replace('SWAP',protectedPhotos.photos[1].token);assert.throws(()=>restoreRevisionPhotos(swapped,protectedPhotos));
 for(const wrap of [(token:string)=>'`'+token+'`',(token:string)=>'```\n'+token+'\n```',(token:string)=>'\\'+token])assert.throws(()=>restoreRevisionPhotos(protectedPhotos.body.replace(protectedPhotos.photos[0].token,wrap(protectedPhotos.photos[0].token)),protectedPhotos));
});
test('only text and summary change; photo, cover, visibility and writing settings remain',()=>{
 const revision={title:'新标题',body:draft.body.replace('开头','新的开头'),category:'日常',tags:['轻松'],summary:'新摘要'};
 const next=applyIrisBlogRevision(draft,revision);assert.equal(next.title,'新标题');assert.equal(next.tags,'轻松');assert.equal(next.article?.summary,'新摘要');
 assert.deepEqual({...next,title:draft.title,body:draft.body,category:draft.category,tags:draft.tags,article:{...next.article,summary:draft.article.summary}},draft);
 const moment={...draft,articleMode:false};assert.equal(revisionSource(moment).type,'moment');assert.equal(applyIrisBlogRevision(moment,revision).article?.summary,draft.article.summary);
});
test('source validation bounds current content and rejects malformed photo or metadata before model work',()=>{
 const source=revisionSource(draft);assert.deepEqual(readRevisionSource(source),source);
 for(const bad of [{...source,body:''},{...source,body:'x'.repeat(50001)},{...source,title:'x'.repeat(161)},{...source,images:['bad']},{...source,images:Array(13).fill(id)},{...source,tags:['x'.repeat(31)]},{...source,summary:'x'.repeat(301)},{...source,type:'bad'}])assert.throws(()=>readRevisionSource(bad));
 assert.throws(()=>protectRevisionPhotos({...source,body:'手写保留字 {IRIS_IMAGE_1}'}));
});
