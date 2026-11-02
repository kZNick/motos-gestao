import { acl } from '../config/acl.js';
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
  if(!user || !user.active || user.sessionVersion!==payload.ver || (user.role==='VENDEDOR' && !user.unit?.active && payload.unitSelected)) throw new Error();
  if(payload.unitId && !(await db.unit.findFirst({where:{id:payload.unitId,active:true}}))) throw new Error();
  if(payload.unitId && allowedUnitIds(user)!==null && !allowedUnitIds(user).includes(payload.unitId)) throw new Error();
  req.user={...user,selectedUnitId:payload.unitId||null}; req.session=payload; next();
 } catch { next(new AppError(401,'Sua sessão expirou. Entre novamente.')); }
}
export const authorize = (...roles) => (req,res,next) => roles.includes(req.user.role) ? next() : next(new AppError(403,'Você não tem permissão para esta operação.'));
export const permit=key=>authorize(...acl.find(p=>p.key===key).roles);
export function csrf(req,res,next) {
 if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();
 if(req.get('origin')!==env.APP_ORIGIN) return next(new AppError(403,'Origem da requisição não autorizada.'));
 if(req.path==='/auth/login') return next();
 const a=Buffer.from(req.get('x-csrf-token') || ''),b=Buffer.from(req.session?.csrf || '');
 if(!a.length || a.length!==b.length || !crypto.timingSafeEqual(a,b)) return next(new AppError(403,'Recarregue a página para renovar a proteção da sessão.'));
 next();
}
export function issueSession(res,user,options={}) {
 const csrf=crypto.randomBytes(32).toString('hex');
 const rememberMe=!!options.rememberMe;
 const token=jwt.sign({ver:user.sessionVersion,csrf,rememberMe,unitId:options.unitId||null,unitSelected:!!options.unitSelected},env.JWT_SECRET,{subject:user.id,expiresIn:rememberMe?'30d':'8h',algorithm:'HS256',issuer:'motos-gestao',audience:'employees'});
 const {maxAge,...sessionCookie}=cookieOptions;
 res.cookie('session',token,rememberMe?{...sessionCookie,maxAge:30*24*60*60*1000}:sessionCookie);
 return csrf;
}
export function allowedUnitIds(user) {
 if(user.role==='ADMIN') return null;
 if(user.role==='VENDEDOR') return user.unit?.active ? [user.unitId] : [];
 return user.managerUnits.filter(x=>x.unit.active).map(x=>x.unitId);
}
export function unitIds(user) {
 const allowed=allowedUnitIds(user);
 return user.selectedUnitId ? (allowed===null || allowed.includes(user.selectedUnitId) ? [user.selectedUnitId] : []) : allowed;
}
export function unitScope(user) { const ids=unitIds(user); return ids===null ? {} : {unitId:{in:ids}}; }
export function saleScope(user) { return {...unitScope(user),...(user.role==='VENDEDOR'?{sellerId:user.id}:{})}; }
export function customerScope(user) {
 if(user.role==='ADMIN') return unitScope(user);
 if(user.role==='VENDEDOR') return {AND:[unitScope(user),{OR:[{createdById:user.id},{sales:{some:saleScope(user)}}]}]};
 return {OR:[unitScope(user),{sales:{some:saleScope(user)}}]};
}
export function requireUnit(user,id) {
 const ids=unitIds(user); if(ids!==null && !ids.includes(id)) throw new AppError(403,'Unidade fora do seu acesso.');
}
