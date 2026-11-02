import '../src/config/env.js';
import { db } from '../src/config/db.js';
import { createSale,changePayment } from '../src/services/finance.js';
import { today,addMonthsClamped,validCpf } from '../src/lib/business.js';
import { audit } from '../src/services/audit.js';
import { COLOR_PALETTE } from '../../shared/colors.mjs';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
const code='DEMO_TESTE',tag='DEMO_MOTOS_V1';
const credentialsPath=new URL(new URL(process.env.DATABASE_URL).pathname.endsWith('_test')?'../../.local/demo-test-credentials.json':'../../.local/demo-credentials.json',import.meta.url);
const day=d=>d.toISOString().slice(0,10);
function cpfFor(n){let value=String(n).padStart(9,'0');for(let length=9;length<=10;length++){let sum=0;for(let i=0;i<length;i++)sum+=Number(value[i])*(length+1-i);value+=String((sum*10)%11%10);}if(!validCpf(value))throw new Error('CPF sintético inválido.');return value;}
try{
 let secrets;
 try{secrets=JSON.parse(await fs.readFile(credentialsPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;secrets={};}
 const users=[];
 const unit=await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(918274)`;
  const existing=await tx.unit.findUnique({where:{code}});
  if(existing&&existing.name!=='Unidade Teste · Demonstração')throw new Error('Código da unidade de demonstração já está em uso.');
  const unit=existing||await tx.unit.create({data:{code,name:'Unidade Teste · Demonstração',address:'Rua Fictícia dos Testes, 100 — dados simulados',city:'São Paulo',state:'SP',phone:'11900000000'}});
  for(const [role,username,label] of [['ADMIN','demo_admin','Administrador'],['GERENTE','demo_gerente','Gerente'],['VENDEDOR','demo_vendedor','Vendedor']]){
   const email=username+'@example.test';let user=await tx.user.findUnique({where:{email}});
   if(!user){
    if(await tx.user.findUnique({where:{username}}))throw new Error('Nome de demonstração já está em uso: '+username);
    const password='Demo!'+crypto.randomBytes(8).toString('hex')+'A';secrets[username]=password;
    user=await tx.user.create({data:{name:'DEMO · '+label,email,username,phone:'11900000000',passwordHash:await bcrypt.hash(password,12),role,mustChangePassword:true,...(role==='VENDEDOR'?{unitId:unit.id}:{}),...(role==='GERENTE'?{managerUnits:{create:{unitId:unit.id}}}:{})}});
    await audit(tx,{ip:null},'CREATE','User',user.id,null,{name:user.name,email,role,source:tag});
   }else if(user.username!==username||user.role!==role||!user.name.startsWith('DEMO · '))throw new Error('Conta existente fora da demonstração: '+email);
   users.push(user);
  }
  return unit;
 },{timeout:20000});
 await fs.mkdir(new URL('../../.local/',import.meta.url),{recursive:true});await fs.writeFile(credentialsPath,JSON.stringify(secrets,null,2),{mode:0o600});
 const seller=users.find(u=>u.role==='VENDEDOR');
 const customers=[];
 for(let i=0;i<4;i++){
  const email='cliente.demo.'+(i+1)+'@example.test';let customer=await db.customer.findFirst({where:{unitId:unit.id,email}});
  if(!customer){let n=910000001+i,cpf=cpfFor(n);while(await db.customer.findUnique({where:{cpf}}))cpf=cpfFor(n+=10);
   customer=await db.customer.create({data:{name:['DEMO · Ana Cliente Fictícia','DEMO · Bruno Cliente Fictício','DEMO · Carla Cliente Fictícia','DEMO · Diego Cliente Fictício'][i],cpf,email,phone:'1190000000'+i,zip:'01001000',street:'Rua Fictícia dos Testes',number:String(101+i),neighborhood:'Bairro Demonstração',city:'São Paulo',state:'SP',notes:'DADOS FICTÍCIOS — '+tag,unitId:unit.id,createdById:seller.id}});
  }customers.push(customer);
 }
 const product=await db.product.upsert({where:{unitId_name:{unitId:unit.id,name:'DEMO · Scooter Elétrica Duact Maxus 1000W'}},create:{name:'DEMO · Scooter Elétrica Duact Maxus 1000W',brand:'Duact',model:'Maxus 1000W',description:'Produto de demonstração. Estoque, custos, clientes e vendas simulados.',imageUrl:'/images/duact-maxus-1000w.png',basePrice:'9999.90',unitId:unit.id,colors:['Branca','Azul','Rose','Preta','Vermelha'],batteryTypes:['Chumbo','Lítio'],versions:['1000W']},update:{}});
 const motorcycles=[];
 for(const color of product.colors){for(const batteryType of product.batteryTypes){
  const variant=await db.productVariant.upsert({where:{productId_version_batteryType_color:{productId:product.id,version:'1000W',batteryType,color}},create:{productId:product.id,version:'1000W',batteryType,color,colorSwatches:[COLOR_PALETTE.find(c=>c.name===color)]},update:{}});
  const batchCode=tag+'_'+color+'_'+batteryType;
  await db.$transaction(async tx=>{
   const existing=await tx.stockBatch.findFirst({where:{variantId:variant.id,code:batchCode}});if(existing)return;
   const batch=await tx.stockBatch.create({data:{variantId:variant.id,code:batchCode,quantity:2,unitCost:batteryType==='Lítio'?'7200':'6500',notes:'Lote fictício de demonstração'}});
   for(let i=0;i<2;i++)await tx.motorcycle.create({data:{brand:product.brand,model:product.model,year:2026,color,price:product.basePrice,imageUrl:product.imageUrl,variantId:variant.id,stockBatchId:batch.id,unitId:unit.id,chassis:batchCode+'_'+i,notes:'ESTOQUE FICTÍCIO — '+tag}});
   await tx.stockMovement.create({data:{variantId:variant.id,userId:users[1].id,kind:'ENTRADA',quantity:2,reason:'Lote de demonstração: '+batchCode}});
  });
  motorcycles.push(...await db.motorcycle.findMany({where:{variantId:variant.id,chassis:{startsWith:batchCode+'_'}},orderBy:{chassis:'asc'}}));
 }}
 const now=today(),old=addMonthsClamped(now,-2),firstOld=addMonthsClamped(now,-1),next=addMonthsClamped(now,1);
 const cases=[
  {count:1,mode:'NONE',value:'0',paid:1},
  {count:10,mode:'NONE',value:'0',paid:0},
  {count:12,mode:'AMOUNT',value:'600',paid:0},
  {count:12,mode:'PERCENT',value:'10',paid:0},
  {count:12,mode:'INSTALLMENT',value:'900',paid:0},
  {count:6,mode:'PERCENT',value:'5',paid:1,old:true},
 ];
 const req={user:{...seller,unit:{active:true},selectedUnitId:unit.id},ip:null};
 for(const [index,c] of cases.entries()){
  const m=motorcycles[index];let sale=await db.sale.findFirst({where:{motorcycleId:m.id},include:{installments:{orderBy:{number:'asc'}}}});
  if(!sale)sale=await createSale({...req,body:{customerId:customers[index%customers.length].id,motorcycleId:m.id,total:'9999.90',soldAt:day(c.old?old:now),firstDueAt:day(c.old?firstOld:c.count===1?now:next),installmentCount:c.count,financing:{mode:c.mode,value:c.value}}});
  for(const installment of sale.installments.slice(0,c.paid))if(installment.status==='PENDENTE')await changePayment({...req,params:{id:installment.id},body:{paidAt:day(c.old?firstOld:now),notes:'Pagamento fictício de demonstração'}});
 }
 const [unitsCount,customerCount,saleCount,stock]=await Promise.all([db.user.count({where:{id:{in:users.map(u=>u.id)}}}),db.customer.count({where:{unitId:unit.id}}),db.sale.count({where:{unitId:unit.id}}),db.motorcycle.count({where:{unitId:unit.id,status:'DISPONIVEL'}})]);
 console.log(JSON.stringify({unit:unit.name,unitId:unit.id,users:users.map(u=>({username:u.username,email:u.email,role:u.role,password:secrets[u.username]||'Senha já definida anteriormente'})),counts:{users:unitsCount,customers:customerCount,sales:saleCount,stock}},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.$disconnect();}
