import { db } from '../config/db.js';
import { AppError,splitInstallments,dateOnly,today } from '../lib/business.js';
import { saleScope,unitScope,customerScope } from '../middlewares/security.js';
import { scopedRecord } from './records.js';
import { audit } from './audit.js';
export const saleInclude={customer:true,motorcycle:true,unit:true,seller:{select:{id:true,name:true}},installments:{orderBy:{number:'asc'}}};
export async function createSale(req) {
 const {customerId,motorcycleId,total,soldAt,installmentCount,firstDueAt}=req.body;
 if(dateOnly(soldAt)>today()) throw new AppError(422,'A data de venda não pode estar no futuro.');
 if(dateOnly(firstDueAt)<dateOnly(soldAt)) throw new AppError(422,'Primeiro vencimento deve ser a partir da venda.');
 const installments=splitInstallments(total,installmentCount,firstDueAt);
 return db.$transaction(async tx=>{
  const motorcycle=await scopedRecord(tx,'motorcycle',motorcycleId,unitScope(req.user));
  if(!await tx.unit.findFirst({where:{id:motorcycle.unitId,active:true}})) throw new AppError(422,'Unidade inativa.');
  const customer=await scopedRecord(tx,'customer',customerId,customerScope(req.user));
  if(!customer.active) throw new AppError(422,'Cliente desativado.');
  const reserved=await tx.motorcycle.updateMany({where:{id:motorcycleId,status:'DISPONIVEL'},data:{status:'VENDIDA'}});
  if(reserved.count!==1) throw new AppError(409,'Esta moto não está disponível para venda.');
  const sale=await tx.sale.create({data:{customerId,motorcycleId,total,soldAt:dateOnly(soldAt),installmentCount,unitId:motorcycle.unitId,sellerId:req.user.id,installments:{create:installments}},include:saleInclude});
  await audit(tx,req,'CREATE','Sale',sale.id,null,sale);
  await audit(tx,req,'UPDATE','Motorcycle',motorcycle.id,motorcycle,{...motorcycle,status:'VENDIDA'});
  return sale;
 });
}
export async function cancelSale(req) {
 return db.$transaction(async tx=>{
  const before=await tx.sale.findFirst({where:{id:req.params.id,...saleScope(req.user)},include:saleInclude});
  if(!before) throw new AppError(404,'Venda não encontrada.');
  const changed=await tx.sale.updateMany({where:{id:before.id,status:'ATIVA'},data:{status:'CANCELADA',cancellationReason:req.body.reason}});
  if(!changed.count) throw new AppError(409,'Venda já cancelada.');
  if(await tx.installment.count({where:{saleId:before.id,status:'PAGA'}})) throw new AppError(409,'Estorne as parcelas pagas antes de cancelar a venda.');
  await tx.installment.updateMany({where:{saleId:before.id},data:{status:'CANCELADA'}});
  await tx.motorcycle.update({where:{id:before.motorcycleId},data:{status:'DISPONIVEL'}});
  const after=await tx.sale.findUnique({where:{id:before.id},include:saleInclude});
  await audit(tx,req,'CANCEL','Sale',before.id,before,after); return after;
 });
}
export async function changePayment(req,reverse=false) {
 if(!reverse && dateOnly(req.body.paidAt)>today()) throw new AppError(422,'Pagamento não pode ter data futura.');
 return db.$transaction(async tx=>{
  const before=await tx.installment.findFirst({where:{id:req.params.id,sale:saleScope(req.user)},include:{sale:true}});
  if(!before) throw new AppError(404,'Parcela não encontrada.');
  // Lock the sale row first, so cancellation and payment cannot race.
  await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${before.saleId} FOR UPDATE`;
  const sale=await tx.sale.findUnique({where:{id:before.saleId}});
  if(sale.status!=='ATIVA') throw new AppError(409,'Venda cancelada.');
  const data=reverse?{status:'PENDENTE',paidAt:null,notes:req.body.reason}:{status:'PAGA',paidAt:dateOnly(req.body.paidAt),notes:req.body.notes};
  const changed=await tx.installment.updateMany({where:{id:before.id,status:reverse?'PAGA':'PENDENTE'},data});
  if(!changed.count) throw new AppError(409,reverse?'A parcela não está paga.':'A parcela já foi paga ou cancelada.');
  const after=await tx.installment.findUnique({where:{id:before.id}});
  await audit(tx,req,reverse?'REVERSE':'PAY','Installment',before.id,before,after); return after;
 });
}
