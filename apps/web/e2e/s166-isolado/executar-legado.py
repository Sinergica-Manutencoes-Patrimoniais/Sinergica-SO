#!/usr/bin/env python3
"""Vínculo legado existente e fila pela UI, com backend real em clone sintético."""
import json,os,secrets,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];WEB=ROOT/'apps/web';HERE=Path(__file__).resolve().parent
ident=secrets.token_hex(6);db='sso-s166-e2e-'+ident+'-db';browser='sso-s166-e2e-'+ident+'-browser';database='sso_s166_'+ident
password=secrets.token_hex(20);created=False
def run(args,data=None,cwd=None,env=None):
 p=subprocess.run(args,input=data,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd=cwd,env=env)
 if p.returncode:raise RuntimeError('Falha em '+str(args[0])+'; saída sensível omitida.')
 return p.stdout.strip()
def boot(step):
 p=subprocess.run([sys.executable,str(HERE/'bootstrap-interno.py'),step,'--id',ident],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('Bootstrap falhou: '+step+' '+p.stderr.strip())
 return p.stdout.strip()
def sql(text):return run(['docker','exec','-i',db,'psql','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-q'],text)
def scalar(text):return run(['docker','exec',db,'psql','-U','supabase_admin','-d',database,'-Atqc',text])
try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-legado-') as temporary:
  tmp=Path(temporary);(tmp/'env').mkdir();(tmp/'dist').mkdir()
  clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'),'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica','VITE_SSO_INTEGRAR_LEGADA_EXISTENTE_ENABLED':'true','VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED':'true'}
  run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-jornada.config.ts'],cwd=WEB,env=clean)
  boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
  run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
  for name in ('proxy-jornada.cjs','jornada-driver.cjs'):run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
  run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-jornada.cjs'])
  run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
  name='manual_E01-S166_decisao_ativacao_1728.sql';run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'])
  original=(ROOT/'supabase/tests/manual_E01-S166_retomada_fila_aguardando.sql').read_text();setup=original[:original.index('do $$ declare r jsonb;f jsonb;g jsonb;h jsonb;begin')].replace('\\ir '+name,'\\ir /tmp/sso-jornada-fixtures/'+name)
  setup+="""select pcm.sso_preparar_ciclo_vencido('17340000-0000-4000-8000-000000000005','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',3,current_setting('sso.fixture.sp')::date-1);
 select pcm.sso_declarar_relacao_legada_mediada('16660000-0000-4000-8000-000000000001','17350000-0000-4000-8000-000000000014','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','17350000-0000-4000-8000-000000000013',0,'declarar','Relação conferida');
 reset role; delete from pcm.avaliacoes_preventivas where chave_origem='fixture-1735';
 """+f"update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16660000-0000-4000-8000-000000000001'; commit;"
  boot('verificar');sql(setup)
  preparada=scalar("select id from pcm.ocorrencias_rotina_preparadas where plano_id='16660000-0000-4000-8000-000000000011'")
  legada=scalar("select id from pcm.ocorrencias_preventivas where plano_id='17350000-0000-4000-8000-000000000013' and indice=0")
  cfg={'etapa':'legado','email':'fuso-1666@example.test','password':password,'preparada':preparada,'legada':legada}
  boot('verificar');result=run(['docker','exec','-i',browser,'node','/tmp/jornada-driver.cjs'],json.dumps(cfg))
  if result!='ok':raise RuntimeError('Recibo de interface inválido.')
  if scalar("select count(*) from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id='"+preparada+"' and ocorrencia_legada_id='"+legada+"'")!='1':raise RuntimeError('Ponte não comprovada.')
  if scalar("select estado from pcm.sso_fila_preventiva_pcm where preparada_id='"+preparada+"'")!='aguardando':raise RuntimeError('Fila não comprovada.')
  if scalar("select count(*) from pcm.ordens_servico where client_id='16660000-0000-4000-8000-00000000000a'")!='0':raise RuntimeError('OS indevida.')
  print('Vínculo legado e inclusão em Aguardando pela UI: passaram; sem OS/Auvo.')
finally:
 if created:
  try:boot('remover');print('Recursos descartáveis removidos.')
  except Exception:print('Falha na limpeza; verifique rótulo sso.ensaio='+ident,file=sys.stderr)
