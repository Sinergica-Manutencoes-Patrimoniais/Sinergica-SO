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
    p=subprocess.run(['docker','exec','-i',browser,'node','/tmp/app-revisao-driver.cjs'],input=json.dumps(config),text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode:
        diagnostic = next((line for line in p.stderr.splitlines() if line.startswith('etapa_ui_falhou: ')), None)
        raise RuntimeError(diagnostic if diagnostic else f'Falha no processo do navegador isolado (código {p.returncode}); detalhes não classificados.')
    result=p.stdout.strip()
    if result!='ok' and not result.startswith('ok:'): raise RuntimeError('Recibo da interface inválido.')
    return result

try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-build-') as temporary:
    tmp=Path(temporary); (tmp/'env').mkdir(); (tmp/'dist').mkdir()
    clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'),
           'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica',
           'VITE_SSO_FUSO_PLANO_DECLARADO_ENABLED':'true','VITE_SSO_PREFLIGHT_APROVACAO_REVISAO_ENABLED':'true','VITE_SSO_DECISAO_IMPACTO_VISITA_ENABLED':'true','VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED':'true','VITE_SSO_ORIGEM_ROTINA_ENABLED':'true','VITE_SSO_ORIGEM_LOTE_ENABLED':'true','VITE_SSO_LOTE_CALENDARIO_CONFERIDO_ENABLED':'true','VITE_SSO_FUSO_PLANO_MEDIADO_ENABLED':'true','VITE_SSO_INVENTARIO_PMOC_REVISAO_ENABLED':'true','VITE_SSO_NOVA_DATA_VISITA_ENABLED':'true','VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED':'true','VITE_SSO_RESOLUCAO_IMPACTO_ENABLED':'true','VITE_SSO_APROVAR_REVISAO_ENABLED':'true','VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED':'true','VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED':'true'}
    run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-app-isolado.config.ts'],cwd=WEB,env=clean)
    boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
    run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
    for name in ('proxy-app.cjs','app-revisao-driver.cjs'):
        run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
    run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-app.cjs'])
    run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
    for name in ('manual_E01-S165_visita_futura_1703_setup.sql','manual_E01-S165_impacto_visita_fila_1705.sql'):
        run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'+name])
    prefix=(ROOT/'supabase/tests/manual_E01-S165_visita_futura_1703_setup.sql').read_text().split("set local request.jwt.claims=")[0]
    run(['docker','exec','-i',db,'sh','-c','cat > /tmp/sso-jornada-fixtures/manual_E01-S165_visita_futura_1703_setup.sql'],prefix)
    fixture="begin;\n\\ir /tmp/sso-jornada-fixtures/manual_E01-S165_visita_futura_1703_setup.sql\n"
    fixture+=f"reset role; update pcm.sso_decisao_comparada_gate set habilitado=true where id; update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16610000-0000-0000-0000-000000000001'; commit;"
    boot('verificar');sql(fixture)
    sql("insert into pcm.sistemas(id,cliente_id,nome) values('16610000-0000-0000-0000-000000000998','16610000-0000-0000-0000-00000000000a','Sistema sintético B');")
    sql("""update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
begin; set local session_replication_role=replica;
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values('17680000-0000-4000-8000-000000000001','CH-SINTETICO','16610000-0000-0000-0000-00000000000a','Chamado anterior','16610000-0000-0000-0000-000000000001');
insert into pcm.sso_chamados_ciclo_visita(ciclo_id,cliente_id,plano_id,preparada_id,chamado_id,ator_id) select ciclo_id,'16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',preparada_id,'17680000-0000-4000-8000-000000000001','16610000-0000-0000-0000-000000000001' from pcm.sso_ciclo_visita_versoes where preparada_id='16610000-0000-0000-0000-000000000161';
set local session_replication_role=origin;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by,chamado_id) values('17680000-0000-4000-8000-000000000002','16610000-0000-0000-0000-00000000000a','OS-SINTETICA','OS anterior','preventiva','manual','16610000-0000-0000-0000-000000000001','17680000-0000-4000-8000-000000000001');commit;""")
    os_antes=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'")
    origem_antes=scalar("select to_jsonb(o)::text from pcm.sso_origens_os_preventiva o where os_id='17680000-0000-4000-8000-000000000002'")
    os_total=scalar('select count(*) from pcm.ordens_servico');outbox_total=scalar('select count(*) from pcm.auvo_sync_outbox')
    if not origem_antes:raise RuntimeError('Fotografia da OS histórica não foi criada.')
    rotina=scalar("select id from pcm.rotinas_manutencao where versao_id='16610000-0000-0000-0000-000000000181' and rotina_logica_id='16610000-0000-0000-0000-000000000124'")
    cfg={'email':'origem-s166@test.local','password':password,'etapa':'editar','rotina':rotina,'data':scalar('select (current_date+30)::text')}
    driver(cfg)
    comprovado=scalar("select (sistema_id='16610000-0000-0000-0000-000000000998' and modo='calendario' and intervalo_n=2 and intervalo_unidade='meses' and tolerancia_antes=2 and tolerancia_depois=5)::text from pcm.rotinas_manutencao where id='"+rotina+"'")
    if comprovado!='true':raise RuntimeError('Edição não comprovada no banco.')
    if os_antes!=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'") or origem_antes!=scalar("select to_jsonb(o)::text from pcm.sso_origens_os_preventiva o where os_id='17680000-0000-4000-8000-000000000002'"):raise RuntimeError('OS ou fotografia histórica alterada.')
    print('Alvo e recorrência editados pela UI e confirmados no banco sintético.')
    print('OS histórica sintética e fotografia preservadas pela edição.')
    cfg.update(etapa='submeter-editado');driver(cfg)
    estado=scalar("select estado||':'||revisao from pcm.planos_manutencao where id='16610000-0000-0000-0000-000000000121'")
    if estado!='em_revisao:4':raise RuntimeError('Submissão via UI não comprovada: '+estado)
    print('Plano editado enviado à revisão pela UI.')
    sql("update pcm.aprovacao_revisao_gate set habilitado=true where id; update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id; update pcm.sso_continuidade_revisao_gate set habilitado=true where id; update pcm.sso_decisao_comparada_gate set habilitado=true where id; update pcm.sso_data_civil_geracao_gate set habilitado=true where id; update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id; update pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id; update pcm.sso_fuso_plano_mediado_gate set habilitado=true where id; update pcm.sso_fuso_plano_gate set habilitado=true where id;")
    cfg.update(etapa='decidir-editado');driver(cfg);print('Impacto da Visita reconferido pela UI.')
    cfg.update(etapa='pmoc-editado',vigencia=scalar('select (current_date+1)::text'));driver(cfg);print('Inventário PMOC reconferido pela UI.')
    cfg.update(etapa='fuso-editado');driver(cfg);print('Fuso do Plano declarado pela UI.')
    cfg.update(etapa='aprovar-editado',vigencia=scalar('select (current_date+1)::text'));diagnostico=driver(cfg);print('Aprovação:',diagnostico)
    if scalar("select estado||':'||revisao from pcm.planos_manutencao where id='16610000-0000-0000-0000-000000000121'")!='aprovado:5':raise RuntimeError('Aprovação não comprovada no banco.')
    if os_antes!=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'") or origem_antes!=scalar("select to_jsonb(o)::text from pcm.sso_origens_os_preventiva o where os_id='17680000-0000-4000-8000-000000000002'"):raise RuntimeError('OS ou fotografia histórica alterada.')
    print('Aprovação mediada real e OS histórica preservada.')
    sql("update pcm.sso_lote_ciclos_calendario_gate set habilitado=true where id; update pcm.sso_lote_calendario_conferido_gate set habilitado=true where id; update pcm.sso_identidade_ciclo_gate set habilitado=true where id; update pcm.sso_materializar_ciclo_canonico_gate set habilitado=true where id; update pcm.sso_guarda_ciclo_canonico_gate set habilitado=true where id;")
    cfg.update(etapa='origem-editada');driver(cfg);print('Origem da Rotina aprovada declarada pela UI.')
    cfg.update(etapa='gerar-editado');driver(cfg)
    if scalar("select count(*) from pcm.ocorrencias_rotina_preparadas where versao_id='16610000-0000-0000-0000-000000000181' and alvo_id='16610000-0000-0000-0000-000000000998'")!='1':raise RuntimeError('Geração da Rotina editada não comprovada.')
    if os_antes!=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17680000-0000-4000-8000-000000000002'") or origem_antes!=scalar("select to_jsonb(o)::text from pcm.sso_origens_os_preventiva o where os_id='17680000-0000-4000-8000-000000000002'"):raise RuntimeError('OS histórica alterada após geração.')
    tolerancia=scalar("select (o.tolerancia_antes=2 and o.tolerancia_depois=5 and o.vencimento_original=r.data_base and (v.snapshot->'rotinas'->0->>'tolerancia_antes')::int=2 and (v.snapshot->'rotinas'->0->>'tolerancia_depois')::int=5)::text from pcm.ocorrencias_rotina_preparadas o join pcm.rotinas_manutencao r on r.id=o.rotina_id join pcm.plano_versoes v on v.id=o.versao_id where o.versao_id='16610000-0000-0000-0000-000000000181' and o.alvo_id='16610000-0000-0000-0000-000000000998'")
    if tolerancia!='true':raise RuntimeError('Tolerância de ocorrência/versão divergente.')
    print('Tolerâncias 2/5 preservadas na versão aprovada e ocorrência gerada.')
    if os_total!=scalar('select count(*) from pcm.ordens_servico') or outbox_total!=scalar('select count(*) from pcm.auvo_sync_outbox'):raise RuntimeError('Saída operacional inesperada.')
    print('Rotina aprovada gerou ocorrência pela UI; OS histórica preservada.')

finally:
 if created:
    try: boot('remover');print('Recursos descartáveis removidos.')
    except Exception: print('Falha na limpeza do ensaio; verifique recursos com rótulo sso.ensaio='+ident,file=sys.stderr)
