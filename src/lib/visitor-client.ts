import {api} from './client';

let initializing:Promise<void>|undefined;
// Likes and statistics share the same first identity request so concurrent responses
// cannot assign two different HttpOnly cookies to a new browser.
export function ensureVisitor(){
  return initializing??=(api('likes?ids=').then(()=>{},error=>{initializing=undefined;throw error;}));
}
