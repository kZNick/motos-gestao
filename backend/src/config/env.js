import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const secure = process.env.COOKIE_SECURE === 'true';
export const env = z.object({
 DATABASE_URL: z.string().min(1),
 JWT_SECRET: z.string().min(32),
 APP_ORIGIN: z.string().url().default('http://localhost:5173'),
 PORT: z.coerce.number().default(3001),
 NODE_ENV: z.enum(['development','test','production']).default('development')
}).parse(process.env);
if(env.NODE_ENV === 'production' && (!secure || !env.APP_ORIGIN.startsWith('https://'))) throw new Error('Produção exige HTTPS e COOKIE_SECURE=true.');
export const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/api', maxAge: 8 * 60 * 60 * 1000 };
