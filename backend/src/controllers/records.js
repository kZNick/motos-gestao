import { db } from '../config/db.js';
import { list,search,boolFilter,enumFilter } from '../lib/query.js';
import { unitScope,unitIds,customerScope,saleScope,publicUser } from '../middlewares/security.js';
import { saveUnit,saveEmployee,saveCustomer,saveMotorcycle,scopedRecord } from '../services/records.js';
import { audit } from '../services/audit.js';
import { AppError,effectiveStatus } from '../lib/business.js';
import bcrypt from 'bcrypt';
export async function units(req,res) {
 const q=search(req.query.q),ids=unitIds(req.user);
 res.json(await list(db.unit,req,{...(ids===null?{}:{id:{in:ids}}),active:boolFilter(req.query.active),...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{code:{contains:q,mode:'insensitive'}}]}:{})}));
}
export async function employees(req,res) {
 const q=search(req.query.q);
 const scope=req.user.role==='ADMIN'?{}:{role:'VENDEDOR',...unitScope(req.user)};
 res.json(await list(db.user,req,{AND:[scope,{name:q?{contains:q,mode:'insensitive'}:undefined,unitId:req.query.unitId || undefined,role:enumFilter(req.query.role,['ADMIN','GERENTE','VENDEDOR']),active:boolFilter(req.query.active)}]}, {unit:true,managerUnits:{include:{unit:true}}},{createdAt:'desc'},publicUser));
}
export async function customers(req,res) {
 const q=search(req.query.q);
 res.json(await list(db.customer,req,{AND:[customerScope(req.user),{unitId:req.query.unitId||undefined,active:boolFilter(req.query.active),...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{cpf:{contains:q.replace(/\D/g,'')||q}},{phone:{contains:q.replace(/\D/g,'')||q}}]}:{})}]},{unit:true}));
}
export async function motorcycles(req,res) {
 const q=search(req.query.q);
 res.json(await list(db.motorcycle,req,{AND:[unitScope(req.user),{unitId:req.query.unitId||undefined,status:enumFilter(req.query.status,['DISPONIVEL','VENDIDA','INATIVA']),...(q?{OR:[{brand:{contains:q,mode:'insensitive'}},{model:{contains:q,mode:'insensitive'}}]}:{})}]},{unit:true}));
}
export async function customerDetail(req,res) {
 const customer=await scopedRecord(db,'customer',req.params.id,customerScope(req.user));
 const sales=await db.sale.findMany({where:{customerId:customer.id,...saleScope(req.user)},orderBy:{soldAt:'desc'},include:{motorcycle:true,unit:true,seller:{select:{id:true,name:true}},installments:{orderBy:{number:'asc'}}}});
 res.json({data:{...customer,sales:sales.map(s=>({...s,installments:s.installments.map(i=>({...i,status:effectiveStatus(i)}))}))}});
}
export async function motorcycleDetail(req,res) {
 res.json({data:await scopedRecord(db,'motorcycle',req.params.id,unitScope(req.user))});
}
export const writeUnit=async(req,res)=>res.status(req.params.id?200:201).json({data:await saveUnit(req)});
export const writeEmployee=async(req,res)=>res.status(req.params.id?200:201).json({data:await saveEmployee(req)});
export const writeCustomer=async(req,res)=>res.status(req.params.id?200:201).json({data:await saveCustomer(req)});
export const writeMotorcycle=async(req,res)=>res.status(req.params.id?200:201).json({data:await saveMotorcycle(req)});
export async function reset(req,res) {
 const passwordHash=await bcrypt.hash(req.body.password,12);
 const user=await db.$transaction(async tx=>{
  const before=await scopedRecord(tx,'user',req.params.id);
  const after=await tx.user.update({where:{id:before.id},data:{passwordHash,sessionVersion:{increment:1}}});
  await audit(tx,req,'PASSWORD_RESET','User',before.id); return after;
 });
 res.json({data:publicUser(user)});
}
export async function deactivate(req,res) {
 const model=req.params.resource==='customers'?'customer':req.params.resource==='users'?'user':req.params.resource==='units'?'unit':null;
 if(!model) throw new AppError(404,'Recurso não encontrado.');
 await db.$transaction(async tx=>{
  if(model==='user') await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
  const before=await scopedRecord(tx,model,req.params.id,model==='customer'?customerScope(req.user):{});
  if(model==='user' && before.id===req.user.id) throw new AppError(409,'Você não pode desativar sua própria conta.');
  if(model==='user' && before.role==='ADMIN' && before.active && await tx.user.count({where:{role:'ADMIN',active:true}})<=1) throw new AppError(409,'Mantenha um administrador ativo.');
  const after=await tx[model].update({where:{id:before.id},data:{active:false,...(model==='user'?{sessionVersion:{increment:1}}:{})}});
  await audit(tx,req,'DEACTIVATE',model,before.id,before,after);
 });
 res.json({data:{ok:true}});
}
