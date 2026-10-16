interface MarkdownNode{type:string;value?:string;children?:MarkdownNode[];position?:{start:{line:number;offset?:number};end:{offset?:number}}}
// The editor uses leading spaces for paragraph indentation. Explicit fenced code stays code.
export function remarkParagraphIndent(this:{parse:(source:string)=>MarkdownNode}){
  const parser=this;
  return (tree:MarkdownNode,file:{value:unknown})=>{
    const source=String(file.value);const starts=[0];for(let index=0;index<source.length;index++)if(source[index]==='\n')starts.push(index+1);
    const spaces=(value:string)=>value.replace(/ /g,'\u00a0').replace(/\t/g,'\u00a0\u00a0\u00a0\u00a0');
    function leading(line:number){return source.slice(starts[line-1]).match(/^[ \t]+/)?.[0]||'';}
    function restore(node:MarkdownNode){
      if(!node.children)return;
      node.children=node.children.flatMap(child=>{
        const start=child.position?.start;const prefix=start?leading(start.line):'';
        const before=start?.offset===undefined?'x':source.slice(starts[start.line-1],start.offset);
        const atLineStart=!!prefix&&/^[ \t]*$/.test(before);
        if(child.type==='text'&&child.value!==undefined&&start){
          child.value=child.value.split('\n').map((line,index)=>{
            const indent=index>0?leading(start.line+index):atLineStart?prefix:'';
            return indent&&line?spaces(indent)+line.replace(/^[ \t]+/,''):line;
          }).join('\n');
          return [child];
        }
        if(child.type!=='inlineCode')restore(child);
        return atLineStart?[{type:'text',value:spaces(prefix)},child]:[child];
      });
    }
    if(!tree.children)return;
    const children:MarkdownNode[]=[];let previous:MarkdownNode|undefined;
    for(const node of tree.children){
      let converted=[node];
      if(node.type==='paragraph')restore(node);
      else if(node.type==='code'&&node.position){
        const raw=source.slice(starts[node.position.start.line-1],node.position.end.offset);
        if(/^(?: {4}|\t)/.test(raw)){
          const prose=raw.replace(/^[ \t]+/gm,spaces);
          converted=parser.parse(prose).children||[node];
        }
      }
      const last=children.at(-1);const first=converted[0];
      const end=previous?.position?.end.offset;const start=node.position?.start.offset;
      // Indented prose can be parsed as code followed by a paragraph even without a blank line.
      if(last?.type==='paragraph'&&first?.type==='paragraph'&&end!==undefined&&start!==undefined&&/^\r?\n[ \t]*$/.test(source.slice(end,start))){
        last.children=[...(last.children||[]),{type:'text',value:'\n'},...(first.children||[])];
        converted=converted.slice(1);
      }
      children.push(...converted);previous=node;
    }
    tree.children=children;
  };
}
