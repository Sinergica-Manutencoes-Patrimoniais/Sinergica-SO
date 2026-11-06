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
    p=subprocess.run(['docker','exec','-i',browser,'node','/tmp/aprovacao-obsoleta-driver.cjs'],input=json.dumps(config),text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError(p.stderr.strip() if p.stderr.startswith('etapa_ui_falhou: ') else 'Falha na interface isolada.')
    result=p.stdout.strip()
    if result!='ok': raise RuntimeError('Recibo da interface inválido.')

try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-build-') as temporary:
    tmp=Path(temporary); (tmp/'env').mkdir(); (tmp/'dist').mkdir()
    clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'),
           'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica',
           'VITE_SSO_RESOLUCAO_IMPACTO_ENABLED':'true','VITE_SSO_APROVAR_REVISAO_ENABLED':'true','VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED':'true','VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED':'true'}
    run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-jornada.config.ts'],cwd=WEB,env=clean)
    boot('criar');created=True;boot('carregar');sql((ROOT/'supabase/migrations/1746_E01-S165_aprovacao_revisao_conflito.sql').read_text());boot('servicos');boot('navegador');boot('verificar')
    run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
    for name in ('proxy-jornada.cjs','aprovacao-obsoleta-driver.cjs'): run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
    run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-jornada.cjs'])
    run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
    for name in ('manual_E01-S165_visita_rascunho_1723.sql','manual_E01-S165_visita_futura_1703_setup.sql','manual_E01-S165_impacto_visita_fila_1705.sql'):
        run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'])
    fixture=(ROOT/'supabase/tests/manual_E01-S165_aprovacao_real_visita_1731.sql').read_text().splitlines()
    setup='\n'.join(fixture[:16]).replace('\\ir manual_E01-S165_visita_rascunho_1723.sql','\\ir /tmp/sso-jornada-fixtures/manual_E01-S165_visita_rascunho_1723.sql')
    setup+=f"\nupdate pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id; update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16610000-0000-0000-0000-000000000001'; commit;"
    boot('verificar');sql(setup)
    cfg={'email':'origem-s166@test.local','password':password,'etapa':'aprovar','vigencia':scalar('select (current_date+1)::text')}
    driver(cfg)
    print('Resposta de revisão obsoleta chegou pelo HTTP.')
finally:
 if created:
    try: boot('remover');print('Recursos descartáveis removidos.')
    except Exception: print('Falha na limpeza do ensaio; verifique recursos com rótulo sso.ensaio='+ident,file=sys.stderr)
