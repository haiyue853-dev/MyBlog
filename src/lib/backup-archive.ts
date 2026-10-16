import {createReadStream,createWriteStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGzip} from 'node:zlib';

function tarHeader(name:string,size:number,mtime:number){
  if(!/^[a-zA-Z0-9./_-]+$/.test(name)||name.length>100||name.startsWith('/')||name.split('/').includes('..'))throw new Error('Invalid backup archive entry');
  const header=Buffer.alloc(512);
  header.write(name,0,100,'ascii');
  const octal=(value:number,offset:number,length:number)=>{
    const text=value.toString(8);
    if(text.length>=length)throw new Error('Backup entry is too large');
    header.write(text.padStart(length-1,'0')+'\0',offset,length,'ascii');
  };
  octal(0o600,100,8);octal(0,108,8);octal(0,116,8);octal(size,124,12);octal(mtime,136,12);
  header.fill(32,148,156);header.write('0',156,1,'ascii');
  header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');
  const checksum=header.reduce((sum,byte)=>sum+byte,0);
  header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  return header;
}

export async function writeBackupArchive(directory:string,entries:string[],destination:string){
  async function* contents(){
    for(const name of entries){
      const path=join(directory,name);const info=await stat(path);
      if(!info.isFile())throw new Error('Backup entry must be a file');
      yield tarHeader(name,info.size,Math.floor(info.mtimeMs/1000));
      for await(const chunk of createReadStream(path))yield chunk;
      const padding=(512-info.size%512)%512;
      if(padding)yield Buffer.alloc(padding);
    }
    yield Buffer.alloc(1024);
  }
  await pipeline(Readable.from(contents()),createGzip({level:1}),createWriteStream(destination,{flags:'wx',mode:0o600}));
}
