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
           'VITE_SSO_NOVA_DATA_VISITA_ENABLED':'true','VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED':'true','VITE_SSO_RESOLUCAO_IMPACTO_ENABLED':'true','VITE_SSO_APROVAR_REVISAO_ENABLED':'true','VITE_SSO_PROTOCOLO_REVISAO_1731_ENABLED':'true','VITE_SSO_MATERIALIZAR_VISITA_CANONICA_ENABLED':'true'}
    run(['node',str(WEB/'node_modules/vite/bin/vite.js'),'build','--config','vite.s166-jornada.config.ts'],cwd=WEB,env=clean)
    boot('criar');created=True;boot('carregar');boot('servicos');boot('navegador');boot('verificar')
    run(['docker','cp',str(tmp/'dist'),browser+':/tmp/sso-jornada-dist'])
    for name in ('proxy-jornada.cjs','jornada-driver.cjs'):
        run(['docker','cp',str(HERE/name),browser+':/tmp/'+name])
    run(['docker','exec','-d','-e','S166_ISOLATED_ID='+ident,browser,'node','/tmp/proxy-jornada.cjs'])
    run(['docker','exec',db,'mkdir','-p','/tmp/sso-jornada-fixtures'])
    for name in ('manual_E01-S165_S166_ponte_legada_mediada.sql','manual_E01-S165_legado_nao_relacionado_1680.sql'):
        run(['docker','cp',str(ROOT/'supabase/tests'/name),db+':/tmp/sso-jornada-fixtures/'+name])
    fixture="begin;\n\\ir /tmp/sso-jornada-fixtures/manual_E01-S165_legado_nao_relacionado_1680.sql\n"
    fixture+=f"reset role; update auth.users set encrypted_password=crypt('{password}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='',is_sso_user=false where id='16630000-1111-4000-8000-000000000001'; commit;"
    boot('verificar');sql(fixture)
    hash_original=scalar("select payload->>'hash' from pcm.sso_legados_nao_relacionados where request_id='16630000-1111-4000-8000-000000000182'")
    js=r"""const fs=require('fs');const c=JSON.parse(fs.readFileSync(0,'utf8'));(async()=>{const login=await fetch(c.auth+'/token?grant_type=password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'fixture-166-pmoc@example.test',password:c.password})});if(!login.ok)throw Error('login');const t=(await login.json()).access_token;const h={'content-type':'application/json','content-profile':'pcm',authorization:'Bearer '+t};const base={p_ator:'16630000-1111-4000-8000-000000000001',p_cliente:'16630000-1111-4000-8000-00000000000a',p_plano:'16630000-1111-4000-8000-000000000011',p_legado:'16630000-1111-4000-8000-000000000181',p_revisao:2,p_contexto:'Contrato distinto',p_motivo:'Verificado pelo PCM'};async function call(p){const r=await fetch(c.rest+'/rpc/sso_classificar_legado_nao_relacionado',{method:'POST',headers:h,body:JSON.stringify(p),signal:AbortSignal.timeout(7000)});return [r.status,await r.json()]};const [s,x]=await call({...base,p_request:'16630000-1111-4000-8000-000000000183',p_hash:'0'.repeat(64)});if(s<400||x.code!=='P0019'||x.message!=='fotografia_obsoleta')throw Error('conflito');const [r,y]=await call({...base,p_request:'16630000-1111-4000-8000-000000000182',p_hash:c.hash});if(r!==200||y.requestId!=='16630000-1111-4000-8000-000000000182')throw Error('replay');process.stdout.write('ok')})().catch(()=>process.exit(1));"""
    boot('verificar')
    cfg={'auth':'http://sso-s166-e2e-'+ident+'-auth:9999','rest':'http://sso-s166-e2e-'+ident+'-rest:3000','password':password,'hash':hash_original}
    if run(['docker','exec','-i',browser,'node','-e',js],json.dumps(cfg))!='ok': raise RuntimeError('HTTP divergente.')
    print('HTTP P0019 e replay autenticado: passaram.')

finally:
 if created:
    try: boot('remover');print('Recursos descartáveis removidos.')
    except Exception: print('Falha na limpeza do ensaio; verifique recursos com rótulo sso.ensaio='+ident,file=sys.stderr)
