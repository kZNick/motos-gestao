import { db } from '../config/db.js';
import { list,period,enumFilter,search } from '../lib/query.js';
import { saleScope } from '../middlewares/security.js';
import { createSale,cancelSale,changePayment,saleInclude } from '../services/finance.js';
import { AppError,effectiveStatus,today } from '../lib/business.js';
export function saleFilters(req) {
 const q=search(req.query.q);
 return {AND:[saleScope(req.user),{unitId:req.query.unitId||undefined,sellerId:req.query.sellerId||undefined,customerId:req.query.customerId||undefined,status:enumFilter(req.query.status,['ATIVA','CANCELADA']),soldAt:period(req.query),...(q?{customer:{name:{contains:q,mode:'insensitive'}}}:{})}]};
}
export const viewSale=s=>({...s,installments:s.installments?.map(i=>({...i,status:effectiveStatus(i)}))});
export async function sales(req,res) { res.json(await list(db.sale,req,saleFilters(req),saleInclude,{soldAt:'desc'},viewSale)); }
export async function detail(req,res) {
 const record=await db.sale.findFirst({where:{id:req.params.id,...saleScope(req.user)},include:saleInclude});
 if(!record) throw new AppError(404,'Venda não encontrada.');
 res.json({data:viewSale(record)});
}
export function installmentFilters(req) {
 const status=enumFilter(req.query.status,['PENDENTE','ATRASADA','PAGA','CANCELADA']),now=today();
 const due=period(req.query);
 return {AND:[{sale:saleScope(req.user)},{sale:{unitId:req.query.unitId||undefined,sellerId:req.query.sellerId||undefined,customerId:req.query.customerId||undefined},saleId:req.query.saleId||undefined,dueAt:due},
 ...(status==='ATRASADA'?[{status:'PENDENTE',dueAt:{lt:now}}]:status==='PENDENTE'?[{status:'PENDENTE',dueAt:{gte:now}}]:status?[{status}]:[])]};
}
export async function installments(req,res) { res.json(await list(db.installment,req,installmentFilters(req),{sale:{include:{customer:true,motorcycle:true,unit:true,seller:{select:{id:true,name:true}}}}},{dueAt:'asc'},i=>({...i,status:effectiveStatus(i)}))); }
export const writeSale=async(req,res)=>res.status(201).json({data:viewSale(await createSale(req))});
export const cancel=async(req,res)=>res.json({data:viewSale(await cancelSale(req))});
export const pay=async(req,res)=>res.json({data:await changePayment(req)});
export const reverse=async(req,res)=>res.json({data:await changePayment(req,true)});
