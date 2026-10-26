import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
dotenv.config({quiet:true});
await fs.mkdir('.local',{recursive:true});
const {POSTGRES_USER,POSTGRES_PASSWORD}=process.env;
if(!POSTGRES_USER||!POSTGRES_PASSWORD)throw new Error('Execute npm run setup.');
await fs.writeFile('.local/test-env.json',JSON.stringify({DATABASE_URL:'postgresql://'+POSTGRES_USER+':'+POSTGRES_PASSWORD+'@localhost:5433/motos_test?schema=public',JWT_SECRET:crypto.randomBytes(48).toString('hex'),APP_ORIGIN:'http://localhost:5173',NODE_ENV:'test',PORT:'3001',COOKIE_SECURE:'false'}));
console.log('Banco de testes configurado na porta 5433.');
