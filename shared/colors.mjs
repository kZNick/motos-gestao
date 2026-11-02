export const COLOR_PALETTE=[
 {name:'Branca',hex:'#F5F5F0'},{name:'Nardo Grey',hex:'#8C9394'},{name:'Marrom',hex:'#795548'},
 {name:'Azul',hex:'#2864AB'},{name:'Vermelha',hex:'#C73838'},{name:'Prata',hex:'#BFC3C7'},
 {name:'Preta Brilho',hex:'#17191C'},{name:'Preta Fosca',hex:'#36383B'},{name:'Preta Dark',hex:'#0B0D11'},
 {name:'Rose',hex:'#D997A7'},{name:'Grafite',hex:'#585D63'},{name:'Verde',hex:'#477255'},
 {name:'Preta',hex:'#202124'},{name:'Amarela',hex:'#E8BC35'},{name:'Laranja',hex:'#E77B32'}
];
export function swatchesFor(variant){
 if(Array.isArray(variant?.colorSwatches)&&variant.colorSwatches.length)return variant.colorSwatches;
 return String(variant?.color||'').split(/\s*\/\s*/).filter(Boolean).map(name=>({name,hex:COLOR_PALETTE.find(x=>x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))?.hex||'#89958C'}));
}
export const colorKey=variant=>String(variant.color||'').trim().toLocaleLowerCase('pt-BR');
export function swatchBackground(colors){
 if(!colors.length)return '#89958C';
 if(colors.length===1)return colors[0].hex;
 return 'linear-gradient(135deg,'+colors.flatMap((c,i)=>[c.hex+' '+(i*100/colors.length)+'%',c.hex+' '+((i+1)*100/colors.length)+'%']).join(',')+')';
}
