import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',workers:1,timeout:60000,use:{baseURL:'http://localhost:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:[{command:'node backend/src/server.js',url:'http://localhost:3001/api/health',reuseExistingServer:false},{command:'node node_modules/vite/bin/vite.js --config frontend/vite.config.js --host localhost frontend',url:'http://localhost:5173',reuseExistingServer:false}],
 reporter:[['list'],['html',{open:'never'}]]
});
