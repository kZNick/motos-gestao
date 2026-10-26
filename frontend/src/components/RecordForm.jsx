import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { allOptions,api } from '../api.js';
import { ErrorBox } from './ui.jsx';
const mask=(value,type)=>{
 const d=value.replace(/\D/g,'');
 if(type==='cpf')return d.slice(0,11).replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
 if(type==='zip')return d.slice(0,8).replace(/(\d{5})(\d)/,'$1-$2');
 if(type==='phone')return d.slice(0,11).replace(/^(\d{2})(\d)/,'($1) $2').replace(/(\d{4,5})(\d{4})$/,'$1-$2');
 return value;
};
export function RecordForm({fields,initial={},onSubmit,pending,error,user}) {
 const [values,setValues]=useState(()=>Object.fromEntries(fields.map(f=>[f.key,initial[f.key]??f.default??(f.type==='checkbox'?true:f.multiple?[]:'')])));
 const [zipMessage,setZipMessage]=useState(''),[finding,setFinding]=useState(false);
 const options=useQuery({queryKey:['form-options'],queryFn:async()=>{const units=await allOptions('units',{active:true});return {units};}});
 const set=(key,value)=>setValues(prev=>({...prev,[key]:value}));
 async function lookupZip(){
  const zip=String(values.zip || '').replace(/\D/g,''); if(zip.length!==8)return;
  setFinding(true);setZipMessage('');
  try{const {data}=await api.get('/address/'+zip);setValues(v=>({...v,street:data.logradouro||v.street,neighborhood:data.bairro||v.neighborhood,city:data.localidade||v.city,state:data.uf||v.state}));}
  catch{setZipMessage('Não foi possível buscar o CEP. Preencha o endereço manualmente.');}finally{setFinding(false);}
 }
 return <form onSubmit={e=>{e.preventDefault();const payload={...values};if(payload.unitId==='')payload.unitId=null;for(const f of fields){if(f.type==='number')payload[f.key]=Number(payload[f.key]);if(f.key==='password'&&!payload.password)delete payload.password;}onSubmit(payload);}}><ErrorBox error={error}/><div className="form-grid">{fields.map(f=>{
  const opts=f.source?(options.data?.[f.source] || []):f.options;
  const input=f.type==='checkbox'?<input type="checkbox" checked={!!values[f.key]} onChange={e=>set(f.key,e.target.checked)}/>:
   f.type==='textarea'?<textarea value={values[f.key]} onChange={e=>set(f.key,e.target.value)} maxLength={2000}/>:
   opts?<select value={values[f.key]??''} multiple={f.multiple} required={f.required} onChange={e=>set(f.key,f.multiple?Array.from(e.target.selectedOptions,x=>x.value):e.target.value)}><option disabled={f.multiple} value="">Selecione…</option>{opts.map(o=><option value={o.id??o.value} key={o.id??o.value}>{o.name??o.label}</option>)}</select>:
   <input type={f.type || 'text'} required={f.required && !(f.key==='password'&&initial.id)} min={f.min} max={f.max} step={f.step} minLength={f.key==='password'?10:undefined} maxLength={f.key==='password'?72:f.mask==='cpf'?14:f.mask==='zip'?9:f.mask==='phone'?16:200} value={values[f.key]} onChange={e=>set(f.key,f.mask?mask(e.target.value,f.mask):e.target.value)} onBlur={f.key==='zip'?lookupZip:undefined} autoComplete={f.key==='password'?'new-password':undefined}/>;
  return <label className={(f.type==='textarea'?'wide ':'')+(f.type==='checkbox'?'check':'')} key={f.key}>{f.label}{f.required?' *':''}{input}{f.hint&&<small>{f.hint}</small>}{f.key==='zip'&&<small>{finding?'Consultando CEP…':zipMessage||'O endereço é preenchido ao sair deste campo.'}</small>}</label>;
 })}</div>{options.isError&&<ErrorBox error="Não foi possível carregar as unidades."/>}<footer><button disabled={pending} className="primary">{pending?'Salvando…':'Salvar registro'}</button></footer></form>;
}
