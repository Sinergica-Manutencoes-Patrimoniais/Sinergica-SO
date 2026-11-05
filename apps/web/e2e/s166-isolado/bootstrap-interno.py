#!/usr/bin/env python3
"""Provisiona e atesta PostgreSQL efêmero sem portas externas para ensaio S166.

Não instala fixtures, Auth, PostgREST ou navegador. Não usar como prova de E2E.
"""
import argparse
import base64
import uuid
import json
import secrets
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import quote

IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.141'
PREFIX = 'sso-s166-e2e-'


def docker(*args, input_text=None):
    return subprocess.run(['docker', *args], input=input_text, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout.strip()


def inspect(kind, name):
    return json.loads(docker('inspect', '--type', kind, name))[0]


def attest(network, database):
    net = inspect('network', network)
    container = inspect('container', database)
    if not network.startswith(PREFIX) or not database.startswith(PREFIX):
        raise RuntimeError('Nome de recurso fora do escopo descartável.')
    if not net['Internal'] or net.get('Ingress') or net['Driver'] != 'bridge':
        raise RuntimeError('Rede não é bridge interna.')
    settings = container['NetworkSettings']
    if set(settings['Networks']) != {network} or any(settings.get('Ports', {}).values()):
        raise RuntimeError('Banco possui rede adicional ou porta publicada.')
    if container['HostConfig'].get('Privileged') or container['HostConfig'].get('NetworkMode') != network:
        raise RuntimeError('Configuração insegura do contêiner.')
    ident = network.removeprefix(PREFIX)
    if container['Config'].get('Labels', {}).get('sso.ensaio') != ident or net.get('Labels', {}).get('sso.ensaio') != ident:
        raise RuntimeError('Propriedade dos recursos não comprovada.')
    if container['Mounts']:
        raise RuntimeError('Banco descartável não pode montar arquivos do host.')
    database_name = 'sso_s166_' + ident
    for _ in range(20):
        try:
            actual = docker('exec', database, 'psql', '-U', 'postgres', '-d', database_name, '-Atqc',
                            "select current_database() || ':' || (extract(epoch from clock_timestamp()-pg_postmaster_start_time()) >= 5)::text", '-v', 'ON_ERROR_STOP=1')
            if actual == database_name + ':true': break
            if not actual.startswith(database_name + ':'): raise RuntimeError('Destino de banco inesperado.')
            time.sleep(1)
        except subprocess.CalledProcessError:
            time.sleep(1)
    else: raise RuntimeError('Conexão ao banco isolado indisponível.')
    if actual != database_name + ':true':
        raise RuntimeError('Destino de banco inesperado.')
    print('Rede interna, banco dedicado, sem mounts ou portas publicadas: verificados.')
    print('Destino:', database)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('acao', choices=['criar', 'verificar', 'carregar', 'servicos', 'login', 'navegador', 'login-navegador', 'remover'])
    ap.add_argument('--id', required=True, help='Identificador hexadecimal de 12 caracteres.')
    args = ap.parse_args()
    if len(args.id) != 12 or any(c not in '0123456789abcdef' for c in args.id):
        ap.error('ID deve conter exatamente 12 dígitos hexadecimais minúsculos.')
    network, database = PREFIX + args.id, PREFIX + args.id + '-db'
    if args.acao == 'remover':
        # Nunca remover recurso que não passe na verificação de escopo e propriedade.
        c = inspect('container', database)
        n = inspect('network', network)
        if c['Config']['Labels'].get('sso.ensaio') != args.id or n['Labels'].get('sso.ensaio') != args.id:
            raise RuntimeError('Rótulo de propriedade divergente; nada removido.')
        for name in [PREFIX + args.id + '-browser', PREFIX + args.id + '-auth', PREFIX + args.id + '-rest']:
            try:
                service = inspect('container', name)
            except subprocess.CalledProcessError:
                continue
            if service['Config'].get('Labels', {}).get('sso.ensaio') != args.id:
                raise RuntimeError('Rótulo de serviço divergente; nada removido.')
            docker('rm', '-f', name)
        docker('rm', '-f', database)
        docker('network', 'rm', network)
        print('Recursos deste ensaio removidos.')
        return
    if args.acao == 'verificar':
        attest(network, database)
        return
    if args.acao == 'navegador':
        attest(network, database)
        for suffix in ('-auth','-rest'):
            c=inspect('container', PREFIX + args.id + suffix)
            if c['Config'].get('Labels', {}).get('sso.ensaio') != args.id or not c['State']['Running'] or set(c['NetworkSettings']['Networks']) != {network} or any(c['NetworkSettings'].get('Ports', {}).values()):
                raise RuntimeError('Serviços não estão isolados.')
        image='mcr.microsoft.com/playwright:v1.61.1-noble'
        docker('image','inspect',image)
        name=PREFIX + args.id + '-browser'
        docker('run','-d','--name',name,'--network',network,'--label','sso.ensaio='+args.id,
               '--user','pwuser','--cap-drop','ALL','--security-opt','no-new-privileges',image,'sleep','infinity')
        c=inspect('container',name)
        if set(c['NetworkSettings']['Networks']) != {network} or any(c['NetworkSettings'].get('Ports', {}).values()) or c['Mounts'] or c['HostConfig'].get('Privileged'):
            raise RuntimeError('Navegador fora do isolamento.')
        root=Path(__file__).resolve().parents[4]
        core=root / 'node_modules' / '.pnpm' / 'playwright-core@1.61.1' / 'node_modules' / 'playwright-core'
        if not core.is_dir() or json.loads((core / 'package.json').read_text()).get('version') != '1.61.1':
            raise RuntimeError('Dependência local playwright-core 1.61.1 indisponível.')
        docker('cp',str(core),name+':/tmp/playwright-core')
        js = """const {chromium}=require('/tmp/playwright-core'); (async()=>{const b=await chromium.launch({headless:true,executablePath:'/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell',args:['--no-sandbox']});const p=await b.newPage();const r=await p.goto(process.argv[1],{timeout:10000});const body=await p.textContent('body');if(r.status()!==200||!body.includes('GoTrue'))throw Error('destino_incorreto');await b.close();process.stdout.write('ok');})().catch(()=>process.exit(1));"""
        result=docker('exec',name,'node','-e',js,f'http://{PREFIX + args.id}-auth:9999/health')
        if result != 'ok': raise RuntimeError('Navegador não alcançou Auth sintético esperado.')
        print('Playwright/Chromium isolado alcançou Auth sintético na rede interna; sem portas ou mounts.')
        print('Ainda faltam servidor de UI, proxy e jornada autenticada.')
        return
    if args.acao == 'login':
        attest(network, database)
        for suffix in ('-auth', '-rest'):
            c = inspect('container', PREFIX + args.id + suffix)
            if c['Config'].get('Labels', {}).get('sso.ensaio') != args.id or not c['State']['Running'] or set(c['NetworkSettings']['Networks']) != {network} or any(c['NetworkSettings'].get('Ports', {}).values()):
                raise RuntimeError('Serviço de ensaio não está isolado.')
        user_id = str(uuid.uuid4())
        email = 'ensaio-' + args.id + '-' + user_id[:8] + '@example.test'
        password = secrets.token_hex(24)
        target = 'sso_s166_' + args.id
        sql = ("insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change,email_change_token_new,raw_app_meta_data,raw_user_meta_data,is_sso_user,created_at,updated_at) "
               f"values('{user_id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{email}',crypt('{password}',gen_salt('bf')),now(),'','','','', '{{}}','{{}}',false,now(),now()); "
               f"insert into config.usuarios(user_id,papel,nome,ativo) values('{user_id}','colaborador','Ensaio sintético',true); "
               f"insert into config.usuario_modulos(user_id,modulo,nivel) values('{user_id}','pcm','escrita');")
        docker('exec','-i',database,'psql','-U','supabase_admin','-d',target,'-v','ON_ERROR_STOP=1','-q',input_text=sql)
        raw=docker('exec','-i',database,'curl','--silent','--show-error','--fail-with-body','--max-time','10','-H','Content-Type: application/json',
                   '--data-binary','@-',f'http://{PREFIX + args.id}-auth:9999/token?grant_type=password',input_text=json.dumps({'email':email,'password':password}))
        response=json.loads(raw); token=response['access_token']; parts=token.split('.')
        claims=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)))
        if claims.get('sub') != user_id or claims.get('user_role') != 'colaborador':
            raise RuntimeError('Claim de usuário sintético não confere.')
        raw=docker('exec',database,'curl','--silent','--show-error','--fail-with-body','--max-time','10',
                   '-H','Authorization: Bearer '+token,'-H','Accept-Profile: config',
                   f'http://{PREFIX + args.id}-rest:3000/usuarios?select=user_id&user_id=eq.{user_id}')
        rows=json.loads(raw)
        if not isinstance(rows,list) or len(rows)!=1 or rows[0].get('user_id')!=user_id:
            raise RuntimeError('Consulta autenticada não retornou somente usuário sintético.')
        print('Login sintético real, claim de papel e consulta autenticada ao PostgREST: verificados.')
        print('Credenciais e token não foram exibidos nem persistidos pelo bootstrap.')
        return
    if args.acao == 'login-navegador':
        attest(network, database)
        for suffix in ('-auth', '-rest'):
            c = inspect('container', PREFIX + args.id + suffix)
            if c['Config'].get('Labels', {}).get('sso.ensaio') != args.id or not c['State']['Running'] or set(c['NetworkSettings']['Networks']) != {network} or any(c['NetworkSettings'].get('Ports', {}).values()):
                raise RuntimeError('Serviço de ensaio não está isolado.')
        user_id = str(uuid.uuid4())
        email = 'ensaio-' + args.id + '-' + user_id[:8] + '@example.test'
        password = secrets.token_hex(24)
        target = 'sso_s166_' + args.id
        sql = ("insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change,email_change_token_new,raw_app_meta_data,raw_user_meta_data,is_sso_user,created_at,updated_at) "
               f"values('{user_id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{email}',crypt('{password}',gen_salt('bf')),now(),'','','','', '{{}}','{{}}',false,now(),now()); "
               f"insert into config.usuarios(user_id,papel,nome,ativo) values('{user_id}','colaborador','Ensaio sintético',true); "
               f"insert into config.usuario_modulos(user_id,modulo,nivel) values('{user_id}','pcm','escrita');")
        docker('exec','-i',database,'psql','-U','supabase_admin','-d',target,'-v','ON_ERROR_STOP=1','-q',input_text=sql)
        browser = PREFIX + args.id + '-browser'
        c = inspect('container', browser)
        if c['Config'].get('Labels', {}).get('sso.ensaio') != args.id or not c['State']['Running'] or set(c['NetworkSettings']['Networks']) != {network} or any(c['NetworkSettings'].get('Ports', {}).values()) or c['Mounts']:
            raise RuntimeError('Navegador não está isolado.')
        js = """const fs=require('fs');const {chromium}=require('/tmp/playwright-core');const c=JSON.parse(fs.readFileSync(0,'utf8'));(async()=>{const b=await chromium.launch({headless:true,executablePath:'/ms-playwright/chromium_headless_shell-1228/chrome-linux/headless_shell',args:['--no-sandbox']});try{const p=await b.newPage();await p.goto(c.auth+'/health',{timeout:10000});const ok=await p.evaluate(async c=>{const login=await fetch(c.auth+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:c.email,password:c.password})});if(!login.ok)return false;const t=(await login.json()).access_token;const x=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const claims=JSON.parse(atob(x));if(claims.sub!==c.id||claims.user_role!=='colaborador')return false;const r=await fetch(c.rest+'/usuarios?select=user_id&user_id=eq.'+c.id,{headers:{Authorization:'Bearer '+t,'Accept-Profile':'config'}});if(!r.ok)return false;const data=await r.json();return data.length===1&&data[0].user_id===c.id},c);if(!ok)throw Error('fluxo_incorreto');process.stdout.write('ok')}finally{await b.close()}})().catch(()=>process.exit(1));"""
        config={'auth':f'http://{PREFIX + args.id}-auth:9999','rest':f'http://{PREFIX + args.id}-rest:3000','email':email,'password':password,'id':user_id}
        result=docker('exec','-i',browser,'node','-e',js,input_text=json.dumps(config))
        if result != 'ok': raise RuntimeError('Login autenticado do navegador falhou.')
        print('Playwright em navegador isolado autenticou conta sintética e consultou PostgREST.')
        print('Nenhuma senha, token ou payload foi exibido.')
        return
    if args.acao == 'servicos':
        attest(network, database)
        target = 'sso_s166_' + args.id
        ready = docker('exec', database, 'psql', '-U', 'postgres', '-d', target, '-Atqc',
                       "select to_regprocedure('pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date)') is not null")
        if ready != 't':
            raise RuntimeError('Clone e migrations não comprovados.')
        auth_image = 'public.ecr.aws/supabase/gotrue:v2.197.0'
        rest_image = 'public.ecr.aws/supabase/postgrest:v14.5'
        docker('image', 'inspect', auth_image)
        docker('image', 'inspect', rest_image)
        password = secrets.token_hex(32)
        jwt_secret = secrets.token_hex(32)
        # Credenciais sintéticas valem somente neste banco descartável.
        docker('exec', database, 'psql', '-U', 'supabase_admin', '-d', target, '-v', 'ON_ERROR_STOP=1', '-qc',
               "alter role authenticator password '" + password + "'; alter role supabase_auth_admin password '" + password + "'")
        # O dump --no-owner altera o dono da infraestrutura Auth; restaurar somente no clone.
        docker('exec', database, 'psql', '-U', 'supabase_admin', '-d', target, '-v', 'ON_ERROR_STOP=1', '-qc',
               "alter schema auth owner to supabase_auth_admin; do $$ declare r record; begin for r in select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relkind in ('r','p','v','m','S') loop execute format('alter %s auth.%I owner to supabase_auth_admin', case r.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'materialized view' else 'table' end,r.relname); end loop; for r in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.prokind='f' loop execute format('alter function %s owner to supabase_auth_admin',r.assinatura); end loop; end $$;")
        services = [
          ('-auth', auth_image, {
            'GOTRUE_DB_DRIVER':'postgres', 'GOTRUE_DB_NAMESPACE':'auth', 'GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:{quote(password)}@{database}:5432/{target}',
            'GOTRUE_API_HOST':'0.0.0.0', 'GOTRUE_API_PORT':'9999', 'API_EXTERNAL_URL':'http://auth:9999',
            'GOTRUE_SITE_URL':'http://localhost', 'GOTRUE_JWT_SECRET':jwt_secret, 'GOTRUE_JWT_AUD':'authenticated',
            'GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated', 'GOTRUE_DISABLE_SIGNUP':'true',
            'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED':'true', 'GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI':'pg-functions://postgres/config/custom_access_token_hook'}),
          ('-rest', rest_image, {
            'PGRST_DB_URI':f'postgres://authenticator:{quote(password)}@{database}:5432/{target}',
            'PGRST_DB_SCHEMAS':'public,pcm,config', 'PGRST_DB_ANON_ROLE':'anon', 'PGRST_JWT_SECRET':jwt_secret,
            'PGRST_SERVER_HOST':'0.0.0.0', 'PGRST_SERVER_PORT':'3000'})]
        for suffix, image, env in services:
            name = PREFIX + args.id + suffix
            cmd = ['run','-d','--name',name,'--network',network,'--label','sso.ensaio='+args.id]
            for key, value in env.items(): cmd += ['--env', key + '=' + value]
            docker(*cmd, image)
            info=inspect('container',name)
            if set(info['NetworkSettings']['Networks']) != {network} or any(info['NetworkSettings'].get('Ports', {}).values()) or info['Mounts']:
                raise RuntimeError('Serviço fora do isolamento.')
        for suffix, port, path in [('-auth','9999','/health'), ('-rest','3000','/')]:
            name=PREFIX + args.id + suffix
            for _ in range(30):
                if not inspect('container',name)['State']['Running']:
                    raise RuntimeError('Serviço parou durante inicialização.')
                try:
                    status=docker('exec',database,'curl','--silent','--max-time','2','--output','/dev/null','--write-out','%{http_code}',f'http://{name}:{port}{path}')
                    if status == '200': break
                except subprocess.CalledProcessError:
                    pass
                time.sleep(1)
            else: raise RuntimeError('Serviço não ficou saudável.')
        print('Auth e PostgREST responderam 200 dentro da rede interna; login ainda não comprovado.')
        print('Ainda falta navegador isolado e jornada real; não exponha portas ao host.')
        return
    if args.acao == 'carregar':
        attest(network, database)
        source = 'sso-validacao-isolada-20261104'
        src = inspect('container', source)
        if src['Config']['Image'] != IMAGE or any(src['NetworkSettings'].get('Ports', {}).values()):
            raise RuntimeError('Banco-base isolado não comprovado.')
        target = 'sso_s166_' + args.id
        count = docker('exec', database, 'psql', '-U', 'postgres', '-d', target, '-Atqc',
                       "select count(*) from pg_namespace where nspname in ('pcm','config','auth')")
        if count != '0':
            raise RuntimeError('Destino não está vazio; não sobrescrever.')
        # Apenas leitura do banco-base conhecido; filtros preservam ACLs e removem extensões do host.
        dump = docker('exec', source, 'pg_dump', '-U', 'postgres', '--no-owner', '-N', 'cron', '-N', 'net', 'postgres')
        omitted = ('CREATE EXTENSION IF NOT EXISTS pg_cron ', 'COMMENT ON EXTENSION pg_cron ',
                   'CREATE EXTENSION IF NOT EXISTS pg_net ', 'COMMENT ON EXTENSION pg_net ')
        lines = [line for line in dump.splitlines() if not line.startswith(omitted)
                 and not (line.startswith('GRANT ') and (' cron.' in line or ' net.' in line or ' ON SCHEMA cron ' in line or ' ON SCHEMA net ' in line))]
        docker('exec', '-i', database, 'psql', '-U', 'supabase_admin', '-d', target, '-v', 'ON_ERROR_STOP=1', '-q', input_text='\n'.join(lines) + '\n')
        root = Path(__file__).resolve().parents[4]
        migrations = sorted(p for p in (root / 'supabase' / 'migrations').glob('*.sql') if p.name[:4].isdigit() and 1614 <= int(p.name[:4]) <= 1758)
        if not migrations or not any(p.name.startswith('1758_') for p in migrations):
            raise RuntimeError('Migrations obrigatórias ausentes.')
        for migration in migrations:
            try:
                docker('exec', '-i', database, 'psql', '-U', 'supabase_admin', '-d', target, '-v', 'ON_ERROR_STOP=1', '-q', input_text=migration.read_text())
            except subprocess.CalledProcessError as exc:
                raise RuntimeError('Migration falhou: ' + migration.name) from exc
        attest(network, database)
        print('Clone sintético restaurado; migrations aplicadas:', len(migrations))
        print('Ainda faltam Auth, PostgREST e navegador isolados.')
        return
    docker('image', 'inspect', IMAGE)  # Não baixa imagens nem usa credenciais do usuário.
    password = secrets.token_urlsafe(32)
    criado_rede = criado_db = False
    try:
        docker('network', 'create', '--internal', '--label', 'sso.ensaio=' + args.id, network)
        criado_rede = True
        docker('run', '-d', '--name', database, '--network', network, '--label', 'sso.ensaio=' + args.id,
               '--env', 'POSTGRES_PASSWORD=' + password, IMAGE)
        criado_db = True
        for _ in range(45):
            try:
                docker('exec', database, 'pg_isready', '-U', 'postgres', '-d', 'postgres')
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError('Banco não iniciou no prazo.')
        try:
            docker('exec', database, 'createdb', '-U', 'postgres', 'sso_s166_' + args.id)
        except subprocess.CalledProcessError as exc:
            # Apenas mensagens conhecidas, sem ecoar argumentos, credenciais ou dados.
            stderr = exc.stderr or ''
            causas = ('database system is starting up', 'database system is shutting down',
                      'connection refused', 'No space left on device', 'permission denied',
                      'already exists', 'connection to server was lost')
            identificada = next((causa for causa in causas if causa.lower() in stderr.lower()), None)
            raise RuntimeError('Criação do banco descartável falhou: ' + (identificada or 'causa não classificada')) from exc
        for _ in range(30):
            try:
                attest(network, database)
                break
            except subprocess.CalledProcessError:
                time.sleep(1)
        else:
            raise RuntimeError('Banco não estabilizou após inicialização.')
        print('Nenhuma fixture foi carregada; faltam Auth, PostgREST e navegador isolados.')
    except Exception:
        if criado_db:
            subprocess.run(['docker', 'rm', '-f', database], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if criado_rede:
            subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        raise


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, KeyError, ValueError) as exc:
        # Nunca imprimir argumentos de docker que possam conter senha sintética.
        print('Falha no bootstrap isolado:', str(exc) if isinstance(exc, RuntimeError) else ' '.join(exc.cmd[:4]) if isinstance(exc, subprocess.CalledProcessError) else type(exc).__name__, file=sys.stderr)
        sys.exit(1)
