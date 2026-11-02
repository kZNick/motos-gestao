import { acl,permissionsFor } from '../config/acl.js';
import bcrypt from 'bcrypt';
import { db } from '../config/db.js';
import { cookieOptions } from '../config/env.js';
import { AppError } from '../lib/business.js';
import { publicUser,issueSession,allowedUnitIds } from '../middlewares/security.js';
import { audit } from '../services/audit.js';
export async function login(req,res) {
 const identifier=req.body.identifier;
 const user=await db.user.findUnique({where:identifier.includes('@')?{email:identifier}:{username:identifier},include:{unit:true,managerUnits:{include:{unit:true}}}});
 const allowed=user&&await bcrypt.compare(req.body.password,user.passwordHash);
 if(!allowed || !user.active) {
  await audit(db,{...req,user:undefined},'LOGIN_FAILURE','Auth',null,null,{identifier});
  throw new AppError(401,'Usuário, e-mail ou senha inválidos, ou acesso desativado.');
 }
 await audit(db,{...req,user},'LOGIN','Auth',user.id);
 const options={rememberMe:req.body.rememberMe};
 const csrfToken=issueSession(res,user,options); res.json({data:await sessionData(user,csrfToken,options)});
}
export async function logout(req,res) {
 await db.$transaction(async tx=>{
  await tx.user.update({where:{id:req.user.id},data:{sessionVersion:{increment:1}}});
  await audit(tx,req,'LOGOUT','Auth',req.user.id);
 });
 res.clearCookie('session',{...cookieOptions,maxAge:undefined}); res.json({data:{ok:true}});
}
async function sessionData(user,csrfToken,session={}) {
 const ids=allowedUnitIds(user);
 const units=await db.unit.findMany({where:{active:true,...(ids===null?{}:{id:{in:ids}})},select:{id:true,name:true,code:true},orderBy:{name:'asc'}});
 return {user:publicUser({...user,selectedUnitId:session.unitId||null}),csrfToken,units,unitSelected:!!session.unitSelected,selectedUnitId:session.unitId||null,permissions:permissionsFor(user.role)};
}
export async function me(req,res) { res.json({data:await sessionData(req.user,req.session.csrf,req.session)}); }
export function access(req,res) { res.json({data:acl}); }
export async function chooseUnit(req,res) {
 const {unitId}=req.body;
 const ids=allowedUnitIds(req.user);
 if(unitId===null && req.user.role!=='ADMIN') throw new AppError(403,'Escolha uma unidade autorizada.');
 if(unitId && (ids!==null&&!ids.includes(unitId) || !await db.unit.findFirst({where:{id:unitId,active:true}}))) throw new AppError(403,'Unidade fora do seu acesso.');
 const options={...req.session,unitId,unitSelected:true};
 const csrfToken=issueSession(res,req.user,options);
 await audit(db,req,'SELECT_UNIT','Auth',req.user.id,null,{unitId});
 res.json({data:await sessionData(req.user,csrfToken,options)});
}
export async function firstPassword(req,res) {
 if(!req.user.mustChangePassword) throw new AppError(409,'A senha já foi atualizada. Use Minha conta.');
 if(await bcrypt.compare(req.body.password,req.user.passwordHash)) throw new AppError(422,'Escolha uma senha diferente da senha inicial.');
 const passwordHash=await bcrypt.hash(req.body.password,12);
 const user=await db.$transaction(async tx=>{
  const updated=await tx.user.update({where:{id:req.user.id},data:{passwordHash,mustChangePassword:false,sessionVersion:{increment:1}},include:{unit:true,managerUnits:{include:{unit:true}}}});
  await audit(tx,req,'FIRST_PASSWORD','User',updated.id); return updated;
 });
 const csrfToken=issueSession(res,user,req.session);
 res.json({data:await sessionData(user,csrfToken,req.session)});
}

export async function updateProfile(req,res) {
 const {name,username,phone,password,currentPassword}=req.body;
 if(password && (!currentPassword || !await bcrypt.compare(currentPassword,req.user.passwordHash))) throw new AppError(422,'Senha atual incorreta.');
 const passwordHash=password?await bcrypt.hash(password,12):undefined;
 const user=await db.$transaction(async tx=>{
  const updated=await tx.user.update({where:{id:req.user.id},data:{name,username,phone,...(passwordHash?{passwordHash,mustChangePassword:false,sessionVersion:{increment:1}}:{})},include:{unit:true,managerUnits:{include:{unit:true}}}});
  await audit(tx,req,'UPDATE','User',req.user.id,req.user,updated); return updated;
 });
 res.json({data:await sessionData(user,issueSession(res,user,req.session),req.session)});
}
