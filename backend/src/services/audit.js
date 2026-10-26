const secretKeys = new Set(['password','passwordHash','token','sessionVersion','csrfToken']);
export function redact(value) {
 if(value == null) return value;
 if(value instanceof Date) return value.toISOString();
 if(Array.isArray(value)) return value.map(redact);
 if(typeof value === 'object') {
  if(typeof value.toJSON === 'function') return redact(value.toJSON());
  return Object.fromEntries(Object.entries(value).filter(([k])=>!secretKeys.has(k)).map(([k,v])=>[k,redact(v)]));
 }
 return value;
}
export async function audit(tx,req,action,entity,recordId,before,after) {
 await tx.auditLog.create({data:{userId:req.user?.id || null,action,entity,recordId:recordId || null,
  ...(before != null ? {before:redact(before)} : {}), ...(after != null ? {after:redact(after)} : {}),ip:req.ip || null}});
}
