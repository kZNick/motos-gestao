import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { env,cookieOptions } from '../config/env.js';
import { AppError } from '../lib/business.js';
export const publicUser = u => {
 const {passwordHash,sessionVersion,...rest}=u;
 return rest;
};
export async function authenticate(req,res,next) {
 try {
  const payload=jwt.verify(req.cookies.session || '',env.JWT_SECRET,{algorithms:['HS256'],issuer:'motos-gestao',audience:'employees'});
  const user=await db.user.findUnique({where:{id:payload.sub},include:{unit:true,managerUnits:{include:{unit:true}}}});
  if(!user || !user.active || user.sessionVersion!==payload.ver || (user.role==='VENDEDOR' && !user.unit?.active)) throw new Error();
  req.user=user; req.session=payload; next();
 } catch { next(new AppError(401,'Sua sessão expirou. Entre novamente.')); }
}
export const authorize = (...roles) => (req,res,next) => roles.includes(req.user.role) ? next() : next(new AppError(403,'Você não tem permissão para esta operação.'));
export function csrf(req,res,next) {
 if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
 if(req.get('origin')!==env.APP_ORIGIN) return next(new AppError(403,'Origem da requisição não autorizada.'));
 if(req.path==='/auth/login') return next();
 const a=Buffer.from(req.get('x-csrf-token') || ''),b=Buffer.from(req.session?.csrf || '');
 if(!a.length || a.length!==b.length || !crypto.timingSafeEqual(a,b)) return next(new AppError(403,'Recarregue a página para renovar a proteção da sessão.'));
 next();
}
export function issueSession(res,user) {
 const csrf=crypto.randomBytes(32).toString('hex');
 const token=jwt.sign({ver:user.sessionVersion,csrf},env.JWT_SECRET,{subject:user.id,expiresIn:'8h',algorithm:'HS256',issuer:'motos-gestao',audience:'employees'});
 res.cookie('session',token,cookieOptions);
 return csrf;
}
export function unitIds(user) {
 if(user.role==='ADMIN') return null;
 if(user.role==='VENDEDOR') return user.unit?.active ? [user.unitId] : [];
 return user.managerUnits.filter(x=>x.unit.active).map(x=>x.unitId);
}
export function unitScope(user) { const ids=unitIds(user); return ids===null ? {} : {unitId:{in:ids}}; }
export function saleScope(user) { return {...unitScope(user),...(user.role==='VENDEDOR'?{sellerId:user.id}:{})}; }
export function customerScope(user) {
 if(user.role==='ADMIN') return {};
 if(user.role==='VENDEDOR') return {OR:[{createdById:user.id,...unitScope(user)},{sales:{some:saleScope(user)}}]};
 return {OR:[unitScope(user),{sales:{some:saleScope(user)}}]};
}
export function requireUnit(user,id) {
 const ids=unitIds(user); if(ids!==null && !ids.includes(id)) throw new AppError(403,'Unidade fora do seu acesso.');
}
