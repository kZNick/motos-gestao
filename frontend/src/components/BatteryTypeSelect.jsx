import { useState } from 'react';
const groups=[
 {label:'Chumbo',types:['Chumbo','Chumbo-ácido (SLA)','AGM','Gel','Chumbo-carbono']},
 {label:'Lítio',types:['Lítio','Íons de lítio (Li-ion)','Fosfato de ferro-lítio (LiFePO4)','Polímero de lítio (LiPo)']},
 {label:'Outros tipos',types:['Íons de sódio (Na-ion)','Níquel-metal hidreto (NiMH)','Níquel-cádmio (NiCd)']}
];
export function BatteryTypeSelect({value,onChange,registered=[]}) {
 const [custom,setCustom]=useState(false);
 const known=new Set(groups.flatMap(g=>g.types).map(x=>x.toLocaleLowerCase('pt-BR')));
 const extras=[...new Set([...registered,value].filter(Boolean))].filter(x=>!known.has(x.toLocaleLowerCase('pt-BR')));
 // Keep the exact existing value selected, even if it was entered with a different spelling or casing.
 const exactKnown=new Set(groups.flatMap(g=>g.types));
 const legacy=value&&!exactKnown.has(value)&&!extras.includes(value)?[value]:[];
 return <div className="battery-type-field"><label>Tipo de bateria<select aria-label="Tipo de bateria" required value={custom?'__other__':value} onChange={e=>{const other=e.target.value==='__other__';setCustom(other);onChange(other?'':e.target.value);}}><option value="">Selecione o tipo de bateria</option>{groups.map(g=><optgroup label={g.label} key={g.label}>{g.types.map(type=><option value={type} key={type}>{type}</option>)}</optgroup>)}{!!(extras.length+legacy.length)&&<optgroup label="Já cadastradas">{[...extras,...legacy].map(type=><option value={type} key={type}>{type}</option>)}</optgroup>}<option value="__other__">Outro · informar tipo</option></select></label>{custom&&<label>Outro tipo de bateria<input aria-label="Outro tipo de bateria" required maxLength={200} value={value} onChange={e=>onChange(e.target.value)} placeholder="Informe o tipo de bateria"/></label>}</div>;
}
