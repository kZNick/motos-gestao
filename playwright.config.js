import { defineConfig } from '@playwright/test';
const apiPort=process.env.E2E_API_PORT||'3001',webPort=process.env.E2E_WEB_PORT||'5173';
export default defineConfig({
 testDir:'./tests',workers:1,timeout:60000,use:{baseURL:'http://localhost:'+webPort,trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:[{command:'node backend/src/server.js',url:'http://localhost:'+apiPort+'/api/health',reuseExistingServer:false},{command:'node node_modules/vite/bin/vite.js --config frontend/vite.config.js --host localhost frontend',url:'http://localhost:'+webPort,reuseExistingServer:false}],
 reporter:[['list'],['html',{open:'never'}]]
});
