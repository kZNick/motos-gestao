import { z } from 'zod';
import { validCpf,digits,moneyCents,dateOnly } from '../lib/business.js';
const text=z.string().trim().min(1).max(200);
const optional=z.string().trim().max(2000).optional().default('');
const uuid=z.string().uuid();
const state=z.string().trim().length(2).transform(v=>v.toUpperCase());
const phone=z.string().transform(digits).refine(v=>/^\d{10,11}$/.test(v),'Telefone deve ter 10 ou 11 dígitos.');
const money=z.union([z.string(),z.number()]).transform(String).refine(v=>{try{return moneyCents(v)>0n;}catch{return false;}},'Valor monetário inválido.');
export const date=z.string().refine(v=>{try{dateOnly(v);return true;}catch{return false;}},'Data inválida.');
const password=z.string().min(10,'Senha deve ter ao menos 10 caracteres.').max(72,'Senha deve ter até 72 caracteres.').refine(v=>Buffer.byteLength(v)<=72,'Senha excede 72 bytes.');
export const login=z.object({email:z.string().email().transform(v=>v.toLowerCase()),password:z.string().min(1).max(200)}).strict();
export const unit=z.object({name:text,code:text,address:text,city:text,state,phone,active:z.boolean().default(true)}).strict();
export const employee=z.object({name:text,email:z.string().email().transform(v=>v.toLowerCase()),phone,
 password:password.optional(),role:z.enum(['ADMIN','GERENTE','VENDEDOR']),unitId:uuid.nullable().optional(),managerUnitIds:z.array(uuid).max(100).default([]),active:z.boolean().default(true)}).strict();
export const resetPassword=z.object({password}).strict();
export const profile=z.object({name:text,phone,currentPassword:z.string().max(200).optional(),password:password.optional()}).strict();
export const customer=z.object({name:text,cpf:z.string().transform(digits).refine(validCpf,'CPF inválido.'),phone,
 email:z.union([z.string().email(),z.literal('')]).optional().transform(v=>v || null),zip:z.string().transform(digits).refine(v=>/^\d{8}$/.test(v),'CEP inválido.'),
 street:text,number:text,complement:optional,neighborhood:text,city:text,state,notes:optional,unitId:uuid,active:z.boolean().default(true)}).strict();
export const motorcycle=z.object({brand:text,model:text,year:z.coerce.number().int().min(1900).max(2100),color:text,
 chassis:z.string().trim().max(100).optional().transform(v=>v || null),price:money,unitId:uuid,status:z.enum(['DISPONIVEL','INATIVA']).default('DISPONIVEL'),notes:optional}).strict();
export const sale=z.object({customerId:uuid,motorcycleId:uuid,total:money,soldAt:date,installmentCount:z.coerce.number().int().min(1).max(120),firstDueAt:date}).strict();
export const cancel=z.object({reason:z.string().trim().min(5).max(2000)}).strict();
export const pay=z.object({paidAt:date,notes:optional}).strict();
export const reverse=z.object({reason:z.string().trim().min(5).max(2000)}).strict();
export const validate=schema=>(req,res,next)=>{try{req.body=schema.parse(req.body);next();}catch(e){next(e);}};
export const identifier=z.string().uuid();
