import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const environment=JSON.parse(await fs.readFile('.local/test-env.json','utf8'));
const runtime={...process.env,...environment};
const children=[];
function run(command,args,env=runtime) {
 return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[command,...args],{env,stdio:'inherit'});children.push(child);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(command+' retornou '+code)));});
}
try{
 await run(createRequire(new URL('../backend/package.json',import.meta.url)).resolve('prisma/build/index.js'),['migrate','deploy','--schema','backend/prisma/schema.prisma']);
 await run('backend/tests/business.test.js',[]);
 await run('backend/tests/integration.test.js',[]);
 if(process.argv.includes('--e2e')){
  // Test credentials exist only in this process and in the disposable test database.
  const crypto=await import('node:crypto');
  runtime.E2E_PASSWORD=crypto.randomBytes(24).toString('base64url');
  runtime.E2E_EMAIL='browser@e2e.test';
  await run('scripts/e2e-bootstrap.mjs',[]);
  await run('node_modules/@playwright/test/cli.js',['test']);
 }
}catch(e){console.error(e.message);process.exitCode=1;}
