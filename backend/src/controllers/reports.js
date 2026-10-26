import { db } from '../config/db.js';
import { saleScope,customerScope,unitScope } from '../middlewares/security.js';
import { period,list,search } from '../lib/query.js';
import { today,effectiveStatus } from '../lib/business.js';
export async function dashboard(req,res) {
 const scope={AND:[saleScope(req.user),{unitId:req.query.unitId||undefined}]};
 const salesScope={AND:[scope,{soldAt:period(req.query),status:'ATIVA'}]};
 const now=today(),soon=new Date(now);soon.setUTCDate(soon.getUTCDate()+7);
 const [saleCount,customerCount,availableCount,overdueCount,upcomingCount,recent,upcoming,overdue,groups,unitGroups,sellerGroups]=await Promise.all([
  db.sale.count({where:salesScope}),
  db.customer.count({where:{AND:[customerScope(req.user),{unitId:req.query.unitId||undefined,createdAt:period(req.query),active:true}]}}),
  db.motorcycle.count({where:{AND:[unitScope(req.user),{unitId:req.query.unitId||undefined,status:'DISPONIVEL'}]}}),
  db.installment.count({where:{sale:scope,status:'PENDENTE',dueAt:{lt:now}}}),
  db.installment.count({where:{sale:scope,status:'PENDENTE',dueAt:{gte:now,lte:soon}}}),
  db.sale.findMany({where:salesScope,take:5,orderBy:{soldAt:'desc'},include:{customer:true,motorcycle:true,unit:true}}),
  db.installment.findMany({where:{sale:scope,status:'PENDENTE',dueAt:{gte:now,lte:soon}},take:5,orderBy:{dueAt:'asc'},include:{sale:{include:{customer:true}}}}),
  db.installment.findMany({where:{sale:scope,status:'PENDENTE',dueAt:{lt:now}},take:5,orderBy:{dueAt:'asc'},include:{sale:{include:{customer:true}}}}),
  db.sale.groupBy({by:['soldAt'],where:salesScope,_count:true,orderBy:{soldAt:'asc'}}),
  db.sale.groupBy({by:['unitId'],where:salesScope,_count:true}),
  db.sale.groupBy({by:['sellerId'],where:salesScope,_count:true})
 ]);
 const months={};for(const g of groups){const key=g.soldAt.toISOString().slice(0,7);months[key]=(months[key]||0)+g._count;}
 const units=await db.unit.findMany({where:{id:{in:unitGroups.map(g=>g.unitId)}},select:{id:true,name:true}});
 const users=await db.user.findMany({where:{id:{in:sellerGroups.map(g=>g.sellerId)}},select:{id:true,name:true}});
 res.json({data:{saleCount,customerCount,availableCount,overdueCount,upcomingCount,recent,
  upcoming:upcoming.map(i=>({...i,status:effectiveStatus(i)})),overdue:overdue.map(i=>({...i,status:effectiveStatus(i)})),
  months:Object.entries(months).map(([month,count])=>({month,count})),
  byUnit:unitGroups.map(g=>({name:units.find(u=>u.id===g.unitId)?.name,count:g._count})),
  bySeller:sellerGroups.map(g=>({name:users.find(u=>u.id===g.sellerId)?.name,count:g._count}))
 }});
}
export async function logs(req,res) {
 const range=period(req.query); if(range?.lte){range.lte=new Date(range.lte.getTime()+86399999);}
 res.json(await list(db.auditLog,req,{userId:req.query.userId||undefined,action:search(req.query.action)||undefined,entity:search(req.query.entity)||undefined,createdAt:range},{user:{select:{id:true,name:true,email:true}}}));
}
