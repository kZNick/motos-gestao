import { z } from 'zod';
import { validCpf,digits,moneyCents,dateOnly } from '../lib/business.js';
const text=z.string().trim().min(1).max(200);
const optional=z.string().trim().max(2000).optional().default('');
const uuid=z.string().uuid();
const state=z.string().trim().length(2).transform(v=>v.toUpperCase());
const phone=z.string().transform(digits).refine(v=>/^\d{10,11}$/.test(v),'Telefone deve ter 10 ou 11 dígitos.');
const money=z.union([z.string(),z.number()]).transform(String).refine(v=>{try{return moneyCents(v)>0n;}catch{return false;}},'Valor monetário inválido.');
export const date=z.string().refine(v=>{try{dateOnly(v);return true;}catch{return false;}},'Data inválida.');
export const password=z.string().min(8,'Senha deve ter ao menos 8 caracteres.').regex(/[A-Z]/,'Inclua uma letra maiúscula.').regex(/[^\p{L}\p{N}\s]/u,'Inclua um caractere especial.').max(72,'Senha deve ter até 72 caracteres.').refine(v=>Buffer.byteLength(v)<=72,'Senha excede 72 bytes.');
export const username=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,29}$/,'Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado, sem espaços.');
const optionalUsername=z.union([username,z.literal('')]).transform(v=>v||null).optional();
const loginIdentifier=z.string().trim().min(1).max(200).transform(v=>v.toLowerCase());
export const login=z.object({identifier:loginIdentifier.optional(),email:loginIdentifier.optional(),password:z.string().min(1).max(200),rememberMe:z.boolean().default(false)}).strict().refine(v=>!!v.identifier!==!!v.email,{message:'Informe seu e-mail ou nome de usuário.',path:['identifier']}).transform(({email,identifier,...rest})=>({...rest,identifier:identifier??email}));
export const unit=z.object({name:text,code:text,address:text,city:text,state,phone,active:z.boolean().default(true)}).strict();
export const employee=z.object({name:text,username:optionalUsername,email:z.string().email().transform(v=>v.toLowerCase()),phone,
 password:password.optional(),role:z.enum(['ADMIN','GERENTE','VENDEDOR']),unitId:uuid.nullable().optional(),managerUnitIds:z.array(uuid).max(100).default([]),active:z.boolean().default(true)}).strict();
export const firstPassword=z.object({password}).strict();
export const selectUnit=z.object({unitId:uuid.nullable()}).strict();
export const resetPassword=z.object({password}).strict();
export const profile=z.object({name:text,username:optionalUsername,phone:z.union([phone,z.literal('')]),currentPassword:z.string().max(200).optional(),password:password.optional()}).strict();
export const customer=z.object({name:text,cpf:z.string().transform(digits).refine(validCpf,'CPF inválido.'),phone,
 email:z.union([z.string().email(),z.literal('')]).optional().transform(v=>v || null),zip:z.string().transform(digits).refine(v=>/^\d{8}$/.test(v),'CEP inválido.'),
 street:text,number:text,complement:optional,neighborhood:text,city:text,state,notes:optional,unitId:uuid,active:z.boolean().default(true)}).strict();
export const quickCustomer=customer.pick({name:true,cpf:true,phone:true,email:true,unitId:true});
export const motorcycle=z.object({brand:text,model:text,year:z.coerce.number().int().min(1900).max(2100),color:text,
 imageUrl:z.union([z.string().trim().url().max(2000).refine(v=>['http:','https:'].includes(new URL(v).protocol),'Use um link HTTP ou HTTPS.'),z.literal('')]).optional().transform(v=>v||null),
 chassis:z.string().trim().max(100).optional().transform(v=>v || null),price:money,unitId:uuid,status:z.enum(['DISPONIVEL','INATIVA']).default('DISPONIVEL'),notes:optional}).strict();
const financing=z.object({mode:z.enum(['NONE','AMOUNT','PERCENT','INSTALLMENT']),value:z.union([z.string(),z.number()]).transform(String).refine(v=>{try{moneyCents(v);return true;}catch{return false;}},'Valor inválido.')}).strict();
export const sale=z.object({customerId:uuid,motorcycleId:uuid.optional(),variantId:uuid.optional(),total:money,financing:financing.optional(),soldAt:date,installmentCount:z.coerce.number().int().min(1).max(120),firstDueAt:date}).strict().refine(v=>!!v.motorcycleId!==!!v.variantId,'Escolha uma moto avulsa ou uma variação.');
export const cancel=z.object({reason:z.string().trim().min(5).max(2000)}).strict();
export const pay=z.object({paidAt:date,notes:optional}).strict();
export const reverse=z.object({reason:z.string().trim().min(5).max(2000)}).strict();
export const validate=schema=>(req,res,next)=>{try{req.body=schema.parse(req.body);next();}catch(e){next(e);}};
export const identifier=z.string().uuid();
