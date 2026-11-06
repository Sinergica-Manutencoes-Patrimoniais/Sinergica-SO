#!/usr/bin/env python3
"""Exceção e mudança de dia pela UI em clone isolado com dados sintéticos."""
import json, os, secrets, subprocess, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]; WEB=ROOT/'apps/web'; HERE=Path(__file__).resolve().parent
ident=secrets.token_hex(6); db='sso-s166-e2e-'+ident+'-db'; browser='sso-s166-e2e-'+ident+'-browser'; database='sso_s166_'+ident
password=secrets.token_hex(20); created=False

def run(args,data=None,cwd=None,env=None):
 p=subprocess.run(args,input=data,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,cwd=cwd,env=env)
 if p.returncode: raise RuntimeError('Falha em '+str(args[0])+'; saída sensível omitida.')
 return p.stdout.strip()
def boot(step):
 p=subprocess.run([sys.executable,str(HERE/'bootstrap-interno.py'),step,'--id',ident],text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('Bootstrap falhou: '+step+' '+p.stderr.strip())
 return p.stdout.strip()
def sql(text):return run(['docker','exec','-i',db,'psql','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1','-q'],text)
def scalar(text):return run(['docker','exec',db,'psql','-U','supabase_admin','-d',database,'-Atqc',text])
try:
 with tempfile.TemporaryDirectory(prefix='sso-s166-excecao-') as temporary:
  tmp=Path(temporary);(tmp/'env').mkdir();(tmp/'dist').mkdir()
  clean={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(tmp),'TMPDIR':str(tmp.parent),'S166_ENV_DIR':str(tmp/'env'),'S166_BUILD_DIR':str(tmp/'dist'), 'VITE_SUPABASE_URL':'http://127.0.0.1:5189','VITE_SUPABASE_ANON_KEY':'chave-sintetica','VITE_SSO_EXCECAO_VISITA_ENABLED':'true'}
  run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-jornada.config.ts'],cwd=WEB,env=clean)
  boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
  run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
  for name in ('proxy-jornada.cjs','jornada-driver.cjs'):run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
  run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-jornada.cjs'])
  original=(ROOT/'supabase/tests/manual_E01-S166_excecao_aprovada_1732.sql').read_text();setup=original[:original.index('-- RPCs mediadas concedidas')]
  setup+=f"\nupdate pcm.sso_excecao_visita_gate set habilitado=true where id; update pcm.sso_previa_mudanca_dia_gate set habilitado=true where id; update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16660000-0000-0000-0000-000000000001'; commit;"
  boot('verificar');sql(setup)
  old=scalar("select jsonb_agg(to_jsonb(v) order by id)::text from pcm.visitas v where id in ('17320000-0000-0000-0000-000000000002','17320000-0000-0000-0000-000000000003','17320000-0000-0000-0000-000000000004','17320000-0000-0000-0000-000000000010')")
  old_os=scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17320000-0000-0000-0000-000000000008'")
  cfg={'etapa':'excecao','email':'s166-mediador@example.test','password':password,'vigencia':scalar('select (current_date+1)::text')}
  boot('verificar');result=run(['docker','exec','-i',browser,'node','/tmp/jornada-driver.cjs'],json.dumps(cfg))
  if result!='ok':raise RuntimeError('Recibo de interface inválido.')
  if scalar("select jsonb_agg(to_jsonb(v) order by id)::text from pcm.visitas v where id in ('17320000-0000-0000-0000-000000000002','17320000-0000-0000-0000-000000000003','17320000-0000-0000-0000-000000000004','17320000-0000-0000-0000-000000000010')")!=old:raise RuntimeError('Visita da exceção foi alterada.')
  if scalar("select to_jsonb(o)::text from pcm.ordens_servico o where id='17320000-0000-0000-0000-000000000008'")!=old_os:raise RuntimeError('OS histórica foi alterada.')
  if scalar("select ((inicio_em at time zone 'UTC')::date = date_trunc('week',current_date+21)::date+1)::text from pcm.visitas where id='17320000-0000-0000-0000-000000000001'")!='true':raise RuntimeError('Visita elegível não foi movida.')
  if scalar("select count(*) from pcm.sso_excecoes_visita_aprovadas where visita_id='17320000-0000-0000-0000-000000000010'")!='1':raise RuntimeError('Exceção não comprovada.')
  print('Exceção aprovada e mudança do dia pela UI; Visita e OS preservadas.')
finally:
 if created:
  try:boot('remover');print('Recursos descartáveis removidos.')
  except Exception:print('Falha na limpeza; verifique rótulo sso.ensaio='+ident,file=sys.stderr)
