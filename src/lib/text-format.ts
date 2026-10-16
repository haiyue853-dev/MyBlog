export type HeadingLevel=0|1|2|3;
export type InlineStyle='bold'|'italic';
export type BlockStyle='bullet'|'number'|'quote';
export interface TextEdit {text:string;start:number;end:number}

function stars(value:string,side:'start'|'end'){return (value.match(side==='start'?/^\*+/:/\*+$/)?.[0].length)||0;}
function hasStyle(left:number,right:number,style:InlineStyle){return style==='bold'?left>=2&&right>=2:left%2===1&&right%2===1;}

export function formatInline(text:string,start:number,end:number,style:InlineStyle):TextEdit{
  const marker=style==='bold'?'**':'*';
  const selected=text.slice(start,end);
  const paragraphs=selected.split(/(\r?\n(?:[\t ]*\r?\n)+)/);
  if(paragraphs.length>1){
    const alreadyStyled=paragraphs.filter((part,index)=>index%2===0&&part.trim()).every(part=>hasStyle(stars(part.trim(),'start'),stars(part.trim(),'end'),style));
    const changed=paragraphs.map((part,index)=>{
      if(index%2===1||!part.trim())return part;
      if(!alreadyStyled&&hasStyle(stars(part.trim(),'start'),stars(part.trim(),'end'),style))return part;
      return formatInline(part,0,part.length,style).text;
    }).join('');
    return {text:text.slice(0,start)+changed+text.slice(end),start,end:start+changed.length};
  }
  if(selected&&!selected.trim())return {text,start,end};
  const leading=selected.match(/^\s*/)?.[0].length||0;
  const trailing=selected.match(/\s*$/)?.[0].length||0;
  if(leading||trailing)return formatInline(text,start+leading,end-trailing,style);
  const before=text.slice(0,start);const after=text.slice(end);
  if(selected&&hasStyle(stars(selected,'start'),stars(selected,'end'),style)&&selected.length>marker.length*2){
    const plain=selected.slice(marker.length,-marker.length);
    return {text:before+plain+after,start,end:start+plain.length};
  }
  if(selected&&hasStyle(stars(before,'end'),stars(after,'start'),style)){
    return {text:before.slice(0,-marker.length)+selected+after.slice(marker.length),start:start-marker.length,end:end-marker.length};
  }
  const content=selected||(style==='bold'?'加粗文字':'斜体文字');
  return {text:before+marker+content+marker+after,start:start+marker.length,end:start+marker.length+content.length};
}

const HEADING=/^ {0,3}#{1,6}(?:[\t ]+|$)/;
function lineStart(text:string,offset:number){return offset===0?0:text.lastIndexOf('\n',offset-1)+1;}
export function headingLevel(text:string,offset:number):HeadingLevel{
  const marker=text.slice(lineStart(text,offset)).match(HEADING)?.[0].trim();
  const level=marker?.length||0;return level>=1&&level<=3?level as HeadingLevel:0;
}

export function formatHeading(text:string,start:number,end:number,level:HeadingLevel):TextEdit{
  const first=lineStart(text,start);
  const next=text.indexOf('\n',end>start?end-1:start);
  const last=next===-1?text.length:next;
  const lines=text.slice(first,last).split('\n');
  const prefix=level?'#'.repeat(level)+' ':'';
  const prefixes=lines.map(line=>line.match(HEADING)?.[0].length||0);
  const changed=lines.map((line,index)=>prefix+line.slice(prefixes[index]));
  const replacement=changed.join('\n');
  function move(offset:number){
    if(offset>last)return first+replacement.length+(offset-last);
    let previous=first;let updated=first;
    for(let index=0;index<lines.length;index++){
      if(offset<=previous+lines[index].length)return updated+prefix.length+Math.max(0,offset-previous-prefixes[index]);
      previous+=lines[index].length+1;updated+=changed[index].length+1;
    }
    return first+replacement.length;
  }
  return {text:text.slice(0,first)+replacement+text.slice(last),start:move(start),end:move(end)};
}

