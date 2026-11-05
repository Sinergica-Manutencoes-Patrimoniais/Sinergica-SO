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
    p=subprocess.run(['docker','exec','-i',browser,'node','/tmp/jornada-driver.cjs'],input=json.dumps(config),text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode:
        diagnostic = next((line for line in p.stderr.splitlines() if line.startswith('etapa_ui_falhou: ')), None)
        raise RuntimeError(diagnostic if diagnostic else f'Falha no processo do navegador isolado (código {p.returncode}); detalhes não classificados.')
    result=p.stdout.strip()
    if result!='ok': raise RuntimeError('Recibo da interface inválido.')

try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-build-') as temporary:
    tmp=Path(temporary); (tmp/'env').mkdir(); (tmp/'dist').mkdir()
    clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'),
           'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica',
           'VITE_SSO_RESOLUCAO_IMPACTO_ENABLED':'true','VITE_SSO_APROVAR_REVISAO_ENABLED':'true','VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED':'true','VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED':'true'}
    run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-jornada.config.ts'],cwd=WEB,env=clean)
    boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
    run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
    for name in ('proxy-jornada.cjs','jornada-driver.cjs'):
        run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
    run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-jornada.cjs'])
    run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
    name='manual_E01-S165_impacto_calendario_nativo_1704.sql'
    run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'+name])
    fixture=(ROOT/'supabase/tests/manual_E01-S165_previa_avaliacao_calendario_1737.sql').read_text().split('do $$ declare v_rotina')[0]
    fixture=fixture.replace('\\ir manual_E01-S165_impacto_calendario_nativo_1704.sql','\\ir /tmp/sso-jornada-fixtures/manual_E01-S165_impacto_calendario_nativo_1704.sql')

    fixture+=f"update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16630000-1111-4000-8000-000000000001'; commit;"
    boot('verificar');sql(fixture)
    cfg={'email':'fixture-166-pmoc@example.test','password':password,'etapa':'reserva-cas','rotina':scalar("select id from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022' limit 1")}
    boot('verificar')
    proc=subprocess.Popen(['docker','exec','-i',browser,'node','/tmp/jornada-driver.cjs'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    proc.stdin.write(json.dumps(cfg));proc.stdin.close()
    if proc.stdout.readline().strip()!='pronto':
        proc.terminate();err=proc.stderr.read();proc.wait(timeout=10);raise RuntimeError(next((x for x in err.splitlines() if x.startswith('etapa_ui_falhou: ')),'Prévia inicial indisponível.'))
    sql("update pcm.planos_manutencao set revisao=revisao+1 where id='16630000-1111-4000-8000-000000000011';")
    run(['docker','exec',browser,'touch','/tmp/sso-inserida'])
    out=proc.stdout.read();err=proc.stderr.read();code=proc.wait(timeout=30)
    if code or out.strip()!='ok': raise RuntimeError(next((x for x in err.splitlines() if x.startswith('etapa_ui_falhou: ')),'Falha na interface.'))
    print('Reserva obsoleta rejeitada e interface liberada para reconferência.')

finally:
 if created:
    try: boot('remover');print('Recursos descartáveis removidos.')
    except Exception: print('Falha na limpeza do ensaio; verifique recursos com rótulo sso.ensaio='+ident,file=sys.stderr)
