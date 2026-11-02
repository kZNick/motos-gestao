import crypto from 'node:crypto';
import { db } from '../config/db.js';
import { requireUnit,unitScope } from '../middlewares/security.js';
import { AppError } from '../lib/business.js';
import { optimizeImage } from '../services/images.js';

export async function upload(req,res) {
 const unitId=req.query.unitId;
 if(!unitId)throw new AppError(422,'Escolha a unidade antes de enviar a foto.');
 requireUnit(req.user,unitId);
 if(!await db.unit.findFirst({where:{id:unitId,active:true},select:{id:true}}))throw new AppError(422,'Escolha uma unidade ativa.');
 const image=await optimizeImage(req.body);
 const hash=crypto.createHash('sha256').update(image.data).digest('hex');
 const saved=await db.storedImage.upsert({where:{unitId_hash:{unitId,hash}},create:{unitId,hash,...image},update:{},select:{id:true,width:true,height:true,size:true}});
 res.status(201).json({data:{...saved,url:'/api/images/'+saved.id,originalSize:req.body.length}});
}

export async function read(req,res) {
 const image=await db.storedImage.findFirst({where:{id:req.params.id,...unitScope(req.user)}});
 // Always authenticate and check the unit before allowing cache revalidation.
 res.set('Cache-Control','private, no-cache');
 res.vary('Cookie');
 if(!image)throw new AppError(404,'Foto não encontrada.');
 res.set('ETag','"'+image.hash+'"');
 res.type('image/webp').send(Buffer.from(image.data));
}
