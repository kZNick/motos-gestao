import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
if(!new URL(env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Use apenas banco _test.');
const suffix=crypto.randomUUID(),password=crypto.randomBytes(24).toString('hex')+'A!';
let unit,other,admin,manager,seller,photo,url;
const ids=[];
async function login(role,unitId){
 const user=await db.user.create({data:{name:'Teste fotos',email:crypto.randomUUID()+'@images.test',passwordHash:await bcrypt.hash(password,4),role,mustChangePassword:false,...(role==='VENDEDOR'?{unitId}:{}),...(role==='GERENTE'?{managerUnits:{create:{unitId}}}:{})}});ids.push(user.id);
 const agent=request.agent(app);let r=await agent.post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email:user.email,password});
 r=await agent.post('/api/auth/unit').set('Origin',env.APP_ORIGIN).set('x-csrf-token',r.body.data.csrfToken).send({unitId:role==='ADMIN'?null:unitId});
 return {agent,csrf:r.body.data.csrfToken};
}
const upload=(session,body=photo,unitId=unit.id,type='image/jpeg')=>session.agent.post('/api/images?unitId='+unitId).set('Origin',env.APP_ORIGIN).set('x-csrf-token',session.csrf).set('Content-Type',type).send(body);
before(async()=>{
 const data={address:'Rua A',city:'São Paulo',state:'SP',phone:'11999999999'};
 unit=await db.unit.create({data:{...data,name:'Fotos A',code:'IMG_A_'+suffix}});other=await db.unit.create({data:{...data,name:'Fotos B',code:'IMG_B_'+suffix}});
 admin=await login('ADMIN');manager=await login('GERENTE',unit.id);seller=await login('VENDEDOR',unit.id);
 photo=await sharp({create:{width:2500,height:1800,channels:3,background:'#dd96ae'}}).jpeg().toBuffer();
});
after(async()=>{
 await db.storedImage.deleteMany({where:{unitId:{in:[unit.id,other.id]}}});await db.managerUnit.deleteMany({where:{userId:{in:ids}}});await db.auditLog.deleteMany({where:{userId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});await db.unit.deleteMany({where:{id:{in:[unit.id,other.id]}}});await db.$disconnect();
});
test('Foto otimizada em BYTEA, duplicidade, leitura e isolamento entre unidades',async()=>{
 let r=await upload(admin);assert.equal(r.status,201);url=r.body.data.url;assert.equal(r.body.data.width,1600);assert.ok(r.body.data.size<=1024*1024);assert.equal(r.body.data.originalSize,photo.length);
 const stored=await db.storedImage.findUnique({where:{id:r.body.data.id}});assert.equal(stored.size,stored.data.length);assert.equal((await sharp(stored.data).metadata()).format,'webp');
 assert.equal((await upload(admin)).body.data.id,stored.id);
 r=await manager.agent.get(url);assert.equal(r.status,200);assert.match(r.headers['content-type'],/image\/webp/);assert.match(r.headers['cache-control'],/private/);assert.equal(r.body.length,stored.size);
 assert.equal((await seller.agent.get(url)).status,200);assert.equal((await request(app).get(url)).status,401);
 assert.equal((await upload(seller)).status,403);assert.equal((await upload(manager,photo,other.id)).status,403);
 const otherPhoto=await upload(admin,photo,other.id);assert.equal((await manager.agent.get(otherPhoto.body.data.url)).status,404);
 const payload={name:'Foto unidade errada',brand:'Teste',model:'Teste',basePrice:'9999.90',unitId:unit.id,imageUrl:otherPhoto.body.data.url};
 r=await admin.agent.post('/api/products').set('Origin',env.APP_ORIGIN).set('x-csrf-token',admin.csrf).send(payload);assert.equal(r.status,422);
});
test('Foto inválida, formato não aceito, arquivo grande e ausência de CSRF bloqueados',async()=>{
 assert.equal((await upload(admin,Buffer.from('not an image'))).status,422);
 assert.equal((await upload(admin,Buffer.from('<svg/>'),unit.id,'image/svg+xml')).status,422);
 assert.equal((await upload(admin,Buffer.alloc(8*1024*1024+1))).status,413);
 assert.equal((await admin.agent.post('/api/images?unitId='+unit.id).set('Origin',env.APP_ORIGIN).set('Content-Type','image/jpeg').send(photo)).status,403);
});
