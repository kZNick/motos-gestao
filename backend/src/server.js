import { app } from './app.js';
import { db } from './config/db.js';
import { env } from './config/env.js';
await db.$connect();
const server=app.listen(env.PORT,()=>console.log('API disponível na porta '+env.PORT));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await db.$disconnect();process.exit(0);}));
