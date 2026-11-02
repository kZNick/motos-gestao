import sharp from 'sharp';
import { AppError } from '../lib/business.js';

export const storedImagePath=/^\/api\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export async function optimizeImage(input) {
 if(!Buffer.isBuffer(input)||!input.length)throw new AppError(422,'Selecione uma foto JPG, PNG ou WebP.');
 try {
  const image=sharp(input,{limitInputPixels:40000000,failOn:'error'});
  const metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages||1)>1)throw new Error('format');
  // Re-encode pixels only: removes metadata, applies orientation and keeps transparency.
  const {data,info}=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80,effort:4}).toBuffer({resolveWithObject:true});
  if(data.length>1024*1024)throw new AppError(422,'A foto ficou muito grande. Escolha uma imagem mais simples ou menor.');
  return {data,width:info.width,height:info.height,size:data.length};
 }catch(error){
  if(error instanceof AppError)throw error;
  throw new AppError(422,'Foto inválida. Use JPG, PNG ou WebP, sem animação e até 40 megapixels.');
 }
}

export async function requireImageUnit(tx,url,unitId) {
 const id=url?.match(storedImagePath)?.[1];
 if(id&&!await tx.storedImage.findFirst({where:{id,unitId},select:{id:true}}))throw new AppError(422,'A foto enviada não pertence à unidade deste produto. Envie a foto novamente.');
}
