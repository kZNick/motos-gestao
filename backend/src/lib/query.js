import { z } from 'zod';
import { dateOnly } from './business.js';
export function pagination(req) {
 const schema=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)});
 const {page,limit}=schema.parse(req.query); return {page,limit,skip:(page-1)*limit,take:limit};
}
export async function list(model,req,where,include,orderBy={createdAt:'desc'},map=x=>x) {
 const {page,limit,skip,take}=pagination(req);
 const [items,total]=await Promise.all([model.findMany({where,include,orderBy,skip,take}),model.count({where})]);
 return {data:items.map(map),meta:{page,limit,total,pages:Math.ceil(total/limit)}};
}
export function period(query,start='from',end='to') {
 const result={};
 if(query[start]) result.gte=dateOnly(query[start]);
 if(query[end]) result.lte=dateOnly(query[end]);
 return Object.keys(result).length ? result : undefined;
}
export const search=q=> typeof q==='string' ? q.trim().slice(0,200) : '';
export function enumFilter(value,values) { return value ? z.enum(values).parse(value) : undefined; }
export function boolFilter(value) { return value===undefined || value==='' ? undefined : z.enum(['true','false']).transform(v=>v==='true').parse(value); }
