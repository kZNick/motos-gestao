import { test,expect } from '@playwright/test';
import crypto from 'node:crypto';
async function login(page,email=process.env.E2E_EMAIL,password=process.env.E2E_PASSWORD){await page.goto('/');await page.getByLabel('E-mail ou nome de usuário',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar no sistema'}).click();}
function cpf(){const xs=Array.from({length:9},()=>crypto.randomInt(0,10));for(const n of [10,11]){let d=11-xs.reduce((sum,x,i)=>sum+x*(n-i),0)%11;xs.push(d>=10?0:d);}return xs.join('');}
test('Cartões por permissão e aviso para usuário sem unidade',async({page,baseURL})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute pelo runner local.');
 await login(page);await expect(page.getByRole('heading',{name:'Escolha uma unidade',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Unidade A de teste/})).toBeVisible();await expect(page.getByRole('button',{name:/Unidade B de teste/})).toBeVisible();await expect(page.getByRole('combobox')).toHaveCount(0);
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'.local/unit-cards-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/unit-cards-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:900});
 await page.getByRole('button',{name:/Todas as unidades/}).click();await expect(page.getByRole('heading',{name:'Olá, Equipe.'})).toBeVisible();
 const session=(await (await page.request.get('/api/auth/me')).json()).data;
 const unit=session.units.find(u=>u.name==='Unidade A de teste'),suffix=crypto.randomBytes(4).toString('hex'),password='Inicio!'+suffix;
 const managerEmail='cards-'+suffix+'@e2e.test',waitingEmail='waiting-'+suffix+'@e2e.test';
 const headers={Origin:new URL(baseURL).origin,'x-csrf-token':session.csrfToken};
 for(const data of [{name:'Usuário com unidade',email:managerEmail,role:'GERENTE',managerUnitIds:[unit.id]},{name:'Usuário aguardando',email:waitingEmail,role:'VENDEDOR',unitId:null}]){const response=await page.request.post('/api/users',{headers,data:{...data,phone:'11999999999',password}});expect(response.status()).toBe(201);}
 await page.getByRole('button',{name:'Sair',exact:true}).click();await login(page,managerEmail,password);
 await page.getByLabel('Nova senha',{exact:true}).fill(password+'Nova!');await page.getByLabel('Confirmar nova senha',{exact:true}).fill(password+'Nova!');await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('heading',{name:'Suas unidades',exact:true})).toBeVisible();await expect(page.locator('.unit-card')).toHaveCount(1);await expect(page.getByRole('button',{name:/Unidade B de teste/})).toHaveCount(0);await expect(page.getByRole('button',{name:/Todas as unidades/})).toHaveCount(0);await page.getByRole('button',{name:/Unidade A de teste/}).click();
 await page.getByRole('button',{name:'Sair',exact:true}).click();await login(page,waitingEmail,password);await expect(page.getByRole('heading',{name:'Você ainda não tem uma unidade',exact:true})).toBeVisible();await expect(page.getByText('Fale com o responsável para liberar seu acesso.',{exact:false})).toBeVisible();await expect(page.locator('.unit-card')).toHaveCount(0);await expect(page.getByRole('navigation')).toHaveCount(0);await page.screenshot({path:'.local/unit-no-access.png',fullPage:true});
});
test('Cadastrar cliente dentro da venda preserva moto, preço e pagamento',async({page})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute pelo runner local.');
 await login(page);await page.getByRole('button',{name:/Todas as unidades/}).click();await page.getByRole('link',{name:'Vendas',exact:true}).click();await page.getByRole('button',{name:'Nova venda',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Quantidade de parcelas')).toHaveCount(0);
 const motoSelect=dialog.getByLabel('Moto disponível',{exact:true});const selected=await motoSelect.locator('option[value^="variant:"]').first().getAttribute('value');await motoSelect.selectOption(selected);const price=await dialog.getByLabel('Valor negociado (R$)',{exact:true}).inputValue();
 await dialog.getByLabel('Pagamento',{exact:true}).selectOption('parcelado');await dialog.getByLabel('Quantidade de parcelas').fill('3');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.local/sale-simple-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/sale-simple-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await dialog.getByRole('button',{name:'Cadastrar cliente',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Cadastrar cliente',exact:true})).toBeVisible();
 const name='Cliente rápido '+crypto.randomBytes(4).toString('hex');await dialog.getByLabel('Nome completo',{exact:false}).fill(name);await dialog.getByLabel('CPF',{exact:false}).fill(cpf());await dialog.getByLabel('Telefone',{exact:false}).fill('11999999999');await expect(dialog.getByLabel('Unidade',{exact:false})).not.toHaveValue('');
 await page.route('**/api/address/01001000',route=>route.fulfill({json:{logradouro:'Praça da Sé',bairro:'Sé',localidade:'São Paulo',uf:'SP'}}));
 await dialog.getByLabel('E-mail',{exact:true}).fill('cliente@e2e.test');await dialog.getByLabel('CEP',{exact:true}).fill('01001000');await dialog.getByLabel('Número',{exact:true}).fill('100');await expect(dialog.getByLabel('Cidade',{exact:true})).toHaveValue('São Paulo');await dialog.getByLabel('Complemento',{exact:true}).fill('Sala 2');await dialog.getByLabel('Observações',{exact:true}).fill('Cadastro completo durante a venda');
 await page.screenshot({path:'.local/customer-complete-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:660});const saveClient=dialog.getByRole('button',{name:'Salvar cliente e voltar',exact:true});await expect(saveClient).toBeInViewport();await dialog.getByLabel('CEP',{exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByLabel('CEP',{exact:true})).toBeInViewport();await dialog.getByLabel('Estado (UF)',{exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByLabel('Estado (UF)',{exact:true})).toBeInViewport();await expect(saveClient).toBeInViewport();const clientBox=await dialog.boundingBox();expect(clientBox.x).toBeGreaterThanOrEqual(0);expect(clientBox.y+clientBox.height).toBeLessThanOrEqual(660);await page.screenshot({path:'.local/customer-complete-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const savedClient=page.waitForResponse(r=>r.url().endsWith('/api/customers')&&r.request().method()==='POST');await saveClient.click();const customerResponse=await savedClient;expect(customerResponse.status()).toBe(201);const customer=(await customerResponse.json()).data;expect(customer.zip).toBe('01001000');expect(customer.street).toBe('Praça da Sé');expect(customer.number).toBe('100');expect(customer.neighborhood).toBe('Sé');expect(customer.city).toBe('São Paulo');expect(customer.state).toBe('SP');expect(customer.email).toBe('cliente@e2e.test');
 await expect(dialog.getByLabel('Cliente',{exact:true}).locator('option:checked')).toHaveText(new RegExp(name));await expect(motoSelect).toHaveValue(selected);await expect(dialog.getByLabel('Valor negociado (R$)',{exact:true})).toHaveValue(price);await expect(dialog.getByLabel('Pagamento',{exact:true})).toHaveValue('parcelado');await expect(dialog.getByLabel('Quantidade de parcelas')).toHaveValue('3');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/sales')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Confirmar venda'}).click();expect((await response).status()).toBe(201);await expect(dialog).toHaveCount(0);
});

test('Modal sem estoque mantém alinhamento e bloqueia confirmação',async({page})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute pelo runner local.');
 await login(page);await page.getByRole('button',{name:/Todas as unidades/}).click();await page.getByRole('link',{name:'Vendas',exact:true}).click();
 await page.route('**/api/variants?**',route=>route.fulfill({json:{data:[],meta:{page:1,total:0,pages:1}}}));await page.route('**/api/motorcycles?**',route=>route.fulfill({json:{data:[],meta:{page:1,total:0,pages:1}}}));
 await page.getByRole('button',{name:'Nova venda',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByText('Não há motos disponíveis nesta unidade.',{exact:false})).toBeVisible();await expect(dialog.getByRole('button',{name:'Confirmar venda',exact:true})).toBeDisabled();
 await expect(dialog.locator('.sale-customer-select>div')).toHaveCSS('display','grid');await expect(dialog.locator('.sale-footer')).toHaveCSS('justify-content','space-between');await expect(dialog.locator('.sale-footer>div')).toHaveCSS('flex-direction','column');
 await page.screenshot({path:'.local/sale-fixed-empty-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:660});await expect(dialog.getByRole('button',{name:'Confirmar venda',exact:true})).toBeInViewport();await page.screenshot({path:'.local/sale-fixed-empty-mobile.png',fullPage:true});
});
