export type SpaceView='videos'|'travel'|'trash'|'article'|'content'|'timeline'|'posts'|'home'|'life'|'collection'|'about'|'stats'|'files'|'iris'|'settings';
export type ArticleFilters={category:string;tag:string;series:string};
const views:SpaceView[]=['trash','content','timeline','posts','home','life','collection','about','stats','files','iris','settings'];
export function readSpaceRoute(url:URL){
  const filters={category:url.searchParams.get('category')||'',tag:url.searchParams.get('tag')||'',series:url.searchParams.get('series')||''};
  if(url.pathname==='/posts')return {view:'posts' as SpaceView,articleId:'',filters};
  if(url.pathname==='/timeline')return {view:'timeline' as SpaceView,articleId:'',filters};
  const article=url.pathname.match(/^\/posts\/([^/]+)$/);
  if(article)return {view:'article' as SpaceView,articleId:article[1],filters};
  if(url.pathname!=='/')return null;
  const requested=url.searchParams.get('view') as SpaceView;
  return {view:views.includes(requested)?requested:'home' as SpaceView,articleId:'',filters};
}
