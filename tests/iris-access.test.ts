import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HouseTools} from '../src/components/house-tools';
import {Space} from '../src/components/space';
import {DEFAULT_PROFILE} from '../src/lib/types';

test('visitors cannot see the Iris tool or open its assistant through a direct view',()=>{
  const menu=renderToStaticMarkup(createElement(HouseTools,{view:'home',owner:false,onNavigate:()=>{}}));
  assert.doesNotMatch(menu,/>Iris</);
  for(const initialOwner of [false,true]){
    const html=renderToStaticMarkup(createElement(Space,{initialItems:[],initialProfile:DEFAULT_PROFILE,initialOwner,configured:true,initialView:'iris'}));
    if(initialOwner)assert.match(html,/aria-label="给 Iris 的问题"/);
    else {assert.doesNotMatch(html,/Iris/);assert.doesNotMatch(html,/chat-panel/);}
  }
});

test('the signed-in owner retains the Iris tool',()=>{
  const menu=renderToStaticMarkup(createElement(HouseTools,{view:'iris',owner:true,onNavigate:()=>{}}));
  assert.match(menu,/aria-current="page"[^>]*>[\s\S]*?<span>Iris<\/span>/);
});
