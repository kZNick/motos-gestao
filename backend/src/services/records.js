import bcrypt from 'bcrypt';
import { db } from '../config/db.js';
import { AppError } from '../lib/business.js';
import { audit } from './audit.js';
import { requireUnit,unitScope,customerScope,publicUser } from '../middlewares/security.js';
export async function scopedRecord(tx,model,id,scope={}) {
 const record=await tx[model].findFirst({where:{id,...scope}});
 if(!record) throw new AppError(404,'Registro não encontrado ou fora do seu acesso.');
 return record;
}
export async function saveUnit(req) {
 return db.$transaction(async tx=>{
  const before=req.params.id?await scopedRecord(tx,'unit',req.params.id):null;
  const after=before?await tx.unit.update({where:{id:before.id},data:req.body}):await tx.unit.create({data:req.body});
  await audit(tx,req,before?'UPDATE':'CREATE','Unit',after.id,before,after); return after;
 });
}
async function checkEmployee(tx,data) {
 if(data.role==='VENDEDOR'&&!data.unitId) throw new AppError(422,'Vendedor precisa de uma unidade.');
 if(data.role==='GERENTE'&&!data.managerUnitIds.length) throw new AppError(422,'Gerente precisa de pelo menos uma unidade.');
 const ids=[...new Set([...(data.unitId?[data.unitId]:[]),...data.managerUnitIds])];
 if(await tx.unit.count({where:{id:{in:ids},active:true}})!==ids.length) throw new AppError(422,'Selecione unidades ativas.');
}
export async function saveEmployee(req) {
 const {password,managerUnitIds,...data}=req.body;
 if(!req.params.id&&!password) throw new AppError(422,'Informe a senha inicial.');
 const passwordHash=password?await bcrypt.hash(password,12):undefined;
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
  const before=req.params.id?await scopedRecord(tx,'user',req.params.id):null;
  await checkEmployee(tx,req.body);
  if(before?.role==='ADMIN'&&before.active&&(data.role!=='ADMIN'||!data.active)) {
   if(await tx.user.count({where:{role:'ADMIN',active:true}})<=1) throw new AppError(409,'Mantenha pelo menos um administrador ativo.');
  }
  if(before?.id===req.user.id&&(data.role!=='ADMIN'||!data.active)) throw new AppError(409,'Você não pode remover seu próprio acesso administrativo.');
  const write={...data,unitId:data.role==='VENDEDOR'?data.unitId:null,...(passwordHash?{passwordHash}:{})};
  const after=before?await tx.user.update({where:{id:before.id},data:{...write,sessionVersion:{increment:1},managerUnits:{deleteMany:{},create:data.role==='GERENTE'?managerUnitIds.map(unitId=>({unitId})):[]}},include:{managerUnits:true,unit:true}}):await tx.user.create({data:{...write,managerUnits:{create:data.role==='GERENTE'?managerUnitIds.map(unitId=>({unitId})):[]}},include:{managerUnits:true,unit:true}});
  await audit(tx,req,before?'UPDATE':'CREATE','User',after.id,before,after);
  return publicUser(after);
 });
}
export async function saveCustomer(req) {
 requireUnit(req.user,req.body.unitId);
 return db.$transaction(async tx=>{
  const before=req.params.id?await scopedRecord(tx,'customer',req.params.id,customerScope(req.user)):null;
  if(!await tx.unit.findFirst({where:{id:req.body.unitId,active:true}})) throw new AppError(422,'Unidade inativa.');
  const after=before?await tx.customer.update({where:{id:before.id},data:req.body}):await tx.customer.create({data:{...req.body,createdById:req.user.id}});
  await audit(tx,req,before?'UPDATE':'CREATE','Customer',after.id,before,after); return after;
 });
}
export async function saveMotorcycle(req) {
 requireUnit(req.user,req.body.unitId);
 return db.$transaction(async tx=>{
  const before=req.params.id?await scopedRecord(tx,'motorcycle',req.params.id,unitScope(req.user)):null;
  if(!await tx.unit.findFirst({where:{id:req.body.unitId,active:true}})) throw new AppError(422,'Unidade inativa.');
  if(before && (before.status==='VENDIDA'||await tx.sale.count({where:{motorcycleId:before.id,status:'ATIVA'}}))) throw new AppError(409,'Moto com venda ativa não pode ser alterada.');
  let after;
  if(before) {
   const changed=await tx.motorcycle.updateMany({where:{id:before.id,status:before.status,updatedAt:before.updatedAt},data:req.body});
   if(!changed.count) throw new AppError(409,'Moto alterada por outro usuário.');
   after=await tx.motorcycle.findUnique({where:{id:before.id}});
  } else after=await tx.motorcycle.create({data:req.body});
  await audit(tx,req,before?'UPDATE':'CREATE','Motorcycle',after.id,before,after); return after;
 });
}
