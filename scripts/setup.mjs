import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const password=crypto.randomBytes(24).toString('hex'),jwt=crypto.randomBytes(48).toString('hex');
async function create(file,content){try{await fs.writeFile(file,content,{flag:'wx',mode:0o600});console.log(file+' criado.');}catch(e){if(e.code==='EEXIST')console.log(file+' já existe e foi preservado.');else throw e;}}
await create('.env','POSTGRES_USER=motos\nPOSTGRES_PASSWORD='+password+'\nPOSTGRES_DB=motos\nJWT_SECRET='+jwt+'\nAPP_ORIGIN=http://localhost:8080\nCOOKIE_SECURE=false\nNODE_ENV=development\n');
const rootEnv=await fs.readFile('.env','utf8'),read=key=>rootEnv.match(new RegExp('^'+key+'=(.*)$','m'))?.[1];
await create('backend/.env','DATABASE_URL=postgresql://'+read('POSTGRES_USER')+':'+read('POSTGRES_PASSWORD')+'@localhost:5432/'+read('POSTGRES_DB')+'?schema=public\nJWT_SECRET='+read('JWT_SECRET')+'\nAPP_ORIGIN=http://localhost:5173\nPORT=3001\nCOOKIE_SECURE=false\nNODE_ENV=development\n');
console.log('Nenhuma credencial de funcionário foi criada. Execute admin:create para cadastrar o primeiro administrador.');
