import { calculateFinancing } from '../../shared/financing.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCpf,moneyCents,splitInstallments,decimal,dateOnly,effectiveStatus } from '../src/lib/business.js';
import { redact } from '../src/services/audit.js';
test('CPF válido, inválido e repetido',()=>{assert.equal(validCpf('529.982.247-25'),true);assert.equal(validCpf('11144477735'),true);assert.equal(validCpf('11111111111'),false);assert.equal(validCpf('52998224726'),false);});
test('Dinheiro exato sem floats',()=>{assert.equal(moneyCents('100.01'),10001n);assert.equal(decimal(10001n),'100.01');assert.throws(()=>moneyCents('10.001'));assert.throws(()=>moneyCents('-1'));});
test('Parcelas somam exatamente o total para todos os números permitidos',()=>{
 for(let count=1;count<=120;count++){const rows=splitInstallments('12345.67',count,'2026-01-31');assert.equal(rows.reduce((s,r)=>s+moneyCents(r.amount),0n),1234567n);}
 assert.deepEqual(splitInstallments('100.00',3,'2026-01-31').map(r=>r.amount),['33.34','33.33','33.33']);
});
test('Vencimentos mantêm dia original e respeitam fevereiro bissexto',()=>{
 assert.deepEqual(splitInstallments('100',4,'2024-01-31').map(r=>r.dueAt.toISOString().slice(0,10)),['2024-01-31','2024-02-29','2024-03-31','2024-04-30']);
});
test('Datas impossíveis e parcelas menores que um centavo são rejeitadas',()=>{assert.throws(()=>dateOnly('2026-02-30'));assert.throws(()=>splitInstallments('.01',3,'2026-01-01'));assert.throws(()=>splitInstallments('1',0,'2026-01-01'));});
test('Atraso é calculado pela data e não altera parcelas pagas/canceladas',()=>{
 const now=dateOnly('2026-02-01'),dueAt=dateOnly('2026-01-31');
 assert.equal(effectiveStatus({status:'PENDENTE',dueAt},now),'ATRASADA');
 assert.equal(effectiveStatus({status:'PAGA',dueAt},now),'PAGA');
 assert.equal(effectiveStatus({status:'CANCELADA',dueAt},now),'CANCELADA');
 assert.equal(effectiveStatus({status:'PENDENTE',dueAt:now},now),'PENDENTE');
});
test('Auditoria remove segredos inclusive em objetos aninhados',()=>{
 assert.deepEqual(redact({password:'secret',user:{passwordHash:'secret',token:'secret',name:'Maria'},csrfToken:'secret'}),{user:{name:'Maria'}});
});


test('Juros sobre o total e valor de parcela com centavos exatos',()=>{
 assert.equal(calculateFinancing('9999.90',12,'PERCENT','10').total,'10999.89');
 assert.equal(calculateFinancing('9999.90',12,'AMOUNT','600').total,'10599.90');
 const manual=calculateFinancing('9999.90',12,'INSTALLMENT','900');assert.equal(manual.total,'10800.00');assert.equal(manual.interestAmount,'800.10');assert.equal(manual.installmentAmount,'900.00');
 assert.equal(calculateFinancing('100',3).higherInstallments,1);assert.equal(calculateFinancing('0.05',2,'PERCENT','10').interestAmount,'0.01');
 for(let count=2;count<=120;count++)for(const mode of ['NONE','AMOUNT','PERCENT']){const a=calculateFinancing('12345.67',count,mode,'7.35');const rows=splitInstallments(a.total,count,'2026-01-01');assert.equal(rows.reduce((n,r)=>n+moneyCents(r.amount),0n),moneyCents(a.total));}
 assert.throws(()=>calculateFinancing('100',12,'INSTALLMENT','1'));assert.throws(()=>calculateFinancing('100',1,'PERCENT','10'));assert.throws(()=>calculateFinancing('100',2,'AMOUNT','-1'));assert.throws(()=>calculateFinancing('100',2,'PERCENT','1.234'));assert.throws(()=>calculateFinancing('999999999999.99',2,'AMOUNT','0.01'));
});
