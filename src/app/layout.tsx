import type {Metadata} from 'next';
import './globals.css';
import './about-statistics.css';
import './editing-materials.css';
export const metadata:Metadata={title:"Hai's Little World · 我的个人小屋",description:'收好喜欢的音乐、平凡的日常，还有值得留下的小事。',robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
