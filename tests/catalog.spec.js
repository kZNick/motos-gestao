import sharp from 'sharp';
import { test,expect } from '@playwright/test';
import crypto from 'node:crypto';
test('Produto com variações, lotes, preços e baixa de estoque pela interface',async({page})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute pelo script test:local -- --e2e.');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const name='Scooter catálogo '+crypto.randomBytes(4).toString('hex');
 await page.goto('/');await page.getByLabel('E-mail ou nome de usuário',{exact:true}).fill(process.env.E2E_EMAIL);await page.getByLabel('Senha',{exact:true}).fill(process.env.E2E_PASSWORD);await page.getByRole('button',{name:'Entrar no sistema'}).click();
 await page.getByRole('button',{name:/Todas as unidades/}).click();
 await page.getByRole('link',{name:'Motos',exact:true}).click();await page.getByRole('button',{name:'Adicionar produto',exact:true}).click();
 const dialog=page.getByRole('dialog');
 for(const [label,value] of [['Nome do produto',name],['Marca','Duact'],['Modelo','Maxus 1000W'],['Preço inicial (R$)','9999.90'],['Link da foto','/images/duact-maxus-1000w.png']]){const input=dialog.getByLabel(label,{exact:true});if(label==='Tipo de bateria')await input.selectOption(value);else await input.fill(value);}
 await dialog.getByLabel('Unidade',{exact:true}).selectOption({label:'Unidade A de teste'});await dialog.getByRole('button',{name:'Salvar',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.catalog-grid')).toHaveCSS('display','grid');await expect(page.locator('.catalog-item').first()).toHaveCSS('display','block');await page.screenshot({path:'.local/catalog-cards.png',fullPage:true});
 await page.getByRole('link').filter({has:page.getByRole('heading',{name,exact:true})}).click();await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 const productUrl=page.url();
 await expect.poll(()=>page.getByRole('img',{name,exact:true}).evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 for(const [color,battery] of [['Branca','Lítio'],['Azul','Chumbo']]){
  await page.getByRole('button',{name:'Adicionar cor',exact:true}).click();
  for(const [label,value] of [['Versão','1000W'],['Tipo de bateria',battery],['Nome da cor 1',color]]){const input=dialog.getByLabel(label,{exact:true});if(label==='Tipo de bateria')await input.selectOption(value);else await input.fill(value);}
  await dialog.getByRole('button',{name:'Adicionar cor e configuração',exact:true}).click();await expect(dialog).toHaveCount(0);
 }
 await page.getByRole('button',{name:'Adicionar cor',exact:true}).click();
 for(const [label,value] of [['Versão','1000W'],['Tipo de bateria','Chumbo'],['Nome da cor 1','Branca']]){const input=dialog.getByLabel(label,{exact:true});if(label==='Tipo de bateria')await input.selectOption(value);else await input.fill(value);}
 await dialog.getByRole('button',{name:'Adicionar cor e configuração',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Cores da moto'}).getByRole('button')).toHaveCount(2);
 await page.getByRole('button',{name:'Adicionar cor',exact:true}).click();
 const battery=dialog.getByLabel('Tipo de bateria',{exact:true});await expect(battery).toHaveJSProperty('tagName','SELECT');for(const type of ['Chumbo','AGM','Gel','Lítio','Fosfato de ferro-lítio (LiFePO4)','Íons de sódio (Na-ion)'])await expect(battery.locator('option').filter({hasText:type}).first()).toHaveCount(1);
 await dialog.getByLabel('Versão',{exact:true}).fill('1000W');await dialog.getByLabel('Nome da cor 1',{exact:true}).fill('Branca');await battery.selectOption('__other__');await dialog.getByLabel('Outro tipo de bateria',{exact:true}).fill('Pack especial 72V');await dialog.getByRole('button',{name:'Adicionar cor e configuração',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Pack especial 72V');await expect(page.getByLabel('Bateria da variação',{exact:true})).toHaveValue('Pack especial 72V');

 await page.getByRole('button',{name:'Adicionar cor',exact:true}).click();await dialog.getByRole('button',{name:'Branca',exact:true}).click();await dialog.getByRole('button',{name:'Adicionar outra cor',exact:true}).click();await dialog.getByLabel('Nome da cor 2',{exact:true}).fill('Preta');await dialog.getByLabel('Tom da cor 2',{exact:true}).fill('#202124');await dialog.getByLabel('Versão',{exact:true}).fill('1000W');await dialog.getByLabel('Tipo de bateria',{exact:true}).selectOption('Lítio');await dialog.getByRole('button',{name:'Adicionar cor e configuração',exact:true}).click();await expect(dialog).toHaveCount(0);
 const bicolor=page.getByRole('button',{name:'Selecionar cor Branca / Preta',exact:true});await bicolor.click();await expect(bicolor).toHaveAttribute('aria-pressed','true');await expect(bicolor.locator('.paint-swatch')).toHaveCSS('background-image',/linear-gradient/);
 await page.reload();await expect(page.getByRole('button',{name:'Selecionar cor Branca / Preta',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');
 const row=()=>page.getByRole('region',{name:'Configuração selecionada',exact:true});
 // A foto acompanha a configuração, mantém a seleção após salvar e volta ao modelo sem foto específica.
 const photo=page.getByRole('img',{name,exact:true});
 const specificUrl='https://images.example.test/rose.png';
 await page.route(specificUrl,route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCk8AAAAASUVORK5CYII=','base64')}));
 await row().getByRole('button',{name:'Editar configuração',exact:true}).click();
 await dialog.getByLabel('Foto específica (opcional)',{exact:true}).fill(specificUrl);
 await dialog.getByRole('button',{name:'Salvar configuração',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(photo).toHaveAttribute('src',specificUrl);await expect.poll(()=>photo.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Selecionar cor Azul',exact:true}).click();await expect(photo).toHaveAttribute('src','/images/duact-maxus-1000w.png');
 await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');await expect(photo).toHaveAttribute('src',specificUrl);
 await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Chumbo');await expect(photo).toHaveAttribute('src','/images/duact-maxus-1000w.png');
 await page.reload();await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');await expect(photo).toHaveAttribute('src',specificUrl);
 // Upload real: bytes otimizados no PostgreSQL e imagem disponível após recarregar.
 await row().getByRole('button',{name:'Editar configuração',exact:true}).click();
 const uploaded=page.waitForResponse(r=>r.url().includes('/api/images?')&&r.request().method()==='POST');
 await dialog.getByLabel('Enviar foto do computador',{exact:true}).setInputFiles({name:'rose.jpg',mimeType:'image/jpeg',buffer:await sharp({create:{width:2400,height:1800,channels:3,background:'#dd96ae'}}).jpeg().toBuffer()});
 const uploadResponse=await uploaded;expect(uploadResponse.status()).toBe(201);const savedImage=(await uploadResponse.json()).data;expect(savedImage.width).toBe(1600);expect(savedImage.size).toBeLessThanOrEqual(1024*1024);
 await expect(dialog.getByRole('status')).toContainText('Foto salva');await expect(dialog.getByRole('img',{name:'Prévia da foto'})).toBeVisible();
 await dialog.getByRole('img',{name:'Prévia da foto'}).scrollIntoViewIfNeeded();await page.screenshot({path:'.local/photo-upload-desktop.png'});await page.setViewportSize({width:390,height:660});await dialog.getByRole('img',{name:'Prévia da foto'}).scrollIntoViewIfNeeded();await expect(dialog.getByRole('button',{name:'Salvar configuração',exact:true})).toBeInViewport();await page.screenshot({path:'.local/photo-upload-mobile.png'});await page.setViewportSize({width:1280,height:720});
 await dialog.getByRole('button',{name:'Salvar configuração',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(photo).toHaveAttribute('src',savedImage.url);await expect.poll(()=>photo.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await page.reload();await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');await expect(photo).toHaveAttribute('src',savedImage.url);await expect.poll(()=>photo.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Editar produto',exact:true}).click();
 const productUpload=page.waitForResponse(r=>r.url().includes('/api/images?')&&r.request().method()==='POST');
 await dialog.getByLabel('Enviar foto do computador',{exact:true}).setInputFiles({name:'modelo.png',mimeType:'image/png',buffer:await sharp({create:{width:800,height:600,channels:3,background:'#557788'}}).png().toBuffer()});
 const modelImage=(await (await productUpload).json()).data;await expect(dialog.getByRole('status')).toContainText('Foto salva');await dialog.getByRole('button',{name:'Salvar',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(photo).toHaveAttribute('src',savedImage.url);await page.getByRole('button',{name:'Selecionar cor Azul',exact:true}).click();await expect(photo).toHaveAttribute('src',modelImage.url);await expect.poll(()=>photo.evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');await expect(photo).toHaveAttribute('src',savedImage.url);
 await expect(row()).toContainText('0 unidades');
 await row().getByRole('button',{name:'Entrada de lote',exact:true}).click();await dialog.getByLabel('Quantidade recebida').fill('3');await dialog.getByLabel('Custo por moto (R$, opcional)',{exact:true}).fill('7000');await dialog.getByLabel('Código do lote (opcional)',{exact:true}).fill('LOTE_BROWSER_1');await dialog.getByRole('button',{name:'Confirmar entrada'}).click();await expect(dialog).toHaveCount(0);await expect(row()).toContainText('3 unidades');
 await page.getByRole('button',{name:'Alterar preço',exact:true}).first().click();await dialog.getByLabel('Novo preço (R$)',{exact:true}).fill('10499.90');await dialog.getByRole('button',{name:'Aumento de preço',exact:true}).click();await dialog.getByRole('button',{name:'Atualizar preço',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(row()).toContainText('10.499,90');
 await row().getByRole('button',{name:'Entrada de lote',exact:true}).click();await dialog.getByLabel('Quantidade recebida').fill('2');await dialog.getByLabel('Custo por moto (R$, opcional)',{exact:true}).fill('7800');await dialog.getByLabel('Novo preço de venda (R$, opcional)',{exact:true}).fill('10999.90');await dialog.getByLabel('Observações do lote').fill('Fornecedor reajustou o custo');await dialog.getByRole('button',{name:'Confirmar entrada'}).click();await expect(dialog).toHaveCount(0);await expect(row()).toContainText('5 unidades');await expect(row()).toContainText('10.999,90');
 await page.getByRole('tab',{name:'Lotes recebidos',exact:true}).click();await expect(page.getByRole('cell',{name:'LOTE_BROWSER_1',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'R$ 7.800,00',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Histórico de preços',exact:true}).click();await expect(page.getByRole('cell',{name:'Aumento de preço',exact:true}).first()).toBeVisible();
 await page.getByRole('tab',{name:'Variações e estoque',exact:true}).click();await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.local/catalog-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect.poll(async()=>(await page.locator('aside.sidebar').boundingBox()).x).toBeLessThanOrEqual(-239);await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'.local/catalog-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('link',{name:'Vendas',exact:true}).click();await page.getByRole('button',{name:'Nova venda'}).click();
 await dialog.getByLabel('Cliente',{exact:true}).selectOption({label:'Cliente integração · 52998224725'});await expect(dialog.getByLabel('Cliente',{exact:true})).not.toHaveValue('');
 const option=await dialog.getByLabel('Moto disponível').locator('option').filter({hasText:name}).filter({hasText:'Lítio'}).first().textContent();await dialog.getByLabel('Moto disponível').selectOption({label:option});await expect(dialog.getByLabel('Valor negociado (R$)',{exact:true})).toHaveValue('10999.9');const createdSale=page.waitForResponse(r=>r.url().endsWith('/api/sales')&&r.request().method()==='POST',{timeout:10000});await dialog.getByRole('button',{name:'Confirmar venda'}).click();const saleData=await (await createdSale).json();await expect(dialog).toHaveCount(0);
 await page.goto('/sales/'+saleData.data.id);await page.getByRole('button',{name:'Cancelar venda'}).click();await page.getByLabel('Motivo',{exact:true}).fill('Cancelamento do teste de catálogo');await page.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.goto(productUrl);await page.getByRole('button',{name:'Selecionar cor Branca',exact:true}).click();await page.getByLabel('Bateria da variação',{exact:true}).selectOption('Lítio');await expect(row()).toContainText('5 unidades');await page.getByRole('tab',{name:'Movimentações',exact:true}).click();await expect(page.getByRole('cell',{name:'Venda',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Cancelamento de venda',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
