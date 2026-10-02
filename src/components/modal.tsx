'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

// 分两层是必须的，不是装饰性结构：外壳负责圆角和底色（overflow:hidden 守住四个角），
// 内层 .modal-scroll 才是滚动容器。滚动条是一条直上直下的竖条，如果让 <dialog> 自己滚，
// 它会从最顶上一直画到最底下，直接横穿弹窗的圆角。外壳留出的边距把滚动条推进一块安全矩形里。
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{dialog?.close();};},[]);return <dialog className={`modal ${wide?'modal-wide':''}`} ref={ref} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19}/></button></div><div className="modal-scroll">{children}</div></dialog>;}
