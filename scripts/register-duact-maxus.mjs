// Idempotent registration of the product requested by the owner. No physical stock is invented.
import '../backend/src/config/env.js';
import { db } from '../backend/src/config/db.js';
const colors=['Branca','Nardo Grey','Marrom','Azul','Vermelha','Prata','Preta Brilho','Preta Fosca','Preta Dark','Rose','Grafite','Verde'];
const batteryTypes=['Lítio','Chumbo'];
try{
 const result=await db.$transaction(async tx=>{
  const admin=await tx.user.findFirst({where:{role:'ADMIN',active:true},select:{id:true}});
  let unit=await tx.unit.findFirst({where:{OR:[{code:{equals:'ACLS',mode:'insensitive'}},{name:{equals:'ACLS',mode:'insensitive'}}]}});
  if(!unit){unit=await tx.unit.create({data:{name:'ACLS',code:'ACLS',address:'',city:'',state:'',phone:''}});await tx.auditLog.create({data:{userId:admin?.id,action:'CREATE',entity:'Unit',recordId:unit.id,after:{name:'ACLS',detailsPending:true}}});}
  const name='Scooter Elétrica Duact Maxus 1000W';
  let product=await tx.product.findUnique({where:{unitId_name:{unitId:unit.id,name}}});
  let created=false;
  if(!product){
   product=await tx.product.create({data:{name,brand:'Duact',model:'Maxus 1000W',unitId:unit.id,basePrice:'9999.90',imageUrl:'/images/duact-maxus-1000w.png',colors,batteryTypes,versions:['1000W'],description:'Scooter elétrica Duact Maxus com motor de 1000W. Cores e tipos de bateria conforme catálogo Duact (https://www.duact.com.br/), consultado em 02/11/2026. A foto enviada é uma referência do modelo. Confirme os lotes recebidos antes de informar as quantidades.'}});
   await tx.productVariant.createMany({data:colors.flatMap(color=>batteryTypes.map(batteryType=>({productId:product.id,color,batteryType,version:'1000W'})))});
   await tx.auditLog.create({data:{userId:admin?.id,action:'CREATE',entity:'Product',recordId:product.id,after:{name,unit:'ACLS',basePrice:'9999.90',colors,batteryTypes,variants:24,physicalStock:0,source:'https://www.duact.com.br/'}}});created=true;
  }
  return {unit:unit.name,product:product.name,id:product.id,created,variants:await tx.productVariant.count({where:{productId:product.id}}),stock:await tx.motorcycle.count({where:{variant:{productId:product.id},status:'DISPONIVEL'}})};
 });console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