export function formatCodeBlock(text:string,start:number,end:number,code:string,language:string):TextEdit{
  const longest=Math.max(0,...Array.from(code.matchAll(/`+/g),match=>match[0].length));
  const fence='`'.repeat(Math.max(3,longest+1));const lang=/^[\w+-]*$/.test(language)?language:'';
  const before=text.slice(0,start);const after=text.slice(end);
  const prefix=before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'';
  const suffix=after&&!after.startsWith('\n\n')?(after.startsWith('\n')?'\n':'\n\n'):'';
  const block=`${prefix}${fence}${lang}\n${code}${code.endsWith('\n')?'':'\n'}${fence}${suffix}`;
  const cursor=before.length+block.length;
  return {text:before+block+after,start:cursor,end:cursor};
}

const BLOCK=/^ {0,3}(?:[-+*][\t ]+|\d+[.)][\t ]+|>[\t ]?|#{1,6}[\t ]+)/;
const BLOCK_STYLES={bullet:/^ {0,3}[-+*][\t ]+/,number:/^ {0,3}\d+[.)][\t ]+/,quote:/^ {0,3}>[\t ]?/};

export function formatBlock(text:string,start:number,end:number,style:BlockStyle):TextEdit{
  const first=lineStart(text,start);
  const next=text.indexOf('\n',end>start?end-1:start);
  const last=next===-1?text.length:next;
  const lines=text.slice(first,last).split('\n');
  const populated=lines.filter(line=>line.trim());
  const remove=populated.length>0&&populated.every(line=>BLOCK_STYLES[style].test(line));
  let number=0;
  const removed=lines.map(line=>line.match(BLOCK)?.[0].length||0);
  const prefixes=lines.map(line=>{
    if(remove||(!line.trim()&&lines.length>1))return '';
    number++;
    return style==='bullet'?'- ':style==='quote'?'> ':`${number}. `;
  });
  const changed=lines.map((line,index)=>prefixes[index]+line.slice(removed[index]));
  const replacement=changed.join('\n');
  function move(offset:number){
    if(offset>last)return first+replacement.length+(offset-last);
    let previous=first;let updated=first;
    for(let index=0;index<lines.length;index++){
      if(offset<=previous+lines[index].length)return updated+prefixes[index].length+Math.max(0,offset-previous-removed[index]);
      previous+=lines[index].length+1;updated+=changed[index].length+1;
    }
    return first+replacement.length;
  }
  return {text:text.slice(0,first)+replacement+text.slice(last),start:move(start),end:move(end)};
}

function insideCodeBlock(text:string,offset:number){
  let fence='';
  for(const line of text.slice(0,lineStart(text,offset)).split('\n')){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})/);
    if(!marker)continue;
    if(!fence)fence=marker[1];
    else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&line.slice(marker[0].length).trim()==='')fence='';
  }
  return !!fence;
}
export function insertTextIndent(text:string,start:number,end:number):TextEdit{
  const indent=insideCodeBlock(text,start)?'  ':'　　';
  return {text:text.slice(0,start)+indent+text.slice(start),start:start+indent.length,end:end+indent.length};
}
export function continueBlock(text:string,start:number,end:number):TextEdit|null{
  if(start!==end||insideCodeBlock(text,start))return null;
  const first=lineStart(text,start);
  const line=text.slice(first,start);
  const marker=line.match(/^([\t ]*)(?:([-+*])[\t ]+|(\d+)([.)])[\t ]+|(>)[\t ]?)/);
  if(!marker)return null;
  const next=text.indexOf('\n',start);
  const lineEnd=next===-1?text.length:next;
  if(!text.slice(first+marker[0].length,lineEnd).trim()){
    const cursor=first+1;
    return {text:text.slice(0,first)+'\n'+text.slice(lineEnd),start:cursor,end:cursor};
  }
  const prefix=marker[1]+(marker[2]?`${marker[2]} `:marker[3]?`${Number(marker[3])+1}${marker[4]} `:'> ');
  const cursor=start+1+prefix.length;
  return {text:text.slice(0,start)+'\n'+prefix+text.slice(end),start:cursor,end:cursor};
}
