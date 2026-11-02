const MAX=99999999999999n;
const decimal=n=>(n/100n)+'.'+String(n%100n).padStart(2,'0');
function cents(value){
 const text=String(value);
 if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(text))throw new Error('Informe valores com até duas casas decimais.');
 const [whole,fraction='']=text.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
// A single total surcharge, not a monthly/compound interest rate. All arithmetic is in cents.
export function calculateFinancing(baseValue,count,mode='NONE',input='0'){
 const base=cents(baseValue),value=mode==='NONE'?0n:cents(input);
 if(base<=0n||base>MAX)throw new Error('Informe um valor negociado válido.');
 if(!Number.isInteger(count)||count<1||count>120)throw new Error('Use de 1 a 120 parcelas.');
 if(!['NONE','AMOUNT','PERCENT','INSTALLMENT'].includes(mode))throw new Error('Escolha como calcular os juros.');
 if(count===1&&mode!=='NONE')throw new Error('Juros são aplicados somente na venda parcelada.');
 let total=base;
 if(mode==='AMOUNT')total+=value;
 if(mode==='PERCENT')total+=(base*value+5000n)/10000n;
 if(mode==='INSTALLMENT'){
  total=value*BigInt(count);
  if(total<base)throw new Error('O total das parcelas deve cobrir o valor negociado. Para dar desconto, reduza o valor negociado.');
 }
 if(total>MAX||total<BigInt(count))throw new Error('Total inválido. Cada parcela deve ter pelo menos R$ 0,01.');
 return {baseTotal:decimal(base),mode,value:decimal(value),interestAmount:decimal(total-base),total:decimal(total),installmentAmount:decimal(total/BigInt(count)),higherInstallments:Number(total%BigInt(count)),higherAmount:decimal(total/BigInt(count)+1n)};
}
