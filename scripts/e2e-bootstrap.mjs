import { db } from '../backend/src/config/db.js';
import bcrypt from 'bcrypt';

if(!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('E2E exige banco _test.');
const email=process.env.E2E_EMAIL,passwordHash=await bcrypt.hash(process.env.E2E_PASSWORD,12);
await db.user.upsert({where:{email},create:{name:'Equipe E2E',email,passwordHash,role:'ADMIN'},update:{active:true,passwordHash}});
await db.$disconnect();
