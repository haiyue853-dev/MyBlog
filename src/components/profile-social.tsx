'use client';
import {Mail} from 'lucide-react';
import {SITE_CONTACT} from '@/lib/types';

function GithubMark(){
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>;
}

function QQMark(){
  return <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.3C8.6 2.3 6.3 4.8 6.3 8.5c0 .7.1 1.3.2 1.9-2 1.9-3.7 5.5-3 6.4.5.6 1.4-.2 2.1-1 .1 1.4.6 2.5 1.4 3.4-1.6.3-2.5 1.3-1.9 2 .9 1 4.2 1 6.9.1 2.7.9 6 .9 6.9-.1.6-.7-.3-1.7-1.9-2 .8-.9 1.3-2 1.4-3.4.7.8 1.6 1.6 2.1 1 .7-.9-1-4.5-3-6.4.1-.6.2-1.2.2-1.9 0-3.7-2.3-6.2-5.7-6.2Z"/></svg>;
}

export function ProfileSocial(){
  return <nav className="profile-social" aria-label="我的联系方式">
      <a className="profile-social-link" href={SITE_CONTACT.github} target="_blank" rel="noopener noreferrer" aria-label="我的 GitHub"><GithubMark/><span className="social-tooltip" aria-hidden="true">GitHub</span></a>
      <a className="profile-social-link" href={SITE_CONTACT.qqUrl} target="_blank" rel="noopener noreferrer" aria-label="我的 QQ"><QQMark/><span className="social-tooltip" aria-hidden="true">QQ · {SITE_CONTACT.qq}</span></a>
      <a className="profile-social-link" href={`mailto:${SITE_CONTACT.email}`} aria-label={`QQ 邮箱：${SITE_CONTACT.email}`}><Mail size={18}/><span className="social-tooltip" aria-hidden="true">{SITE_CONTACT.email}</span></a>
    </nav>;
}
