import { useState,useEffect,useRef } from 'react';
import { X,LoaderCircle,Search,ChevronLeft,ChevronRight,Inbox } from 'lucide-react';
export const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
export const date=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC'}).format(new Date(v)):'—';
export const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const labels={ADMIN:'Administrador',GERENTE:'Gerente',VENDEDOR:'Vendedor',ATIVA:'Ativa',CANCELADA:'Cancelada',DISPONIVEL:'Disponível',VENDIDA:'Vendida',INATIVA:'Inativa',PENDENTE:'Pendente',PAGA:'Paga',ATRASADA:'Atrasada'};
export function Badge({value}) {return <span className={'badge b-'+String(value).toLowerCase()}>{typeof value==='boolean'?(value?'Ativo':'Inativo'):labels[value] || value}</span>;}
export function Loading(){return <div className="state"><LoaderCircle className="spin" size={25}/> Carregando…</div>;}
export function ErrorBox({error}){return error?<div role="alert" className="error">{error}</div>:null;}
export function Empty({text='Nenhum registro encontrado.'}){return <div className="state empty"><Inbox size={30}/><strong>{text}</strong><span>Cadastre um registro ou ajuste os filtros.</span></div>;}
export function Modal({title,children,onClose}) {
 const dialog=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement;const before=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector('button,input,select,textarea')?.focus();const key=e=>{if(e.key==='Escape')close.current();if(e.key==='Tab'){const nodes=Array.from(dialog.current.querySelectorAll('button,a,input,select,textarea')).filter(n=>!n.disabled&&n.offsetParent!==null);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=before;document.removeEventListener('keydown',key);previous?.focus();};},[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X/></button></header>{children}</section></div>;
}
export function Table({columns,rows,onRow,actions}) {
 if(!rows?.length)return <Empty/>;
 return <div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{actions&&<th>Ações</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{columns.map(c=><td key={c.key}>{c.render?c.render(row):row[c.key] || '—'}</td>)}{actions&&<td><div className="row-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>;
}
export function Pagination({meta,page,setPage}) {return <div className="pagination"><span>{meta?.total || 0} registros · Página {page} de {Math.max(1,meta?.pages || 1)}</span><div><button aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(page-1)} className="icon-button"><ChevronLeft size={18}/></button><button aria-label="Próxima página" disabled={page>=(meta?.pages || 1)} onClick={()=>setPage(page+1)} className="icon-button"><ChevronRight size={18}/></button></div></div>;}
export function SearchBox({value,onChange,placeholder='Pesquisar…'}) {return <div className="search"><Search size={17}/><input aria-label={placeholder} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></div>;}
export function ConfirmForm({title,onSubmit,pending,error,reason=false,paid=false}) {
 const [note,setNote]=useState(''),[paidAt,setPaidAt]=useState(localDay());
 return <form onSubmit={e=>{e.preventDefault();onSubmit(paid?{paidAt,notes:note}:reason?{reason:note}:{});}}><p className="muted">{title}</p><ErrorBox error={error}/>{paid&&<label>Data efetiva de pagamento<input required type="date" value={paidAt} max={localDay()} onChange={e=>setPaidAt(e.target.value)}/></label>}{(reason||paid)&&<label>{reason?'Motivo':'Observações'}<textarea required={reason} minLength={reason?5:undefined} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>}<footer><button className="primary" disabled={pending}>{pending?'Salvando…':'Confirmar'}</button></footer></form>;
}
