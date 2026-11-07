#!/usr/bin/env python3
"""Ensaio sintético: componentes reais S165/S166, clone e browser em rede interna.

Restaura fixtures sintéticas, mantém guarda 1045, simula data civil somente no clone
após aprovação e usa RPC para retirada da fila antes da geração via interface.
"""
import json, os, secrets, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[4]
WEB=ROOT/'apps/web'; HERE=Path(__file__).resolve().parent
ident=secrets.token_hex(6); db='sso-s166-e2e-'+ident+'-db'; browser='sso-s166-e2e-'+ident+'-browser'; database='sso_s166_'+ident
password=secrets.token_hex(20); created=False

def run(args, data=None, cwd=None, env=None):
    p=subprocess.run(args,input=data,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd=cwd,env=env)
    if p.returncode: raise RuntimeError('Falha em '+str(args[0])+'; nenhum corpo ou credencial será exibido.')
    return p.stdout.strip()
def boot(step):
    p=subprocess.run([sys.executable,str(HERE/'bootstrap-interno.py'),step,'--id',ident],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError('Bootstrap falhou na etapa '+step+' '+p.stderr.strip())
    return p.stdout.strip()
def sql(text): return run(['docker','exec','-i',db,'psql','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-q'],text)
def scalar(text): return run(['docker','exec',db,'psql','-U','supabase_admin','-d',database,'-Atqc',text])
def driver(config):
    boot('verificar')
    p=subprocess.run(['docker','exec','-i',browser,'node','/tmp/app-vinculo-062-driver.cjs'],input=json.dumps(config),text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError(p.stderr.strip() if p.stderr.startswith('etapa_ui_falhou: ') else 'Falha na interface isolada.')
    result=p.stdout.strip()
    if result!='ok': raise RuntimeError('Recibo da interface inválido.')

try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-build-') as temporary:
    tmp=Path(temporary); (tmp/'env').mkdir(); (tmp/'dist').mkdir()
    clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'),
           'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica',
           'VITE_SSO_VIGENCIA_ROTINA_SERIE_ENABLED':'true','VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED':'true','VITE_SSO_VINCULAR_ROTINA_SERIE_ENABLED':'true','VITE_SSO_PREVIA_OCORRENCIA_VISITA_ENABLED':'true','VITE_SSO_RESOLUCAO_IMPACTO_ENABLED':'true','VITE_SSO_APROVAR_REVISAO_ENABLED':'true','VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED':'true','VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED':'true'}
    run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-app-isolado.config.ts'],cwd=WEB,env=clean)
    boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
    run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
    for name in ('proxy-app.cjs','app-vinculo-062-driver.cjs'): run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
    run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-app.cjs'])
    run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
    for name in ('manual_E01-S165_visita_rascunho_1723.sql','manual_E01-S165_visita_futura_1703_setup.sql','manual_E01-S165_impacto_visita_fila_1705.sql'):
        run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'])
    fixture=(ROOT/'supabase/tests/manual_E01-S165_aprovacao_real_visita_1731.sql').read_text().splitlines()
    setup='\n'.join(fixture[:16]).replace('\\ir manual_E01-S165_visita_rascunho_1723.sql','\\ir /tmp/sso-jornada-fixtures/manual_E01-S165_visita_rascunho_1723.sql')
    setup+=f"\nupdate pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id; update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16610000-0000-0000-0000-000000000001'; commit;"
    boot('verificar');sql(setup)
    sql("insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by) values('17680000-0000-4000-8000-000000000002','16610000-0000-0000-0000-00000000000a','OS-SINTETICA','OS anterior','preventiva','manual','16610000-0000-0000-0000-000000000001')")
    os_antes=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'")
    os_total=scalar('select count(*) from pcm.ordens_servico');outbox_total=scalar('select count(*) from pcm.auvo_sync_outbox')
    cfg={'email':'origem-s166@test.local','password':password,'etapa':'aprovar','vigencia':scalar('select (current_date+1)::text')}
    driver(cfg)
    if scalar("select estado||':'||revisao from pcm.planos_manutencao where id='16610000-0000-0000-0000-000000000121'")!='aprovado:4': raise RuntimeError('Aprovação da revisão não comprovada.')
    print('Aprovação mediada via UI e guarda 1045 real: passou.')
    source=(ROOT/'supabase/tests/manual_E01-S165_aprovacao_real_visita_1731.sql').read_text();a=source.index('do $$ declare d text:=pg_catalog.pg_get_functiondef');b=source.index('do $$ declare r jsonb;',a)
    sql(source[a:b])
    cfg.update(etapa='retirar'); driver(cfg)
    if scalar("select estado from pcm.sso_fila_visita where preparada_id='16610000-0000-0000-0000-000000000161'")!='cancelado': raise RuntimeError('Retirada via UI não comprovada.')
    print('Retirada da fila via UI: passou.')
    cfg.update(etapa='vincular');driver(cfg)
    if scalar("select count(*) from pcm.rotina_visita_serie_vinculos where plano_id='16610000-0000-0000-0000-000000000121' and serie_id='16610000-0000-0000-0000-000000000062'")!='1':raise RuntimeError('Vínculo via UI não comprovado.')
    print('Vínculo de série criado via UI.')
    cfg.update(etapa='vigencia',vigencia=scalar('select current_date::text'));driver(cfg)
    sql("""insert into pcm.visitas(id,cliente_id,contrato_id,inicio_em,fim_em,fuso,natureza,created_by) select '16610000-0000-0000-0000-000000000084',cliente_id,contrato_id,inicio_em+interval '7 days',fim_em+interval '7 days',fuso,'regular',created_by from pcm.visitas where id='16610000-0000-0000-0000-000000000083';
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) select '16610000-0000-0000-0000-000000000084',cliente_id,contrato_id,'16610000-0000-0000-0000-000000000062','16610000-0000-0000-0000-000000000072',date_trunc('week',(inicio_em at time zone fuso))::date,'16610000-0000-0000-0000-000000000001' from pcm.visitas where id='16610000-0000-0000-0000-000000000084';""")
    print('Vigência criada pela UI; Visita da série 062 preparada como fonte sintética.')
    cfg.update(etapa='gerar',rotina=scalar("select rotina_id from pcm.sso_escolhas_nova_data_visita where request_id='16610000-0000-0000-0000-000000000231'"),vencimento=scalar("select (inicio_em at time zone fuso)::date from pcm.visitas where id='16610000-0000-0000-0000-000000000084'"))
    driver(cfg)
    if scalar("select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121' and serie_id='16610000-0000-0000-0000-000000000062' and visita_id='16610000-0000-0000-0000-000000000084'")!='1': raise RuntimeError('Geração ou preservação histórica não comprovada.')
    if os_antes!=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'") or os_total!=scalar('select count(*) from pcm.ordens_servico') or outbox_total!=scalar('select count(*) from pcm.auvo_sync_outbox'):raise RuntimeError('OS histórica ou saídas alteradas.')
    print('Preparação de Visita via UI e preservação da OS independente: passou; relógio sintético no clone.')
finally:
 if created:
    try: boot('remover');print('Recursos descartáveis removidos.')
    except Exception: print('Falha na limpeza do ensaio; verifique recursos com rótulo sso.ensaio='+ident,file=sys.stderr)
