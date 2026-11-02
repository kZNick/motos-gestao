import { useRef,useState } from 'react';
import { Upload } from 'lucide-react';
import { api,errorMessage } from '../api.js';
import { ErrorBox } from './ui.jsx';
import { MotorcyclePhoto } from './MotorcyclePhoto.jsx';

export function PhotoField({value,onChange,unitId,label,onBusy}) {
 const input=useRef(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 async function upload(file) {
  if(!file)return;
  setError('');setResult(null);
  if(!unitId){setError('Escolha a unidade antes de enviar a foto.');return;}
  if(file.size>8*1024*1024){setError('Escolha uma foto de até 8 MB.');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Use uma foto JPG, PNG ou WebP.');return;}
  setBusy(true);onBusy(true);
  try {
   const response=await api.post('/images',file,{params:{unitId},headers:{'Content-Type':file.type}});
   onChange(response.data.data.url);setResult(response.data.data);
  }catch(e){setError(errorMessage(e));}
  finally{setBusy(false);onBusy(false);if(input.current)input.current.value='';}
 }
 return <div className="photo-field wide">
  <label>{label}<input aria-label={label} maxLength={2000} value={value} disabled={busy} onChange={e=>{onChange(e.target.value);setResult(null);setError('');}}/></label>
  <div className="photo-upload-actions"><label className="secondary photo-upload-button" aria-disabled={busy||!unitId}><Upload size={16}/>{busy?'Otimizando foto…':'Enviar foto do computador'}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Enviar foto do computador" disabled={busy||!unitId} onChange={e=>upload(e.target.files?.[0])}/></label>{value&&<button className="secondary" type="button" disabled={busy} onClick={()=>{onChange('');setResult(null);setError('');}}>Remover foto</button>}</div>
  <small>JPG, PNG ou WebP até 8 MB. A foto enviada é otimizada automaticamente.{!unitId?' Escolha a unidade para enviar.':''}</small>
  {result&&<small role="status">Foto salva: {result.width} × {result.height} · {Math.ceil(result.size/1024)} KB.</small>}
  <ErrorBox error={error}/>
  {value&&<div className="photo-upload-preview"><MotorcyclePhoto key={value} url={value} name="Prévia da foto"/></div>}
 </div>;
}
