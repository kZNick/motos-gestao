import bcrypt from 'bcrypt';
import { db } from '../config/db.js';
import { cookieOptions } from '../config/env.js';
import { AppError } from '../lib/business.js';
import { publicUser,issueSession } from '../middlewares/security.js';
import { audit } from '../services/audit.js';
export async function login(req,res) {
 const user=await db.user.findUnique({where:{email:req.body.email},include:{unit:true,managerUnits:{include:{unit:true}}}});
 const allowed=user&&await bcrypt.compare(req.body.password,user.passwordHash);
 if(!allowed || !user.active || (user.role==='VENDEDOR'&&!user.unit?.active)) {
  await audit(db,{...req,user:undefined},'LOGIN_FAILURE','Auth',null,null,{email:req.body.email});
  throw new AppError(401,'E-mail ou senha inválidos, ou acesso desativado.');
 }
 await audit(db,{...req,user},'LOGIN','Auth',user.id);
 const csrfToken=issueSession(res,user); res.json({data:{user:publicUser(user),csrfToken}});
}
export async function logout(req,res) {
 await db.$transaction(async tx=>{
  await tx.user.update({where:{id:req.user.id},data:{sessionVersion:{increment:1}}});
  await audit(tx,req,'LOGOUT','Auth',req.user.id);
 });
 res.clearCookie('session',{...cookieOptions,maxAge:undefined}); res.json({data:{ok:true}});
}
export function me(req,res) { res.json({data:{user:publicUser(req.user),csrfToken:req.session.csrf}}); }
export async function updateProfile(req,res) {
 const {name,phone,password,currentPassword}=req.body;
 if(password && (!currentPassword || !await bcrypt.compare(currentPassword,req.user.passwordHash))) throw new AppError(422,'Senha atual incorreta.');
 const passwordHash=password?await bcrypt.hash(password,12):undefined;
 const user=await db.$transaction(async tx=>{
  const updated=await tx.user.update({where:{id:req.user.id},data:{name,phone,...(passwordHash?{passwordHash,sessionVersion:{increment:1}}:{})},include:{unit:true,managerUnits:{include:{unit:true}}}});
  await audit(tx,req,'UPDATE','User',req.user.id,req.user,updated); return updated;
 });
 res.json({data:{user:publicUser(user),csrfToken:issueSession(res,user)}});
}
