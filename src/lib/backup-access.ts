// Requests normally run concurrently. A backup drains pending operations first,
// then holds new requests until its database and attachment snapshot is complete.
class BackupAccess {
  private active=0;
  private exclusive=false;
  private queue:{exclusive:boolean;start:()=>void}[]=[];

  run<T>(exclusive:boolean,action:()=>Promise<T>):Promise<T>{
    return new Promise<T>((resolve,reject)=>{
      this.queue.push({exclusive,start:()=>{
        this.active++;this.exclusive=exclusive;
        void Promise.resolve().then(action).then(resolve,reject).finally(()=>{
          this.active--;if(exclusive)this.exclusive=false;this.drain();
        });
      }});
      this.drain();
    });
  }
  private drain(){
    if(this.exclusive)return;
    while(this.queue.length){
      if(this.queue[0].exclusive){
        if(this.active)return;
        this.queue.shift()!.start();return;
      }
      this.queue.shift()!.start();
    }
  }
}

const accessByStore=new WeakMap<object,BackupAccess>();
export function withBackupAccess<T>(store:object,exclusive:boolean,action:()=>Promise<T>):Promise<T>{
  let access=accessByStore.get(store);
  if(!access){access=new BackupAccess();accessByStore.set(store,access);}
  return access.run(exclusive,action);
}
