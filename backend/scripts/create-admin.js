import '../src/config/env.js';
import { db } from '../src/config/db.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { audit } from '../src/services/audit.js';
import { createInterface } from 'node:readline/promises';
async function hiddenPassword() {
 if(!process.stdin.isTTY)throw new Error('Em execução não interativa, defina ADMIN_PASSWORD no ambiente.');
 process.stdout.write('Senha (mínimo 10 caracteres; entrada oculta): ');
 process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{
  let value='';
  const finish=(error)=>{process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
  const read=chunk=>{
   for(const char of chunk.toString('utf8')){
    if(char==='\u0003'){finish(new Error('Criação interrompida.'));return;}
    if(char==='\r'||char==='\n'){finish();return;}
    if(char==='\u007f'||char==='\b')value=Array.from(value).slice(0,-1).join('');
    else if(char>=' ')value+=char;
   }
  };
  process.stdin.on('data',read);
 });
}
const input=createInterface({input:process.stdin,output:process.stdout});
try {
 const name=process.env.ADMIN_NAME || await input.question('Nome do administrador: ');
 const email=(process.env.ADMIN_EMAIL || await input.question('E-mail: ')).toLowerCase();
 input.close();
 const password=process.env.ADMIN_PASSWORD || await hiddenPassword();
 z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(10).max(72).refine(v=>Buffer.byteLength(v)<=72)}).parse({name,email,password});
 const passwordHash=await bcrypt.hash(password,12);
 await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(918273)`;
  if(await tx.user.count({where:{role:'ADMIN',active:true}})) throw new Error('Já existe administrador ativo. Use a interface para criar outros funcionários.');
  const user=await tx.user.create({data:{name,email,passwordHash,role:'ADMIN'}});
  await audit(tx,{ip:null},'BOOTSTRAP','User',user.id,null,{name,email,role:'ADMIN'});
 });
 console.log('Administrador criado.');
} catch(e) { console.error(e.message); process.exitCode=1; } finally {input.close();await db.$disconnect();}
