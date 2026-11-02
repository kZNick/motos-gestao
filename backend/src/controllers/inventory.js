import { swatchesFor } from '../../../shared/colors.mjs';
import { requireImageUnit } from '../services/images.js';
import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { list,search,boolFilter } from '../lib/query.js';
import { unitScope,requireUnit } from '../middlewares/security.js';
import { scopedRecord } from '../services/records.js';
import { audit } from '../services/audit.js';
import { AppError,moneyCents } from '../lib/business.js';
const userSelect={id:true,name:true};
const stockInclude={_count:{select:{motorcycles:{where:{status:'DISPONIVEL'}}}}};
const viewVariant=v=>({...v,colorSwatches:swatchesFor(v),customPrice:v.price,price:v.price??v.product?.basePrice,stock:v._count?.motorcycles||0,imageUrl:v.imageUrl||v.product?.imageUrl});
export async function products(req,res) {
 const q=search(req.query.q);
 const result=await list(db.product,req,{AND:[unitScope(req.user),{unitId:req.query.unitId||undefined,active:boolFilter(req.query.active),...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{brand:{contains:q,mode:'insensitive'}}]}:{})}]},{unit:true,variants:{include:stockInclude}});
 result.data=result.data.map(p=>({...p,stock:p.variants.reduce((n,v)=>n+v._count.motorcycles,0),variants:p.variants.map(v=>viewVariant({...v,product:{basePrice:p.basePrice,imageUrl:p.imageUrl}}))}));
 res.json(result);
}
export async function productDetail(req,res) {
 const p=await db.product.findFirst({where:{id:req.params.id,...unitScope(req.user)},include:{unit:true,variants:{include:stockInclude,orderBy:[{color:'asc'},{batteryType:'asc'}]}}});
 if(!p)throw new AppError(404,'Produto não encontrado.');
 const manage=req.user.role!=='VENDEDOR';
 const [movements,batches,priceChanges]=await Promise.all([
  db.stockMovement.findMany({where:{variant:{productId:p.id}},take:100,orderBy:{createdAt:'desc'},include:{variant:true,user:{select:userSelect}}}),
  manage?db.stockBatch.findMany({where:{variant:{productId:p.id}},take:100,orderBy:{createdAt:'desc'},include:{variant:true,_count:{select:{motorcycles:{where:{status:'DISPONIVEL'}}}}}}):[],
  manage?db.priceChange.findMany({where:{productId:p.id},take:100,orderBy:{createdAt:'desc'},include:{variant:true,user:{select:userSelect}}}):[]
 ]);
 res.json({data:{...p,variants:p.variants.map(v=>viewVariant({...v,product:{basePrice:p.basePrice,imageUrl:p.imageUrl}})),movements,batches,priceChanges}});
}
export async function variants(req,res) {
 const result=await list(db.productVariant,req,{product:{...unitScope(req.user),active:true},active:true,...(req.query.inStock==='true'?{motorcycles:{some:{status:'DISPONIVEL'}}}:{})},{product:{include:{unit:true}},...stockInclude});
 result.data=result.data.map(viewVariant);res.json(result);
}
export async function saveProduct(req,res) {
 requireUnit(req.user,req.body.unitId);
 const result=await db.$transaction(async tx=>{
  let before=req.params.id?await scopedRecord(tx,'product',req.params.id,unitScope(req.user)):null;
  if(before){await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${before.id} FOR UPDATE`;before=await scopedRecord(tx,'product',before.id,unitScope(req.user));}
  if(!await tx.unit.findFirst({where:{id:req.body.unitId,active:true}}))throw new AppError(422,'Escolha uma unidade ativa.');
  if(before&&before.unitId!==req.body.unitId)throw new AppError(422,'A unidade do produto não pode ser alterada.');
  if(before&&moneyCents(before.basePrice)!==moneyCents(req.body.basePrice))throw new AppError(422,'Use Alterar preço para registrar o motivo e o histórico.');
  await requireImageUnit(tx,req.body.imageUrl,req.body.unitId);
  const after=before?await tx.product.update({where:{id:before.id},data:req.body}):await tx.product.create({data:req.body});
  await audit(tx,req,before?'UPDATE':'CREATE','Product',after.id,before,after);return after;
 });
 res.status(req.params.id?200:201).json({data:result});
}
export async function saveVariant(req,res) {
 const result=await db.$transaction(async tx=>{
  const product=await scopedRecord(tx,'product',req.params.id,unitScope(req.user));
  requireUnit(req.user,product.unitId);
  await requireImageUnit(tx,req.body.imageUrl,product.unitId);
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${product.id} FOR UPDATE`;
  const before=req.params.variantId?await tx.productVariant.findFirst({where:{id:req.params.variantId,productId:product.id}}):null;
  if(req.params.variantId&&!before)throw new AppError(404,'Variação não encontrada.');
  const duplicate=await tx.productVariant.findFirst({where:{productId:product.id,...(before?{id:{not:before.id}}:{}),version:{equals:req.body.version,mode:'insensitive'},batteryType:{equals:req.body.batteryType,mode:'insensitive'},color:{equals:req.body.color,mode:'insensitive'}}});
  if(duplicate)throw new AppError(409,'Esta combinação de versão, bateria e cor já existe.');
  if(before){
   if((before.price===null)!==(req.body.price===null)||(before.price!==null&&req.body.price!==null&&moneyCents(before.price)!==moneyCents(req.body.price)))throw new AppError(422,'Use Alterar preço para mudar o valor da variação.');
   if(await tx.motorcycle.count({where:{variantId:before.id}})&&['version','batteryType','color'].some(k=>before[k]!==req.body[k]))throw new AppError(409,'Esta variação já possui histórico. Crie outra variação para uma configuração diferente.');
  }
  const after=before?await tx.productVariant.update({where:{id:before.id},data:req.body}):await tx.productVariant.create({data:{...req.body,productId:product.id}});
  await audit(tx,req,before?'UPDATE':'CREATE','ProductVariant',after.id,before,after);return after;
 });
 res.status(req.params.variantId?200:201).json({data:result});
}
async function lockedVariant(tx,req) {
 const v=await tx.productVariant.findFirst({where:{id:req.params.id,product:unitScope(req.user)},include:{product:true}});
 if(!v)throw new AppError(404,'Variação não encontrada ou fora do seu acesso.');
 await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${v.productId} FOR UPDATE`;
 // Read again after the lock, because another request may have changed the price.
 return tx.productVariant.findUnique({where:{id:v.id},include:{product:true}});
}
async function setVariantPrice(tx,req,v,price,reason) {
 const oldPrice=v.price??v.product.basePrice;
 await tx.productVariant.update({where:{id:v.id},data:{price}});
 await tx.motorcycle.updateMany({where:{variantId:v.id,status:'DISPONIVEL'},data:{price}});
 await tx.priceChange.create({data:{productId:v.productId,variantId:v.id,userId:req.user.id,oldPrice,newPrice:price,reason}});
 await audit(tx,req,'PRICE_CHANGE','ProductVariant',v.id,{price:oldPrice},{price,reason});
}
export async function receive(req,res) {
 const result=await db.$transaction(async tx=>{
  const v=await lockedVariant(tx,req);
  if(!v.active||!v.product.active||!await tx.unit.findFirst({where:{id:v.product.unitId,active:true}}))throw new AppError(422,'Produto, variação ou unidade inativos.');
  const {quantity,year,code,unitCost,salePrice,notes}=req.body;
  const price=salePrice??v.price??v.product.basePrice;
  if(salePrice)await setVariantPrice(tx,req,v,salePrice,'Reajuste na entrada de lote. '+notes);
  const batch=await tx.stockBatch.create({data:{variantId:v.id,quantity,code:code||'LOTE-'+crypto.randomBytes(4).toString('hex').toUpperCase(),unitCost,notes}});
  await tx.motorcycle.createMany({data:Array.from({length:quantity},()=>({id:crypto.randomUUID(),variantId:v.id,stockBatchId:batch.id,brand:v.product.brand,model:v.product.model,year,color:v.color,imageUrl:v.imageUrl||v.product.imageUrl,price,unitId:v.product.unitId,status:'DISPONIVEL'}))});
  await tx.stockMovement.create({data:{variantId:v.id,userId:req.user.id,kind:'ENTRADA',quantity,reason:'Lote '+batch.code+(notes?' · '+notes:'')}});
  await audit(tx,req,'STOCK_RECEIPT','StockBatch',batch.id,null,{...batch,year,price});return batch;
 },{timeout:15000});
 res.status(201).json({data:result});
}
export async function withdraw(req,res) {
 await db.$transaction(async tx=>{
  const v=await lockedVariant(tx,req);
  const items=await tx.$queryRaw`SELECT id FROM "Motorcycle" WHERE "variantId"=${v.id} AND status='DISPONIVEL' ORDER BY "createdAt",id LIMIT ${req.body.quantity} FOR UPDATE SKIP LOCKED`;
  if(items.length!==req.body.quantity)throw new AppError(409,'Quantidade indisponível. Atualize o estoque e tente novamente.');
  await tx.motorcycle.updateMany({where:{id:{in:items.map(i=>i.id)},status:'DISPONIVEL'},data:{status:'INATIVA'}});
  await tx.stockMovement.create({data:{variantId:v.id,userId:req.user.id,kind:'SAIDA_MANUAL',quantity:-req.body.quantity,reason:req.body.reason}});
  await audit(tx,req,'STOCK_WITHDRAWAL','ProductVariant',v.id,null,{quantity:req.body.quantity,reason:req.body.reason});
 });
 res.json({data:{ok:true}});
}
export async function changePrice(req,res) {
 await db.$transaction(async tx=>{
  const product=await scopedRecord(tx,'product',req.params.id,unitScope(req.user));
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${product.id} FOR UPDATE`;
  const {price,variantId,reason}=req.body;
  if(variantId){
   const v=await tx.productVariant.findFirst({where:{id:variantId,productId:product.id},include:{product:true}});
   if(!v)throw new AppError(404,'Variação não encontrada.');
   await setVariantPrice(tx,req,v,price,reason);
  }else{
   const variations=await tx.productVariant.findMany({where:{productId:product.id},include:{product:true}});
   for(const v of variations)await setVariantPrice(tx,req,v,price,reason);
   await tx.product.update({where:{id:product.id},data:{basePrice:price}});
   await tx.productVariant.updateMany({where:{productId:product.id},data:{price:null}});
   await tx.priceChange.create({data:{productId:product.id,userId:req.user.id,oldPrice:product.basePrice,newPrice:price,reason}});
   await audit(tx,req,'PRICE_CHANGE','Product',product.id,{price:product.basePrice},{price,reason});
  }
 },{timeout:15000});
 res.json({data:{ok:true}});
}
