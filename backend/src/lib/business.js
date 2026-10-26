export class AppError extends Error {
 constructor(status, message) { super(message); this.status = status; }
}
export const digits = value => String(value ?? '').replace(/\D/g,'');
export function validCpf(value) {
 const cpf = digits(value);
 if(cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
 for(let length=9; length<=10; length++) {
  let sum=0;
  for(let i=0; i<length; i++) sum+=Number(cpf[i])*(length+1-i);
  const check = (sum*10)%11%10;
  if(check !== Number(cpf[length])) return false;
 }
 return true;
}
export function moneyCents(value) {
 const text = String(value);
 if(!/^\d{1,12}(\.\d{1,2})?$/.test(text)) throw new AppError(422,'Informe um valor monetário válido com até duas casas decimais.');
 const [whole, fraction=''] = text.split('.');
 return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function decimal(cents) { return (cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0'); }
export function dateOnly(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new AppError(422,'Data inválida.');
 const d = new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==value) throw new AppError(422,'Data inválida.');
 return d;
}
export function today() {
 return dateOnly(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
}
export function addMonthsClamped(first, offset) {
 const target = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1));
 const last = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(first.getUTCDate(),last)); return target;
}
export function splitInstallments(total,count,firstDue) {
 const cents=moneyCents(total);
 if(!Number.isInteger(count)||count<1||count>120||cents<BigInt(count)) throw new AppError(422,'Use de 1 a 120 parcelas, cada uma com pelo menos R$ 0,01.');
 const first = dateOnly(firstDue);
 return Array.from({length:count},(_,index)=>({
  number:index+1, amount:decimal(cents/BigInt(count)+(BigInt(index)<cents%BigInt(count)?1n:0n)),
  dueAt:addMonthsClamped(first,index)
 }));
}
export function effectiveStatus(row,now=today()) {
 return row.status==='PENDENTE' && new Date(row.dueAt)<now ? 'ATRASADA' : row.status;
}
