import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { today,moneyCents } from '../src/lib/business.js';
const dbName=new URL(env.DATABASE_URL).pathname.slice(1);
if(!dbName.endsWith('_test')) throw new Error('Integração só pode executar em banco terminado em _test.');
const password=crypto.randomBytes(24).toString('base64url'),day=today().toISOString().slice(0,10);
let admin,seller,manager,unitA,unitB,customer,motorcycle,sale,adminSession,sellerSession,managerSession;
const logIn=async(email,pass=password)=>{
 const agent=request.agent(app);const res=await agent.post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email,password:pass});
 return {agent,csrf:res.body.data?.csrfToken,res};
};
const write=(session,method,url,body)=>session.agent[method](url).set('Origin',env.APP_ORIGIN).set('x-csrf-token',session.csrf || '').send(body);
before(async()=>{
 // This database is explicitly disposable and is never the application's production database.
 await db.auditLog.deleteMany();await db.installment.deleteMany();await db.sale.deleteMany();await db.motorcycle.deleteMany();await db.customer.deleteMany();await db.managerUnit.deleteMany();await db.user.deleteMany();await db.unit.deleteMany();
 const passwordHash=await bcrypt.hash(password,12);
 unitA=await db.unit.create({data:{name:'Unidade A de teste',code:'TEST_A',address:'Rua A',city:'São Paulo',state:'SP',phone:'11999999999'}});
 unitB=await db.unit.create({data:{name:'Unidade B de teste',code:'TEST_B',address:'Rua B',city:'São Paulo',state:'SP',phone:'11999999999'}});
 admin=await db.user.create({data:{name:'Admin teste',email:'admin@integration.test',passwordHash,role:'ADMIN'}});
 seller=await db.user.create({data:{name:'Vendedor teste',email:'seller@integration.test',passwordHash,role:'VENDEDOR',unitId:unitA.id}});
 manager=await db.user.create({data:{name:'Gerente teste',email:'manager@integration.test',passwordHash,role:'GERENTE',managerUnits:{create:{unitId:unitA.id}}}});
 adminSession=await logIn(admin.email);sellerSession=await logIn(seller.email);managerSession=await logIn(manager.email);
});
after(async()=>{await db.$disconnect();});
test('Fluxos reais com PostgreSQL',async t=>{
 await t.test('login válido gera cookie HttpOnly e usuário sem senha',()=>{assert.equal(adminSession.res.status,200);assert.match(adminSession.res.headers['set-cookie'][0],/HttpOnly/);assert.equal(adminSession.res.body.data.user.passwordHash,undefined);});
 await t.test('login inválido e tentativa auditada',async()=>{const s=await logIn(admin.email,'incorreta');assert.equal(s.res.status,401);assert.ok(await db.auditLog.findFirst({where:{action:'LOGIN_FAILURE'}}));});
 await t.test('usuário desativado perde acesso inclusive com JWT anterior',async()=>{
  await db.user.update({where:{id:seller.id},data:{active:false}});
  assert.equal((await sellerSession.agent.get('/api/sales')).status,401);
  assert.equal((await logIn(seller.email)).res.status,401);
  await db.user.update({where:{id:seller.id},data:{active:true}});
 });
 await t.test('CSRF bloqueia origem estranha e token ausente',async()=>{
  assert.equal((await adminSession.agent.post('/api/units').set('Origin','https://evil.example').send({})).status,403);
  assert.equal((await adminSession.agent.post('/api/units').set('Origin',env.APP_ORIGIN).send({})).status,403);
 });
 await t.test('vendedor não administra usuários nem auditoria; gerente não altera admin',async()=>{
  assert.equal((await sellerSession.agent.get('/api/users')).status,403);assert.equal((await sellerSession.agent.get('/api/audit-logs')).status,403);
  assert.equal((await write(managerSession,'put','/api/users/'+admin.id,{})).status,403);
 });
 await t.test('cliente CPF validado, persistido e duplicidade bloqueada',async()=>{
  const body={name:'Cliente integração',cpf:'52998224725',phone:'11999999999',zip:'01001000',street:'Praça da Sé',number:'1',neighborhood:'Sé',city:'São Paulo',state:'SP',unitId:unitA.id};
  const res=await write(sellerSession,'post','/api/customers',body);assert.equal(res.status,201);customer=res.body.data;
  assert.equal((await write(adminSession,'post','/api/customers',body)).status,409);
  assert.equal((await write(adminSession,'post','/api/customers',{...body,cpf:'11111111111'})).status,422);
 });
 await t.test('acesso entre unidades bloqueado em cadastro, estoque e histórico',async()=>{
  const m=await db.motorcycle.create({data:{brand:'Teste',model:'B',year:2026,color:'Preta',price:'100.00',unitId:unitB.id}});
  assert.equal((await sellerSession.agent.get('/api/motorcycles/'+m.id)).status,404);
  assert.equal((await sellerSession.agent.get('/api/motorcycles').query({unitId:unitB.id})).body.data.length,0);
  assert.equal((await write(sellerSession,'put','/api/customers/'+customer.id,{name:customer.name,cpf:customer.cpf,phone:customer.phone,zip:customer.zip,street:customer.street,number:customer.number,neighborhood:customer.neighborhood,city:customer.city,state:customer.state,unitId:unitB.id})).status,403);
  const res=await write(sellerSession,'post','/api/sales',{customerId:customer.id,motorcycleId:m.id,total:'100',soldAt:day,firstDueAt:day,installmentCount:3});assert.equal(res.status,404);
 });
 await t.test('cadastro de moto e venda com parcelas automáticas exatas',async()=>{
  const m=await write(adminSession,'post','/api/motorcycles',{brand:'Teste',model:'Elétrica',year:2026,color:'Verde',price:'100.00',unitId:unitA.id});assert.equal(m.status,201);motorcycle=m.body.data;
  const r=await write(sellerSession,'post','/api/sales',{customerId:customer.id,motorcycleId:motorcycle.id,total:'100.00',soldAt:day,firstDueAt:day,installmentCount:3});assert.equal(r.status,201);sale=r.body.data;
  assert.equal(sale.sellerId,seller.id);assert.equal(sale.unitId,unitA.id);assert.equal(sale.installments.length,3);
  assert.equal(sale.installments.reduce((sum,i)=>sum+moneyCents(i.amount),0n),10000n);
  assert.equal((await db.motorcycle.findUnique({where:{id:motorcycle.id}})).status,'VENDIDA');
 });
 await t.test('venda duplicada é rejeitada sem gerar parcelas adicionais',async()=>{
  const r=await write(sellerSession,'post','/api/sales',{customerId:customer.id,motorcycleId:motorcycle.id,total:'100',soldAt:day,firstDueAt:day,installmentCount:3});assert.equal(r.status,409);
  assert.equal(await db.sale.count({where:{motorcycleId:motorcycle.id,status:'ATIVA'}}),1);
 });
 await t.test('concorrência: somente uma venda da mesma moto',async()=>{
  const m=await db.motorcycle.create({data:{brand:'Teste',model:'Concorrência',year:2026,color:'Azul',price:'100',unitId:unitA.id}});
  const payload={customerId:customer.id,motorcycleId:m.id,total:'100',soldAt:day,firstDueAt:day,installmentCount:2};
  const results=await Promise.all([write(sellerSession,'post','/api/sales',payload),write(sellerSession,'post','/api/sales',payload)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
 });
 await t.test('pagamento persistido, auditado e duplicidade bloqueada',async()=>{
  const installment=sale.installments[0];
  assert.equal((await write(sellerSession,'post','/api/installments/'+installment.id+'/pay',{paidAt:day})).status,200);
  assert.equal((await write(sellerSession,'post','/api/installments/'+installment.id+'/pay',{paidAt:day})).status,409);
  const log=await db.auditLog.findFirst({where:{action:'PAY',recordId:installment.id}});
  assert.equal(log.userId,seller.id);assert.equal(log.before.status,'PENDENTE');assert.equal(log.after.status,'PAGA');
 });
 await t.test('atraso automático e filtro por vencimento',async()=>{
  const installment=sale.installments[1];await db.installment.update({where:{id:installment.id},data:{dueAt:new Date('2020-01-01')}});
  const response=await sellerSession.agent.get('/api/installments').query({status:'ATRASADA'});
  assert.ok(response.body.data.some(i=>i.id===installment.id&&i.status==='ATRASADA'));
 });
 await t.test('vendedor não cancela ou estorna; venda paga exige estorno',async()=>{
  assert.equal((await write(sellerSession,'post','/api/sales/'+sale.id+'/cancel',{reason:'Cancelamento teste'})).status,403);
  assert.equal((await write(sellerSession,'post','/api/installments/'+sale.installments[0].id+'/reverse',{reason:'Correção teste'})).status,403);
  assert.equal((await write(managerSession,'post','/api/sales/'+sale.id+'/cancel',{reason:'Cancelamento teste'})).status,409);
  assert.equal((await db.sale.findUnique({where:{id:sale.id}})).status,'ATIVA');
 });
 await t.test('estorno e cancelamento preservam financeiro e liberam moto',async()=>{
  assert.equal((await write(managerSession,'post','/api/installments/'+sale.installments[0].id+'/reverse',{reason:'Correção teste'})).status,200);
  assert.equal((await write(managerSession,'post','/api/sales/'+sale.id+'/cancel',{reason:'Cancelamento teste'})).status,200);
  assert.equal(await db.installment.count({where:{saleId:sale.id,status:'CANCELADA'}}),3);
  assert.equal((await db.motorcycle.findUnique({where:{id:motorcycle.id}})).status,'DISPONIVEL');
  assert.ok(await db.auditLog.findFirst({where:{action:'CANCEL',recordId:sale.id}}));
 });
 await t.test('gerente e vendedor não leem clientes e vendas de outra unidade',async()=>{
  const foreign=await db.customer.create({data:{name:'Cliente B',cpf:'12345678909',phone:'11999999999',zip:'01001000',street:'Rua B',number:'1',neighborhood:'Centro',city:'São Paulo',state:'SP',unitId:unitB.id,createdById:admin.id}});
  assert.equal((await sellerSession.agent.get('/api/customers/'+foreign.id)).status,404);
  assert.equal((await managerSession.agent.get('/api/customers/'+foreign.id)).status,404);
  assert.equal((await managerSession.agent.get('/api/motorcycles').query({unitId:unitB.id})).body.data.length,0);
 });
 await t.test('cadastro, edição, redefinição e desativação de funcionários',async()=>{
  const data={name:'Novo gerente',email:'new-manager@integration.test',phone:'11999999999',password,role:'GERENTE',unitId:null,managerUnitIds:[unitA.id]};
  const created=await write(adminSession,'post','/api/users',data);assert.equal(created.status,201);const id=created.body.data.id;
  const session=await logIn(data.email);assert.equal(session.res.status,200);
  assert.equal((await write(adminSession,'put','/api/users/'+id,{...data,name:'Gerente editado'})).status,200);
  assert.equal((await session.agent.get('/api/sales')).status,401);
  assert.equal((await write(adminSession,'post','/api/users/'+id+'/password',{password:password+'x'})).status,200);
  assert.equal((await logIn(data.email)).res.status,401);assert.equal((await logIn(data.email,password+'x')).res.status,200);
  assert.equal((await write(adminSession,'delete','/api/users/'+id,{})).status,200);assert.equal((await logIn(data.email,password+'x')).res.status,401);
 });
 await t.test('vendedor de unidade desativada perde acesso',async()=>{
  await db.unit.update({where:{id:unitA.id},data:{active:false}});assert.equal((await sellerSession.agent.get('/api/sales')).status,401);
  await db.unit.update({where:{id:unitA.id},data:{active:true}});
 });
 await t.test('concorrência entre baixa e cancelamento mantém consistência',async()=>{
  const m=await db.motorcycle.create({data:{brand:'Teste',model:'Pagamento concorrente',year:2026,color:'Verde',price:'100',unitId:unitA.id}});
  const created=await write(sellerSession,'post','/api/sales',{customerId:customer.id,motorcycleId:m.id,total:'100',soldAt:day,firstDueAt:day,installmentCount:1});const s=created.body.data;
  const results=await Promise.all([write(managerSession,'post','/api/sales/'+s.id+'/cancel',{reason:'Cancelamento concorrente'}),write(sellerSession,'post','/api/installments/'+s.installments[0].id+'/pay',{paidAt:day})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const final=await db.sale.findUnique({where:{id:s.id},include:{installments:true}});
  assert.equal(final.installments[0].status,final.status==='CANCELADA'?'CANCELADA':'PAGA');
 });
 await t.test('filtros inválidos retornam validação e admin preserva próprio acesso',async()=>{
  assert.equal((await adminSession.agent.get('/api/sales').query({from:'2026-02-30'})).status,422);
  assert.equal((await adminSession.agent.get('/api/sales').query({unitId:'invalid'})).status,422);
  assert.equal((await write(adminSession,'delete','/api/users/'+admin.id,{})).status,409);
 });
 await t.test('cliente com vendas é desativado preservando histórico',async()=>{
  assert.equal((await write(sellerSession,'delete','/api/customers/'+customer.id,{})).status,200);
  const detail=await sellerSession.agent.get('/api/customers/'+customer.id);assert.equal(detail.status,200);assert.equal(detail.body.data.active,false);assert.ok(detail.body.data.sales.length);
 });
 await t.test('paginação, dashboard e auditoria sem segredos',async()=>{
  const r=await adminSession.agent.get('/api/users').query({limit:1});assert.equal(r.body.data.length,1);assert.ok(r.body.meta.total>=3);assert.equal(r.body.data[0].passwordHash,undefined);
  assert.equal((await adminSession.agent.get('/api/dashboard')).status,200);
  const logs=await adminSession.agent.get('/api/audit-logs');assert.equal(logs.status,200);assert.doesNotMatch(JSON.stringify(logs.body),/passwordHash|csrfToken/);
 });
 await t.test('logout revoga a sessão',async()=>{
  const s=await logIn(admin.email);await write(s,'post','/api/auth/logout',{});assert.equal((await s.agent.get('/api/sales')).status,401);
 });
});
