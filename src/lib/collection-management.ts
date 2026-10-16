import {errorMessage} from './client';
import type {Item,Visibility} from './types';
export type CollectionAction={type:'category';value:string}|{type:'visibility';value:Visibility}|{type:'tags';value:string[]}|{type:'delete'};

export async function manageCollections(items:Item[],action:CollectionAction,operations:{
  save:(item:Item)=>Promise<unknown>;remove:(id:string)=>Promise<unknown>;onProgress:(done:number,total:number)=>void;
}){
  const completed:string[]=[];const failed:{id:string;message:string}[]=[];
  for(const [index,item] of items.entries()){
    try{
      if(action.type==='delete')await operations.remove(item.id);
      else await operations.save({...item,[action.type==='category'?'category':action.type==='tags'?'tags':'visibility']:action.value});
      completed.push(item.id);
    }catch(error){failed.push({id:item.id,message:errorMessage(error)});}
    operations.onProgress(index+1,items.length);
  }
  return {completed,failed};
}
