'use client';
import {useEffect,useRef,useState} from 'react';
import {Archive,Download,LoaderCircle,RefreshCw,ShieldCheck} from 'lucide-react';
import {api,ClientError,errorMessage,fileSize} from '@/lib/client';
import type {BackupInfo} from '@/lib/backup-types';

function backupTime(value:string){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));}

export function BackupCenter(){
  const [backups,setBackups]=useState<BackupInfo[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [supported,setSupported]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const running=useRef(false);

  useEffect(()=>{
    let active=true;
    void api<{backups:BackupInfo[]}>('backups').then(result=>{if(active)setBackups(result.backups);}).catch(error=>{
      if(!active)return;
      if(error instanceof ClientError&&error.status===404)setSupported(false);
      else setError(errorMessage(error));
    }).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  async function refresh(){
    if(running.current||loading)return;
    running.current=true;setRefreshing(true);setError('');
    try{const result=await api<{backups:BackupInfo[]}>('backups');setBackups(result.backups);}
    catch(error){setError(errorMessage(error));}
    finally{running.current=false;setRefreshing(false);}
  }
  async function generate(){
    if(running.current||loading)return;
    running.current=true;setBusy(true);setError('');setNotice('');
    try{
      const result=await api<{backup:BackupInfo}>('backups',{method:'POST'});
      setBackups(current=>[result.backup,...current.filter(value=>value.id!==result.backup.id)]);
      setNotice('完整备份已生成，可以下载到电脑保存。');
    }catch(error){setError(errorMessage(error));}
    finally{running.current=false;setBusy(false);}
  }
  if(!supported)return null;
  return <section className="paper backup-center" aria-labelledby="backup-center-title" aria-busy={loading||refreshing||busy}>
    <div className="backup-center-heading"><div><span className="eyebrow">keep my little world safe</span><h3 id="backup-center-title"><Archive size={20}/>备份中心</h3><p className="muted">把小屋的照片、视频、记录和设置一起收好。</p></div><ShieldCheck className="accent-text" size={24}/></div>
    <div className="backup-center-summary"><span>最近备份</span><strong>{loading?'正在读取…':backups[0]?backupTime(backups[0].createdAt):'还没有生成备份'}</strong><p>包含收藏、日记、视频作品、人物分组、标签、照片、私人文件、设置和账号。</p></div>
    <p className="backup-center-privacy">备份包含私密资料与账号信息，请自己保管。服务器上的备份建议再下载一份到电脑。</p>
    <div className="backup-center-actions"><button type="button" className="button primary" disabled={loading||refreshing||busy} onClick={()=>void generate()}>{busy?<LoaderCircle size={16} className="spin"/>:<Archive size={16}/>} {busy?'正在生成备份…':'生成完整备份'}</button><button type="button" className="button secondary" disabled={loading||refreshing||busy} aria-label={refreshing?'正在刷新记录':'刷新记录'} onClick={()=>void refresh()}><RefreshCw size={14} className={refreshing?'spin':undefined}/>刷新记录</button></div>
    {busy&&<p className="backup-center-status" role="status">正在整理数据和附件。生成期间，保存与上传会稍等片刻；完成后即可下载。</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {notice&&<p className="success" role="status">{notice}</p>}
    {backups.length>0&&<div className="backup-center-history"><h4>已生成的备份</h4><ol>{backups.map(backup=><li key={backup.id}><div><time dateTime={backup.createdAt}>{backupTime(backup.createdAt)}</time><p>{backup.collectionCount} 份收藏 · {backup.momentCount} 篇日记 · {backup.videoCount!==undefined&&<>{backup.videoCount} 份视频 · </>}{backup.assetCount} 个附件 · {fileSize(backup.size)}</p></div><a className="button secondary" href={`/api/backups/${backup.id}`} download aria-label={`下载备份 ${backupTime(backup.createdAt)}`}><Download size={15}/>下载</a></li>)}</ol></div>}
    <p className="backup-center-restore">下载格式为 .tar.gz，压缩包内附 RESTORE.md 恢复说明，可用于恢复小屋或迁移到阿里云。</p>
  </section>;
}
