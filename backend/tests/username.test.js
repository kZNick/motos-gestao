import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
if(!new URL(env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Teste de usuário exige banco _test.');
after(async()=>{await db.$disconnect();});
test('Nome de usuário no perfil e login',async t=>{
 const suffix=crypto.randomBytes(4).toString('hex'),password='Teste!'+suffix,username='nick.'+suffix,email='username-'+suffix+'@integration.test';
 const units=await db.unit.findMany({where:{active:true},take:2});assert.ok(units.length===2);
 const user=await db.user.create({data:{name:'Conta username',email,passwordHash:await bcrypt.hash(password,12),role:'GERENTE',mustChangePassword:false,managerUnits:{create:{unitId:units[0].id}}}});
 const agent=request.agent(app);let csrf;
 const login=body=>request(app).post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({password,...body});
 const update=body=>agent.patch('/api/auth/profile').set('Origin',env.APP_ORIGIN).set('x-csrf-token',csrf).send({name:'Conta username',phone:'',...body});
 await t.test('e-mail antigo funciona e permite definir username sem telefone',async()=>{
  const response=await agent.post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({email,password});assert.equal(response.status,200);csrf=response.body.data.csrfToken;assert.equal(response.body.data.user.username,null);
  const saved=await update({username:'  '+username.toUpperCase()+'  '});assert.equal(saved.status,200);csrf=saved.body.data.csrfToken;assert.equal(saved.body.data.user.username,username);assert.equal(saved.body.data.user.phone,'');
 });
 await t.test('entra por username sem diferenciar caixa e continua aceitando e-mail',async()=>{
  const byUsername=await login({identifier:' '+username.toUpperCase()+' '});assert.equal(byUsername.status,200);assert.equal(byUsername.body.data.user.id,user.id);assert.equal(byUsername.body.data.user.passwordHash,undefined);
  assert.equal((await login({identifier:email.toUpperCase()})).status,200);
  assert.equal((await login({identifier:username,password:'errada'})).status,401);
 });
 await t.test('recusa username inválido e duplicado inclusive com caixa diferente',async()=>{
  for(const value of ['a','nome com espaço','outro@email.com','<script>'])assert.equal((await update({username:value})).status,422);
  const other=await db.user.create({data:{name:'Outra conta',email:'other-'+suffix+'@integration.test',username:'ocupado.'+suffix,passwordHash:await bcrypt.hash(password,12),role:'ADMIN',mustChangePassword:false}});
  const duplicated=await update({username:other.username.toUpperCase()});assert.equal(duplicated.status,409);assert.match(duplicated.body.error.message,/nome de usuário já está em uso/);
 });
 await t.test('alterar username mantém senha e revoga o identificador antigo',async()=>{
  const saved=await update({username:username+'.novo'});assert.equal(saved.status,200);csrf=saved.body.data.csrfToken;
  assert.equal((await login({identifier:username})).status,401);assert.equal((await login({identifier:username+'.novo'})).status,200);
 });
 await t.test('login com username mantém ACL e bloqueio de usuário desativado',async()=>{
  const restricted=request.agent(app);const signed=await restricted.post('/api/auth/login').set('Origin',env.APP_ORIGIN).send({identifier:username+'.novo',password});assert.equal(signed.status,200);
  assert.deepEqual(signed.body.data.units.map(u=>u.id),[units[0].id]);
  assert.equal((await restricted.post('/api/auth/unit').set('Origin',env.APP_ORIGIN).set('x-csrf-token',signed.body.data.csrfToken).send({unitId:units[1].id})).status,403);
  await db.user.update({where:{id:user.id},data:{active:false}});assert.equal((await login({identifier:username+'.novo'})).status,401);
 });
});
