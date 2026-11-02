import { test,expect } from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
async function enter(page,username){
 const passwords=JSON.parse(await fs.readFile('.local/demo-test-credentials.json','utf8'));
 await page.goto('/');await page.getByLabel('E-mail ou nome de usuário',{exact:true}).fill(username);await page.getByLabel('Senha',{exact:true}).fill(passwords[username]);await page.getByRole('button',{name:'Entrar no sistema'}).click();
 await expect(page.getByRole('heading',{name:'Crie sua nova senha'})).toBeVisible();const password='Teste!'+crypto.randomBytes(10).toString('hex')+'A';await page.getByLabel('Nova senha',{exact:true}).fill(password);await page.getByLabel('Confirmar nova senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await page.getByRole('button').filter({has:page.getByText('Unidade Teste · Demonstração',{exact:true})}).click();await expect(page.locator('.workspace main h1')).toBeVisible();
}
test('Demonstração: administrador e gerente entram com seus cargos e unidade',async({browser})=>{
 test.skip(!process.env.E2E_DEMO,'Use o verificador de demonstração.');
 for(const [username,admin] of [['demo_admin',true],['demo_gerente',false]]){const context=await browser.newContext(),page=await context.newPage();await enter(page,username);await expect(page.getByRole('link',{name:'Funcionários',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Auditoria',exact:true})).toHaveCount(admin?1:0);await expect(page.locator('.unit-switch')).toContainText('Unidade Teste');await context.close();}
});
test('Vendedor registra vendas com todos os cálculos e ajustes de parcela',async({page})=>{
 test.skip(!process.env.E2E_DEMO,'Use o verificador de demonstração.');test.setTimeout(90000);await enter(page,'demo_vendedor');await expect(page.getByRole('link',{name:'Funcionários',exact:true})).toHaveCount(0);
 for(const [mode,value,total] of [['NONE','0','1000'],['PERCENT','10','1100'],['AMOUNT','50','1050'],['INSTALLMENT','300','1200']]){
  await page.goto('/sales');await page.getByRole('button',{name:'Nova venda',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Cliente',{exact:true}).selectOption({index:1});await dialog.getByLabel('Moto disponível',{exact:true}).selectOption({index:1});await dialog.getByLabel('Valor negociado (R$)',{exact:true}).fill('1000');await dialog.getByLabel('Pagamento',{exact:true}).selectOption('parcelado');await dialog.getByLabel('Quantidade de parcelas',{exact:true}).fill('4');await dialog.getByLabel('Juros / ajuste das parcelas',{exact:true}).selectOption(mode);
  if(mode!=='NONE')await dialog.getByLabel(mode==='PERCENT'?'Juros sobre o total (%)':mode==='AMOUNT'?'Juros sobre o total (R$)':'Valor de cada parcela (R$)',{exact:true}).fill(value);
  await expect(dialog.locator('.sale-footer strong')).toContainText('R$ '+Number(total).toLocaleString('pt-BR',{minimumFractionDigits:2}));
  if(mode==='PERCENT'||mode==='INSTALLMENT'){if(mode==='INSTALLMENT')await page.setViewportSize({width:390,height:660});await dialog.locator('.financing-summary').scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Confirmar venda'})).toBeInViewport();const fieldBox=await dialog.locator('.sale-fields').boundingBox(),footerBox=await dialog.locator('.sale-footer').boundingBox();expect(fieldBox.y+fieldBox.height).toBeLessThanOrEqual(footerBox.y);await page.screenshot({path:'.local/financing-'+mode+'.png'});}
  const response=page.waitForResponse(r=>r.url().endsWith('/api/sales')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Confirmar venda',exact:true}).click();const r=await response;expect(r.status()).toBe(201);const sale=(await r.json()).data;expect(Number(sale.total)).toBe(Number(total));expect(sale.financing.mode).toBe(mode);expect(sale.installments.reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0)).toBe(Number(total)*100);await expect(dialog).toHaveCount(0);
  await page.goto('/sales/'+sale.id);await expect(page.getByText('Juros / acréscimo',{exact:true})).toBeVisible();await page.setViewportSize({width:1280,height:800});
 }
});
