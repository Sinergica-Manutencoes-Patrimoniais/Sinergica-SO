// Playwright executado apenas no contêiner de navegador da rede interna.
const fs=require('node:fs'),{chromium}=require('/tmp/playwright-core');
const c=JSON.parse(fs.readFileSync(0,'utf8'));
(async()=>{const b=await chromium.launch({headless:true,executablePath:'/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell',args:['--no-sandbox']});try{
 const p=await b.newPage();await p.goto('http://127.0.0.1:5189/?rotina='+encodeURIComponent(c.rotina||''));
 await p.getByLabel('E-mail sintético').fill(c.email);await p.getByLabel('Senha sintética').fill(c.password);await p.getByRole('button',{name:'Entrar'}).click();
 if(c.etapa==='aprovar'){
  await p.getByRole('button',{name:'Aprovar revisão de versão'}).waitFor({timeout:10000});await p.getByRole('button',{name:'Aprovar revisão de versão'}).click();await p.getByLabel('Início da vigência').fill(c.vigencia);await p.getByRole('button',{name:'Confirmar aprovação'}).click();
  await p.waitForTimeout(3000);const body=await p.locator('body').innerText();if(body.includes('servidor recusou')||body.includes('Não foi possível confirmar'))throw Error('aprovacao_rejeitada');
 }else if(c.etapa==='gerar'){
  await p.getByRole('button',{name:'Abrir geração sintética'}).click();await p.getByLabel('Início',{exact:true}).fill(c.vencimento);await p.getByLabel('Fim',{exact:true}).fill(c.vencimento);await p.getByRole('button',{name:'Consultar Visitas'}).click();
  await p.getByRole('button',{name:'Conferir preparação'}).waitFor({timeout:10000});await p.getByRole('button',{name:'Conferir preparação'}).click();await p.getByLabel('Fonte consultada para declarar dia sem feriado').fill('fonte sintética');await p.getByRole('checkbox',{name:'Confirmei Visita, semana, vigência e fonte declarada'}).check();await p.getByRole('button',{name:'Preparar ocorrência sem envio'}).click();await p.getByText('Ocorrência preparada; ainda não incluída na fila e sem OS ou tarefa.').waitFor({timeout:10000});
 }else throw Error('etapa_invalida');
 process.stdout.write('ok');
}finally{await b.close()}})().catch(()=>{process.stderr.write('etapa_ui_falhou');process.exit(1)});
