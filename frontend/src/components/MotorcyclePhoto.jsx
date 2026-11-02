import { useState } from 'react';
import { Bike } from 'lucide-react';
export function MotorcyclePhoto({url,name='Moto',large=false}) {
 const [failed,setFailed]=useState(false);
 return <div className={large?'moto-photo large':'moto-photo'}>{url&&!failed?<img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span><Bike size={large?48:24}/>{large&&<small>{url?'Imagem indisponível':'Sem foto cadastrada'}</small>}</span>}</div>;
}
