interface HeadingNode {
  type:string;depth?:number;value?:string;alt?:string;children?:HeadingNode[];
  data?:{hProperties?:Record<string,unknown>;[key:string]:unknown};
}
function headingText(node:HeadingNode):string{
  if(node.type==='image'||node.type==='imageReference')return node.alt||'';
  if(node.type==='break')return ' ';
  if(node.children)return node.children.map(headingText).join('');
  return node.type==='html'?'':node.value||'';
}

// Use the same parsed Markdown tree as the displayed article, including Setext headings.
export function remarkArticleHeadings(){
  return (tree:HeadingNode)=>{
    const used=new Set<string>();
    function visit(node:HeadingNode){
      if(node.type==='heading'&&node.depth&&node.depth<=3){
        const title=headingText(node).normalize('NFKC').trim().toLowerCase();
        const slug=title.replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'')||'chapter';
        const base=`section-${slug}`;let id=base;let suffix=2;
        while(used.has(id))id=`${base}-${suffix++}`;
        used.add(id);node.data={...node.data,hProperties:{...node.data?.hProperties,id,'data-article-heading':node.depth,tabIndex:-1}};
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}
