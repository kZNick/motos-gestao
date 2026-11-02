import { test,expect } from '@playwright/test';
async function signIn(page){await page.goto('/');await page.getByLabel('E-mail ou nome de usuário',{exact:true}).fill(process.env.E2E_EMAIL);await page.getByLabel('Senha',{exact:true}).fill(process.env.E2E_PASSWORD);await page.getByRole('button',{name:'Entrar no sistema'}).click();await page.getByRole('button',{name:/Todas as unidades/}).click();await expect(page.getByRole('heading',{name:'Olá, Equipe.'})).toBeVisible();}
const routes=['/','/sales','/installments','/customers','/motorcycles','/units','/users','/audit','/access','/account'];
test('Telas sem overflow e filtros alinhados em três resoluções',async({page})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute com ambiente de teste.');test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await signIn(page);
 for(const [width,height] of [[1900,1000],[1280,800],[390,844]]){
  await page.setViewportSize({width,height});
  for(const route of routes){
   await page.goto(route);await expect(page.locator('.workspace main h1').first()).toBeVisible();await expect(page.locator('.workspace main .spin')).toHaveCount(0);
   if(width<950)await expect.poll(async()=>(await page.locator('.sidebar').boundingBox()).x).toBeLessThanOrEqual(-239);
   const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,controls:[...document.querySelectorAll('.filter-bar .filter-field')].map(field=>{const control=field.querySelector('.search')||field.querySelector('select,input');if(!control)return null;const a=control.getBoundingClientRect(),b=field.getBoundingClientRect();return {height:a.height,bottomDelta:Math.abs(a.bottom-b.bottom)};}).filter(Boolean)}));
   expect(result.overflow,route+' em '+width).toBe(false);for(const control of result.controls){expect(Math.abs(control.height-44),route+' altura').toBeLessThanOrEqual(1);expect(control.bottomDelta,route+' alinhamento').toBeLessThanOrEqual(1);}
   if(['/sales','/users','/audit','/'].includes(route))await page.screenshot({path:'.local/layout-'+(route.slice(1)||'dashboard')+'-'+width+'.png',fullPage:true});
  }
 }
 expect(errors).toEqual([]);
});
async function modalFits(page){const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();const size=page.viewportSize(),box=await dialog.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);await expect(dialog.locator('.modal-content')).toBeVisible();const horizontal=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(horizontal).toBe(false);}
test('Modais de cadastro, configuração e venda com ações acessíveis',async({page})=>{
 test.skip(!process.env.E2E_PASSWORD,'Execute com ambiente de teste.');test.setTimeout(120000);await signIn(page);
 for(const [width,height] of [[1280,800],[390,660]]){
  await page.setViewportSize({width,height});
  for(const [route,button,key] of [['/customers','Cadastrar cliente','customer'],['/units','Cadastrar unidade','unit'],['/users','Cadastrar funcionário','user'],['/motorcycles','Adicionar produto','product'],['/sales','Nova venda','sale']]){
   await page.goto(route);await expect(page.locator('.workspace main h1').first()).toBeVisible();if(width<950)await page.getByRole('button',{name:'Abrir menu'}).click();
   // The action is in the workspace; close an opened navigation overlay before clicking it.
   if(width<950)await page.getByRole('button',{name:'Fechar menu'}).click({position:{x:width-8,y:8}});
   await page.getByRole('button',{name:button,exact:true}).click();await modalFits(page);
   const dialog=page.getByRole('dialog'),footer=dialog.locator('form>footer').last();await expect(footer).toBeInViewport();const fields=dialog.locator('.modal-form-fields');if(await fields.count()){const a=await fields.first().boundingBox(),b=await footer.boundingBox();expect(a.y+a.height).toBeLessThanOrEqual(b.y+1);}await page.screenshot({path:'.local/modal-'+key+'-'+width+'.png',fullPage:true});if(key==='customer'){const scroller=dialog.locator('.modal-form-fields');expect(await scroller.evaluate(el=>getComputedStyle(el,'::-webkit-scrollbar').width)).toBe('8px');await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(dialog.getByLabel('Observações',{exact:true})).toBeInViewport();await expect(footer).toBeInViewport();await page.screenshot({path:'.local/modal-scroll-end-'+width+'.png'});}await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await expect(dialog).toHaveCount(0);
  }
  await page.goto('/motorcycles');await page.getByRole('link').filter({has:page.getByRole('heading',{name:'Scooter catálogo teste',exact:true})}).click();await page.getByRole('button',{name:'Adicionar cor',exact:true}).click();await modalFits(page);await expect(page.getByRole('dialog').getByRole('button',{name:'Adicionar cor e configuração',exact:true})).toBeInViewport();await page.screenshot({path:'.local/modal-variant-'+width+'.png',fullPage:true});await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  for(const [button,key] of [['Entrada de lote','receipt'],['Alterar preço','price'],['Editar configuração','configuration']]){await page.getByRole('region',{name:'Configuração selecionada',exact:true}).getByRole('button',{name:button,exact:true}).click();await modalFits(page);await expect(page.getByRole('dialog').locator('form>footer')).toBeInViewport();await page.screenshot({path:'.local/modal-'+key+'-'+width+'.png',fullPage:true});if(key==='customer'){const scroller=dialog.locator('.modal-form-fields');expect(await scroller.evaluate(el=>getComputedStyle(el,'::-webkit-scrollbar').width)).toBe('8px');await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});await expect(dialog.getByLabel('Observações',{exact:true})).toBeInViewport();await expect(footer).toBeInViewport();await page.screenshot({path:'.local/modal-scroll-end-'+width+'.png'});}await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();}
  await page.goto('/audit');await page.getByRole('button',{name:'Detalhes',exact:true}).first().click();await modalFits(page);await page.screenshot({path:'.local/modal-audit-'+width+'.png',fullPage:true});await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
  if(width<950){await page.getByRole('button',{name:'Abrir menu'}).click();await expect(page.locator('aside').getByRole('button',{name:'Sair',exact:true})).toBeInViewport();await page.screenshot({path:'.local/layout-menu-mobile.png',fullPage:true});await page.getByRole('button',{name:'Fechar menu'}).click({position:{x:width-8,y:8}});}
 }
});
