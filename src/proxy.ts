import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';

export function proxy(request:NextRequest){
  const nonce=randomBytes(16).toString('base64');
  const development=process.env.NODE_ENV==='development';
  const csp=[
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,
    // 主题色、头像位置和滚动效果需要 React 行内样式；脚本仍需 nonce。
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${development?' ws: wss:':''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.APP_URL?.startsWith('https://')?['upgrade-insecure-requests']:[]),
  ].join('; ');
  const headers=new Headers(request.headers);
  headers.set('x-nonce',nonce);
  headers.set('Content-Security-Policy',csp);
  const response=NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  response.headers.set('Cache-Control','private, no-store');
  return response;
}

// 当前站点只有 / 一个 HTML 路由，所有栏目通过 query 切换。
// API 附件保持自己更严格的 sandbox 策略，静态资源无需 nonce。
export const config={matcher:['/']};
