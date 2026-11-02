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
const password=crypto.randomBytes(24).toString('base64url')+'A!',day=today().toISOString().slice(0,10);
let admin,seller,manager,unitA,unitB,customer,motorcycle,sale,adminSession,sellerSession,managerSession;
const logIn=async(email,pass=password)=>{
 const agent=request.agent(app);const res=await agent.post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email,password:pass});
 let csrf=res.body.data?.csrfToken;
 if(res.status===200&&!res.body.data.user.mustChangePassword&&(res.body.data.user.role==='ADMIN'||res.body.data.units.length)){const selected=await agent.post('/api/auth/unit').set('Origin',env.APP_ORIGIN).set('x-csrf-token',csrf).send({unitId:res.body.data.user.role==='ADMIN'?null:res.body.data.units[0]?.id});csrf=selected.body.data?.csrfToken;}
 return {agent,csrf,res};
};
const write=(session,method,url,body)=>session.agent[method](url).set('Origin',env.APP_ORIGIN).set('x-csrf-token',session.csrf || '').send(body);
before(async()=>{
 // This database is explicitly disposable and is never the application's production database.
 await db.stockMovement.deleteMany();await db.priceChange.deleteMany();await db.auditLog.deleteMany();await db.installment.deleteMany();await db.sale.deleteMany();await db.motorcycle.deleteMany();await db.stockBatch.deleteMany();await db.productVariant.deleteMany();await db.product.deleteMany();await db.customer.deleteMany();await db.managerUnit.deleteMany();await db.user.deleteMany();await db.storedImage.deleteMany();await db.unit.deleteMany();
 const passwordHash=await bcrypt.hash(password,12);
 unitA=await db.unit.create({data:{name:'Unidade A de teste',code:'TEST_A',address:'Rua A',city:'São Paulo',state:'SP',phone:'11999999999'}});
 unitB=await db.unit.create({data:{name:'Unidade B de teste',code:'TEST_B',address:'Rua B',city:'São Paulo',state:'SP',phone:'11999999999'}});
 admin=await db.user.create({data:{name:'Admin teste',email:'admin@integration.test',passwordHash,mustChangePassword:false,role:'ADMIN'}});
 seller=await db.user.create({data:{name:'Vendedor teste',email:'seller@integration.test',passwordHash,mustChangePassword:false,role:'VENDEDOR',unitId:unitA.id}});
 manager=await db.user.create({data:{name:'Gerente teste',email:'manager@integration.test',passwordHash,mustChangePassword:false,role:'GERENTE',managerUnits:{create:{unitId:unitA.id}}}});
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
 await t.test('primeiro acesso exige senha forte e mantém bloqueio até a troca',async()=>{
  const email='first-access@integration.test';
  const user=await db.user.create({data:{name:'Primeiro acesso',email,passwordHash:await bcrypt.hash(password,12),role:'GERENTE',managerUnits:{create:{unitId:unitA.id}}}});
  const session=await logIn(email);assert.equal(session.res.body.data.user.mustChangePassword,true);
  assert.equal((await session.agent.get('/api/dashboard')).body.error.code,'PASSWORD_CHANGE_REQUIRED');
  for(const weak of ['Ab!1234','abcdefgh!','Abcdefgh'])assert.equal((await write(session,'post','/api/auth/first-password',{password:weak})).status,422);
  assert.equal((await write(session,'post','/api/auth/first-password',{password})).status,422);
  const changed=await write(session,'post','/api/auth/first-password',{password:'Abcdef!8'});assert.equal(changed.status,200);session.csrf=changed.body.data.csrfToken;
  assert.equal(changed.body.data.user.mustChangePassword,false);
  assert.equal((await session.agent.get('/api/dashboard')).body.error.code,'UNIT_REQUIRED');
  const selected=await write(session,'post','/api/auth/unit',{unitId:unitA.id});assert.equal(selected.status,200);session.csrf=selected.body.data.csrfToken;
  assert.equal((await session.agent.get('/api/dashboard')).status,200);
  assert.equal((await write(session,'post','/api/auth/unit',{unitId:unitB.id})).status,403);
  assert.equal((await write(session,'post','/api/auth/unit',{unitId:null})).status,403);
  await db.user.update({where:{id:user.id},data:{active:false}});
 });
 await t.test('manter conectado emite cookie de 30 dias; padrão usa cookie de sessão',async()=>{
  const persistent=await request(app).post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email:admin.email,password,rememberMe:true});
  assert.match(persistent.headers['set-cookie'][0],/Max-Age=2592000/);assert.match(persistent.headers['set-cookie'][0],/HttpOnly/);
  const ordinary=await request(app).post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email:admin.email,password});assert.doesNotMatch(ordinary.headers['set-cookie'][0],/Max-Age|Expires/);
 });
 await t.test('seleção limita até administrador e pode ser trocada sem ampliar ACL',async()=>{
  const session=await logIn(admin.email);
  const chosen=await write(session,'post','/api/auth/unit',{unitId:unitA.id});assert.equal(chosen.status,200);session.csrf=chosen.body.data.csrfToken;
  const rows=await session.agent.get('/api/motorcycles');assert.ok(rows.body.data.every(m=>m.unitId===unitA.id));
  const foreign=await db.motorcycle.findFirst({where:{unitId:unitB.id}});assert.equal((await session.agent.get('/api/motorcycles/'+foreign.id)).status,404);
  const customers=await session.agent.get('/api/customers');assert.ok(customers.body.data.every(c=>c.unitId===unitA.id));
  const invalid=await write(session,'post','/api/motorcycles',{brand:'Marca',model:'Teste',year:2026,color:'Verde',price:'100',unitId:unitB.id});assert.equal(invalid.status,403);
  const access=await session.agent.get('/api/access');assert.ok(access.body.data.find(p=>p.key==='teamWrite').roles.every(r=>r==='ADMIN'));
 });
 await t.test('foto aceita link HTTP(S), persiste e rejeita protocolos executáveis',async()=>{
  const payload={brand:'Foto',model:'Link',year:2026,color:'Azul',price:'100',unitId:unitA.id,imageUrl:'https://example.com/moto.png'};
  const result=await write(adminSession,'post','/api/motorcycles',payload);assert.equal(result.status,201);assert.equal(result.body.data.imageUrl,payload.imageUrl);
  assert.equal((await adminSession.agent.get('/api/motorcycles/'+result.body.data.id)).body.data.imageUrl,payload.imageUrl);
  assert.equal((await write(adminSession,'post','/api/motorcycles',{...payload,imageUrl:'javascript:alert(1)'})).status,422);
  assert.equal((await write(adminSession,'post','/api/motorcycles',{...payload,imageUrl:'file:///C:/photo.png'})).status,422);
 });
 let inventoryProduct,inventoryVariant;
 await t.test('produto e variação sem estoque, duplicidade e ACL de unidade',async()=>{
  const payload={name:'Scooter catálogo teste',brand:'Duact',model:'Maxus 1000W',basePrice:'9999.90',unitId:unitA.id,colors:['Branca','Azul'],batteryTypes:['Lítio','Chumbo'],versions:['1000W']};
  const product=await write(adminSession,'post','/api/products',payload);assert.equal(product.status,201);inventoryProduct=product.body.data;
  assert.equal((await write(sellerSession,'post','/api/products',payload)).status,403);
  const variant=await write(managerSession,'post','/api/products/'+inventoryProduct.id+'/variants',{version:'1000W',batteryType:'Lítio',color:'Branca'});assert.equal(variant.status,201);inventoryVariant=variant.body.data;
  assert.equal((await write(managerSession,'post','/api/products/'+inventoryProduct.id+'/variants',{version:'1000w',batteryType:'lítio',color:'branca'})).status,409);
  const detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].stock,0);
  const sale=await write(sellerSession,'post','/api/sales',{customerId:customer.id,variantId:inventoryVariant.id,total:'9999.90',soldAt:day,firstDueAt:day,installmentCount:1});assert.equal(sale.status,409);
  const foreign=await write(adminSession,'post','/api/products',{...payload,name:'Produto de outra loja',unitId:unitB.id});assert.equal(foreign.status,201);
  assert.equal((await managerSession.agent.get('/api/products/'+foreign.body.data.id)).status,404);
  assert.equal((await write(managerSession,'post','/api/products/'+foreign.body.data.id+'/price',{price:'100',reason:'Tentativa indevida'})).status,404);
 });
 await t.test('lote registra custo e quantidade; vendedor não recebe custos',async()=>{
  const result=await write(managerSession,'post','/api/variants/'+inventoryVariant.id+'/receive',{quantity:3,year:2026,code:'LOTE_TESTE',unitCost:'7000.00',notes:'Recebimento de teste'});assert.equal(result.status,201);
  const detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].stock,3);assert.equal(detail.body.data.batches[0].unitCost,'7000');assert.equal(detail.body.data.batches[0].quantity,3);
  const restricted=await sellerSession.agent.get('/api/products/'+inventoryProduct.id);assert.deepEqual(restricted.body.data.batches,[]);assert.doesNotMatch(JSON.stringify(restricted.body),/7000/);
  const available=await sellerSession.agent.get('/api/variants').query({inStock:'true'});assert.ok(available.body.data.some(v=>v.id===inventoryVariant.id&&v.stock===3));
  assert.equal((await write(sellerSession,'post','/api/variants/'+inventoryVariant.id+'/receive',{quantity:1,year:2026})).status,403);
  assert.equal((await write(adminSession,'post','/api/variants/'+inventoryVariant.id+'/receive',{quantity:-1,year:2026})).status,422);
 });
 let catalogSales;
 await t.test('vendas simultâneas alocam unidades distintas e nunca excedem o lote',async()=>{
  await db.customer.update({where:{id:customer.id},data:{active:true}});
  const payload={customerId:customer.id,variantId:inventoryVariant.id,total:'9999.90',soldAt:day,firstDueAt:day,installmentCount:2};
  const results=await Promise.all(Array.from({length:4},()=>write(sellerSession,'post','/api/sales',payload)));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,201,201,409]);catalogSales=results.filter(r=>r.status===201).map(r=>r.body.data);
  assert.equal(new Set(catalogSales.map(s=>s.motorcycleId)).size,3);
  const detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].stock,0);assert.equal(detail.body.data.movements.filter(m=>m.kind==='VENDA').length,3);
 });
 await t.test('cancelar devolve uma unidade, saída manual não gera estoque negativo',async()=>{
  const first=catalogSales[0];assert.equal((await write(managerSession,'post','/api/sales/'+first.id+'/cancel',{reason:'Devolução de teste'})).status,200);
  assert.equal((await write(managerSession,'post','/api/sales/'+first.id+'/cancel',{reason:'Segunda devolução'})).status,409);
  let detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].stock,1);
  assert.equal((await write(managerSession,'post','/api/variants/'+inventoryVariant.id+'/withdraw',{quantity:2,reason:'Ajuste indevido'})).status,409);
  assert.equal((await write(managerSession,'post','/api/variants/'+inventoryVariant.id+'/withdraw',{quantity:1,reason:'Avaria na unidade devolvida'})).status,200);
  detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].stock,0);assert.equal(detail.body.data.movements.reduce((n,m)=>n+m.quantity,0),0);
 });
 await t.test('preço registra histórico e novo lote conserva custo e vendas anteriores',async()=>{
  const url='/api/products/'+inventoryProduct.id+'/price';
  assert.equal((await write(managerSession,'post',url,{price:'10499.90',reason:'Novo lote com custo maior'})).status,200);
  const receipt=await write(managerSession,'post','/api/variants/'+inventoryVariant.id+'/receive',{quantity:2,year:2026,unitCost:'7800',salePrice:'10999.90',notes:'Segundo lote, fornecedor mais caro'});assert.equal(receipt.status,201);
  let detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);assert.equal(detail.body.data.variants[0].price,'10999.9');assert.equal(detail.body.data.variants[0].stock,2);assert.ok(detail.body.data.priceChanges.length>=3);
  const oldSale=await db.sale.findUnique({where:{id:catalogSales[1].id}});assert.equal(String(oldSale.total),'9999.9');
  const items=await db.motorcycle.findMany({where:{variantId:inventoryVariant.id,status:'DISPONIVEL'}});assert.ok(items.every(m=>String(m.price)==='10999.9'));
  assert.equal((await write(managerSession,'post',url,{variantId:inventoryVariant.id,price:'9499.90',reason:'Redução de preço'})).status,200);
  const newBatch=await db.stockBatch.findUnique({where:{id:receipt.body.data.id}});assert.equal(String(newBatch.unitCost),'7800');
  assert.equal((await write(managerSession,'post','/api/sales/'+catalogSales[1].id+'/cancel',{reason:'Devolução após reajuste'})).status,200);
  const returned=await db.motorcycle.findUnique({where:{id:catalogSales[1].motorcycleId}});assert.equal(String(returned.price),'9499.9');
  assert.equal((await write(sellerSession,'post',url,{price:'1',reason:'Tentativa indevida'})).status,403);
  assert.equal((await write(managerSession,'post',url,{price:'-1',reason:'Preço inválido'})).status,422);
 });
 await t.test('usuário sem unidade autentica para ver aviso e não acessa a operação',async()=>{
  const data={name:'Aguardando unidade',email:'waiting@integration.test',phone:'11999999999',password,role:'VENDEDOR',unitId:null,managerUnitIds:[]};
  const created=await write(adminSession,'post','/api/users',data);assert.equal(created.status,201);
  const waiting=await logIn(data.email);assert.equal(waiting.res.status,200);assert.deepEqual(waiting.res.body.data.units,[]);
  const me=await waiting.agent.get('/api/auth/me');assert.equal(me.status,200);assert.deepEqual(me.body.data.units,[]);
  // No unit access is granted even after the user sets a password.
  const changed=await write(waiting,'post','/api/auth/first-password',{password:password+'Novo!'});assert.equal(changed.status,200);waiting.csrf=changed.body.data.csrfToken;
  const blocked=await waiting.agent.get('/api/sales');assert.equal(blocked.status,403);assert.equal(blocked.body.error.code,'UNIT_ACCESS_REQUIRED');
  assert.equal((await write(waiting,'post','/api/auth/unit',{unitId:unitA.id})).status,403);
  assert.equal((await write(waiting,'post','/api/auth/unit',{unitId:null})).status,403);
  const assigned=await write(adminSession,'put','/api/users/'+created.body.data.id,{...data,password:undefined,unitId:unitA.id});assert.equal(assigned.status,200);
  const released=await logIn(data.email,password+'Novo!');assert.deepEqual(released.res.body.data.units.map(u=>u.id),[unitA.id]);
 });
 await t.test('cadastro básico de cliente valida CPF e unidade sem inventar endereço',async()=>{
  const body={name:'Cliente rápido',cpf:'39053344705',phone:'11999999999',unitId:unitA.id};
  const response=await write(sellerSession,'post','/api/customers/quick',body);assert.equal(response.status,201);
  assert.equal(response.body.data.street,'');assert.equal(response.body.data.zip.trim(),'');assert.equal(response.body.data.createdById,seller.id);
  assert.equal((await write(sellerSession,'post','/api/customers/quick',body)).status,409);
  assert.equal((await write(sellerSession,'post','/api/customers/quick',{...body,cpf:'11111111111'})).status,422);
  assert.equal((await write(sellerSession,'post','/api/customers/quick',{...body,unitId:unitB.id})).status,403);
 });
 await t.test('variação bicolor persiste os tons e impede combinações duplicadas',async()=>{
  const url='/api/products/'+inventoryProduct.id+'/variants';
  const payload={version:'1000W',batteryType:'Chumbo',color:'Branca / Preta',colorSwatches:[{name:'Preta',hex:'#202124'},{name:'Branca',hex:'#ffffff'}]};
  const created=await write(managerSession,'post',url,payload);assert.equal(created.status,201);assert.equal(created.body.data.color,'Branca / Preta');
  assert.deepEqual(created.body.data.colorSwatches,[{name:'Branca',hex:'#FFFFFF'},{name:'Preta',hex:'#202124'}]);
  const duplicate=await write(managerSession,'post',url,{...payload,colorSwatches:[...payload.colorSwatches].reverse()});assert.equal(duplicate.status,409);
  assert.equal((await write(managerSession,'post',url,{...payload,colorSwatches:[{name:'Azul',hex:'red; background:url(evil)'}]})).status,422);
  assert.equal((await write(managerSession,'post',url,{...payload,colorSwatches:[{name:'Azul',hex:'#0055AA'},{name:'azul',hex:'#123456'}]})).status,422);
  const detail=await adminSession.agent.get('/api/products/'+inventoryProduct.id);const white=detail.body.data.variants.find(v=>v.id===inventoryVariant.id);assert.equal(white.colorSwatches[0].name,'Branca');
  assert.equal(detail.body.data.variants.find(v=>v.id===created.body.data.id).colorSwatches.length,2);
 });
 await t.test('venda recalcula juros e parcelas no servidor e preserva histórico',async()=>{
  const c=await db.customer.findFirst({where:{unitId:unitA.id,active:true}});assert.ok(c);
  const cases=[['NONE','0','9999.90'],['AMOUNT','600','10599.90'],['PERCENT','10','10999.89'],['INSTALLMENT','900','10800.00']];
  for(const [mode,value,total] of cases){const m=await db.motorcycle.create({data:{brand:'Teste',model:'Juros '+mode,year:2026,color:'Rose',price:'9999.90',unitId:unitA.id}});
   const r=await write(adminSession,'post','/api/sales',{customerId:c.id,motorcycleId:m.id,total:'9999.90',financing:{mode,value},soldAt:day,firstDueAt:day,installmentCount:12});assert.equal(r.status,201);assert.equal(moneyCents(r.body.data.total),moneyCents(total));assert.equal(r.body.data.financing.baseTotal,'9999.90');assert.equal(r.body.data.financing.mode,mode);assert.equal(r.body.data.installments.reduce((n,p)=>n+moneyCents(p.amount),0n),moneyCents(total));
   const detail=await adminSession.agent.get('/api/sales/'+r.body.data.id);assert.equal(detail.body.data.financing.total,total);
  }
  const m=await db.motorcycle.create({data:{brand:'Teste',model:'Juros inválido',year:2026,color:'Rose',price:'9999.90',unitId:unitA.id}}),body={customerId:c.id,motorcycleId:m.id,total:'9999.90',soldAt:day,firstDueAt:day,installmentCount:12};
  assert.equal((await write(adminSession,'post','/api/sales',{...body,financing:{mode:'INSTALLMENT',value:'1'}})).status,422);
  assert.equal((await write(adminSession,'post','/api/sales',{...body,installmentCount:1,financing:{mode:'PERCENT',value:'10'}})).status,422);
  assert.equal((await write(adminSession,'post','/api/sales',{...body,financing:{mode:'PERCENT',value:'10',total:'0.01'}})).status,422);
  assert.equal((await db.motorcycle.findUnique({where:{id:m.id}})).status,'DISPONIVEL');
 });
 await t.test('logout revoga a sessão',async()=>{
  const s=await logIn(admin.email);await write(s,'post','/api/auth/logout',{});assert.equal((await s.agent.get('/api/sales')).status,401);
 });
});
