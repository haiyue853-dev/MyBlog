'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{dialog?.close();};},[]);return <dialog className={`modal ${wide?'modal-wide':''}`} ref={ref} onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget)onClose();}}><div className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19}/></button></div>{children}</dialog>;}
