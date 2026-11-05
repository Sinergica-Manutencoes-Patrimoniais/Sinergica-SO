#!/usr/bin/env python3
"""Ensaio descartável de fotos S176. Não usa portas no host nem Auvo.

Executar somente após revisão. Toda saída é resumida. Credenciais sintéticas ficam
em memória e no ambiente/metadados dos containers descartáveis, visíveis a quem tem
acesso ao daemon Docker até a remoção. Nunca são gravadas em arquivos do projeto.
"""
import base64
import hashlib
import hmac
import json
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
BOOT = ROOT / "apps/web/e2e/s166-isolado/bootstrap-interno.py"
BASE = "sso-validacao-isolada-20261104"
IMAGES = ("public.ecr.aws/supabase/postgres:17.6.1.141", "public.ecr.aws/supabase/gotrue:v2.197.0", "public.ecr.aws/supabase/postgrest:v14.5", "public.ecr.aws/supabase/storage-api:v1.77.5", "supabase/edge-runtime:v1.77.4")
IDENT = secrets.token_hex(6)
NET = "sso-s166-e2e-" + IDENT
DB = NET + "-db"
DATABASE = "sso_s166_" + IDENT
extras = []
created = False
initial_volumes = set()


def run(args, data=None):
    p = subprocess.run(args, input=data, capture_output=True)
    if p.returncode:
        raise RuntimeError("Etapa falhou: " + args[0])
    return p.stdout


def docker(*args, data=None):
    return run(["rtk", "proxy", "docker", *args], data).decode().strip()


def boot(step):
    run([sys.executable, str(BOOT), step, "--id", IDENT])


def sql(text):
    return docker("exec", "-i", DB, "psql", "-X", "-U", "supabase_admin", "-d", DATABASE, "-v", "ON_ERROR_STOP=1", "-qAt", data=text.encode())


def inspect(kind, name):
    return json.loads(docker("inspect", "--type", kind, name))[0]


def atestar(name):
    obj = inspect("container", name)
    if obj["Config"].get("Labels", {}).get("sso.ensaio") != IDENT or set(obj["NetworkSettings"]["Networks"]) != {NET} or any(obj["NetworkSettings"].get("Ports", {}).values()) or obj["Mounts"] or obj["HostConfig"].get("Privileged"):
        raise RuntimeError("Container fora do isolamento esperado")


def conferir_espaco():
    base_bytes = int(docker("exec", BASE, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "select pg_database_size(current_database())"))
    writable = int(docker("inspect", "--size", "--format", "{{.SizeRw}}", BASE))
    budget = 2 * base_bytes + 4 * 10 * 1024 * 1024 + writable
    vm_free = int(docker("exec", BASE, "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024
    if shutil.disk_usage(ROOT).free < budget or vm_free < budget:
        raise RuntimeError("Espaço inferior ao orçamento medido")


def token(secret, role):
    def enc(v): return base64.urlsafe_b64encode(v).rstrip(b"=")
    a = enc(b'{"alg":"HS256","typ":"JWT"}')
    b = enc(json.dumps({"role": role, "iss": "supabase", "iat": int(time.time()), "exp": int(time.time()) + 1800}, separators=(",", ":")).encode())
    return (a + b"." + b + b"." + enc(hmac.new(secret.encode(), a + b"." + b, hashlib.sha256).digest())).decode()


def iniciar(name, image, env, command=None, bundle=None):
    conferir_espaco()
    args = ["create", "--name", name, "--network", NET, "--label", "sso.ensaio=" + IDENT]
    for key, value in env.items(): args += ["--env", key + "=" + value]
    args += [image] + (command or [])
    docker(*args)
    extras.append(name)
    if bundle: docker("cp", str(bundle), name + ":/tmp/index.ts")
    atestar(name)
    docker("start", name)


def request(url, method="GET", headers=None, body=b""):
    args = ["exec", "-i", DB, "curl", "--silent", "--show-error", "--max-time", "35", "--request", method, "--output", "-", "--write-out", "\n%{http_code}"]
    for key, value in (headers or {}).items(): args += ["--header", key + ": " + value]
    if method in ("POST", "PUT"): args += ["--data-binary", "@-"]
    raw = run(["rtk", "proxy", "docker", *args, url], body)
    payload, status = raw.rsplit(b"\n", 1)
    return int(status), payload


def wait_http(url, accepted):
    for _ in range(30):
        try:
            status, _ = request(url)
            if status in accepted: return
        except Exception: pass
        time.sleep(1)
    raise RuntimeError("Serviço interno não ficou pronto")


def main():
    global created, initial_volumes
    base = inspect("container", BASE)
    if (base["Config"]["Image"] != IMAGES[0] or base["HostConfig"].get("NetworkMode") != "none"
        or set(base["NetworkSettings"]["Networks"]) != {"none"} or base["Mounts"] or any(base["NetworkSettings"].get("Ports", {}).values())):
        raise RuntimeError("Origem sintética não comprovada")
    # Procedência documentada em docs/STATE.md:851. Verificar somente contagens e formatos,
    # nunca copiar dados da origem; dump abaixo usa --schema-only.
    check = "select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0 and (select count(*) from cron.job where active)=0 and current_setting('cron.launch_active_jobs',true)='off' and (select count(*) from net.http_request_queue)=0 and (select count(*) from pcm.auvo_sync_outbox where entity !~* '^[a-z_]{1,32}$' or op !~* '^[a-z_]{1,32}$' or last_error is not null)=0"
    if docker("exec", BASE, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", check) != "t":
        raise RuntimeError("Estado da origem sintética divergiu da documentação")
    for image in IMAGES:
        if json.loads(docker("image", "inspect", image))[0]["Config"].get("Volumes"):
            raise RuntimeError("Imagem declara volume implícito")
    initial_volumes = set(docker("volume", "ls", "-q").splitlines())
    conferir_espaco()
    with tempfile.TemporaryDirectory(prefix="sso-s176-fotos-") as tmp:
        tmp = Path(tmp)
        bundles = {}
        for src in ("pcm-ingestao-foto-cadastral-grupo", "pcm-foto-cadastral-grupo-segura"):
            out = tmp / (src + ".js")
            run(["deno", "bundle", "--deny-import", "--no-lock", "--node-modules-dir=none", "-o", str(out), str(ROOT / "supabase/functions" / src / "index.ts")])
            bundles[src] = out
        boot("criar"); created = True
        network = inspect("network", NET)
        if not network["Internal"] or network["Labels"].get("sso.ensaio") != IDENT: raise RuntimeError("Rede não interna")
        boot("verificar")
        # Dump de schema somente: não copiar dados, inclusive outbox, da fonte.
        dump = docker("exec", BASE, "pg_dump", "-U", "postgres", "--schema-only", "--no-owner", "-N", "cron", "-N", "net", "postgres")
        omit = ("CREATE EXTENSION IF NOT EXISTS pg_cron ", "COMMENT ON EXTENSION pg_cron ", "CREATE EXTENSION IF NOT EXISTS pg_net ", "COMMENT ON EXTENSION pg_net ")
        sql("\n".join(line for line in dump.splitlines() if not line.startswith(omit) and not (line.startswith("GRANT ") and (" cron." in line or " net." in line or " ON SCHEMA cron " in line or " ON SCHEMA net " in line))))
        for number in ("0248", "0434", "0437", "0445", "0465"):
            import re
            text = next((ROOT / "supabase/migrations").glob(number + "_*.sql")).read_text()
            match = re.search(r"insert into config\.sso_acoes\s*\([^;]+?;", text, re.I | re.S)
            if not match: raise RuntimeError("Seed original ausente")
            sql(match.group())
        for number, target in (("0248", "config.sso_acao_modulos"), ("0383", "pcm.sso_grupo_fotos_gate"), ("0385", "storage.buckets")):
            import re
            text = next((ROOT / "supabase/migrations").glob(number + "_*.sql")).read_text()
            match = re.search(r"insert into " + re.escape(target) + r"\s*\([^;]+?;", text, re.I | re.S)
            if not match: raise RuntimeError("Seed original ausente")
            sql(match.group())
        text = next((ROOT / "supabase/migrations").glob("1303_*.sql")).read_text()
        sql(next(line for line in text.splitlines() if line.startswith("insert into config.sso_capacidade_cadastros_legados_gate(")))
        for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
            if migration.name[:4].isdigit() and 1614 <= int(migration.name[:4]) <= 1803:
                conferir_espaco(); sql(migration.read_text())
        if sql("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from pcm.auvo_sync_outbox)=0") != "t": raise RuntimeError("Clone contém dados inesperados")
        boot("servicos"); boot("verificar")
        auth_env = inspect("container", NET + "-auth")["Config"]["Env"]
        secret = next(v.split("=", 1)[1] for v in auth_env if v.startswith("GOTRUE_JWT_SECRET="))
        anon, service, password = token(secret, "anon"), token(secret, "service_role"), secrets.token_hex(24)
        # PostgREST do bootstrap omite atendimento, necessário para rate limit da função.
        rest_env = inspect("container", NET + "-rest")["Config"]["Env"]
        rest = {v.split("=", 1)[0]: v.split("=", 1)[1] for v in rest_env if v.startswith("PGRST_")}
        rest["PGRST_DB_SCHEMAS"] = "public,pcm,config,atendimento"
        docker("rm", "-f", NET + "-rest")
        iniciar(NET + "-rest", IMAGES[2], rest)
        sql("alter role supabase_storage_admin password '" + password + "'; alter schema storage owner to supabase_storage_admin; do $$ declare r record; begin for r in select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relkind in ('r','p','v','m','S') loop execute format('alter %s storage.%I owner to supabase_storage_admin',case r.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'materialized view' else 'table' end,r.relname);end loop; for r in select p.oid::regprocedure assinatura from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='storage' and p.prokind='f' loop execute format('alter function %s owner to supabase_storage_admin',r.assinatura);end loop;end $$;")
        storage = NET + "-storage"
        storage_env = {"ANON_KEY": anon, "SERVICE_KEY": service, "POSTGREST_URL": "http://" + NET + "-rest:3000", "AUTH_JWT_SECRET": secret, "DATABASE_URL": "postgres://supabase_storage_admin:" + password + "@" + DB + ":5432/" + DATABASE, "STORAGE_PUBLIC_URL": "http://" + storage + ":5000", "STORAGE_BACKEND": "file", "FILE_STORAGE_BACKEND_PATH": "/tmp/sso-storage", "GLOBAL_S3_BUCKET": "sso-synthetic", "TENANT_ID": "sso-synthetic", "REGION": "local", "ENABLE_IMAGE_TRANSFORMATION": "false"}
        iniciar(storage, IMAGES[3], storage_env); wait_http("http://" + storage + ":5000/status", {200})
        gateway = NET + "-gateway"
        gateway_env = {"AUTH_ORIGIN": "http://" + NET + "-auth:9999", "REST_ORIGIN": "http://" + NET + "-rest:3000", "STORAGE_ORIGIN": "http://" + storage + ":5000"}
        iniciar(gateway, IMAGES[4], gateway_env, ["start", "--main-service", "/tmp", "--port", "9000"], HERE / "gateway.ts")
        wait_http("http://" + gateway + ":9000/auth/v1/health", {200})
        base_env = {"SUPABASE_URL": "http://" + gateway + ":9000", "SUPABASE_ANON_KEY": anon, "SUPABASE_SERVICE_ROLE_KEY": service, "SSO_FOTO_CADASTRAL_GRUPO_ENABLED": "true", "SSO_INGESTAO_FOTO_CADASTRAL_GRUPO_ENABLED": "true"}
        for key, suffix in (("pcm-ingestao-foto-cadastral-grupo", "-upload"), ("pcm-foto-cadastral-grupo-segura", "-read")):
            iniciar(NET + suffix, IMAGES[4], base_env, ["start", "--main-service", "/tmp", "--port", "9000"], bundles[key])
            wait_http("http://" + NET + suffix + ":9000/", {405})
        executar_fixture(gateway, anon, service)


def executar_fixture(gateway, anon, service):
    # IDs e credenciais restritos a esta execução; sem dados pessoais.
    import uuid
    actor, client, area, local, category, group, request_id = [str(uuid.uuid4()) for _ in range(7)]
    email, password = "s176-" + IDENT + "@example.test", secrets.token_hex(20) + "aA1!"
    sql(f"""begin; set local app.auvo_sync_write='true';
      insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change,email_change_token_new,raw_app_meta_data,raw_user_meta_data,is_sso_user,created_at,updated_at) values('{actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{email}',crypt('{password}',gen_salt('bf')),now(),'','','','', '{{}}','{{}}',false,now(),now());
      insert into config.usuarios(user_id,papel,nome,ativo) values('{actor}','colaborador','Ensaio',true);
      insert into config.usuario_modulos(user_id,modulo,nivel) values('{actor}','pcm','escrita');
      insert into pcm.clientes(id,nome,ativo,created_by) values('{client}','Cliente sintético',true,'{actor}');
      insert into pcm.areas(id,cliente_id,nome) values('{area}','{client}','Área');
      insert into pcm.locais(id,area_id,nome) values('{local}','{area}','Local');
      insert into pcm.equipamento_categorias(id,nome) values('{category}','Categoria sintética');
      insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,nome,quantidade,created_by,updated_by) values('{group}','{client}','{local}','{category}','Grupo',1,'{actor}','{actor}');
      insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('{actor}','cadastro.gerir','{client}');
      update pcm.sso_grupo_fotos_gate set habilitado=true where id; update pcm.sso_ingestao_foto_cadastral_grupo_gate set habilitado=true where id; update pcm.sso_foto_cadastral_grupo_leitura_gate set habilitado=true where id; commit;""")
    status, response = request("http://" + gateway + ":9000/auth/v1/token?grant_type=password", "POST", {"apikey": anon, "Content-Type": "application/json"}, json.dumps({"email": email, "password": password}).encode())
    if status != 200: raise RuntimeError("Login sintético falhou")
    access = json.loads(response)["access_token"]
    common = {"Authorization": "Bearer " + access, "apikey": anon}
    png = bytes([137,80,78,71,13,10,26,10,0,0,0,0])
    upload = {**common, "Content-Type": "image/png", "x-request-id": request_id, "x-cliente-id": client, "x-grupo-id": group}
    address = "http://" + NET + "-upload:9000/"
    status, result = request(address, "POST", upload, png)
    if status != 200: raise RuntimeError("Envio sintético não confirmado (" + str(status) + ")")
    recibo = json.loads(result)
    if not isinstance(recibo, dict) or set(recibo) != {"fotoId", "requestId"} or recibo["requestId"] != request_id:
        raise RuntimeError("Recibo de envio divergente")
    try: foto = str(uuid.UUID(recibo["fotoId"]))
    except (KeyError, ValueError, TypeError, AttributeError): raise RuntimeError("Identificador de foto inválido")
    if foto != recibo["fotoId"]: raise RuntimeError("Identificador de foto não canônico")
    status, replay = request(address, "POST", upload, png)
    if status != 200 or json.loads(replay) != recibo: raise RuntimeError("Replay divergente")
    contagens = sql(f"select (select count(*) from pcm.sso_ingestao_foto_cadastral_grupo_reservas where request_id='{request_id}' and foto_id='{foto}' and grupo_id='{group}' and cliente_id='{client}' and confirmado_em is not null)::text||':'||(select count(*) from pcm.sso_grupo_fotos where id='{foto}' and grupo_id='{group}' and cliente_id='{client}')::text||':'||(select count(*) from pcm.sso_grupo_fotos where grupo_id='{group}' and cliente_id='{client}')::text||':'||(select count(*) from storage.objects where bucket_id='sso-grupos-fotos' and name like '{client}/{group}/%')::text")
    if contagens != "1:1:1:1": raise RuntimeError("Reserva, foto ou objeto duplicado/ausente")
    read = "http://" + NET + "-read:9000/"
    payload = json.dumps({"clienteId": client, "grupoId": group, "fotoId": foto}).encode()
    status, result = request(read, "POST", {**common, "Content-Type": "application/json"}, payload)
    if status != 200 or result != png: raise RuntimeError("Leitura verificada divergente")
    # Substituição privilegiada apenas no Storage descartável comprova rejeição de digest.
    path = sql(f"select nome from pcm.sso_ingestao_foto_cadastral_grupo_reservas where request_id='{request_id}'")
    if not path.startswith(client + "/" + group + "/"): raise RuntimeError("Caminho sintético divergente")
    status, _ = request("http://" + gateway + ":9000/storage/v1/object/sso-grupos-fotos/" + path, "POST", {"Authorization": "Bearer " + service, "apikey": service, "Content-Type": "image/png", "x-upsert": "true"}, png + b"x")
    if status not in (200, 201): raise RuntimeError("Não foi possível alterar objeto sintético")
    status, _ = request(read, "POST", {**common, "Content-Type": "application/json"}, payload)
    if status != 409: raise RuntimeError("Digest divergente não foi recusado")
    sql(f"update config.sso_concessoes set ativa=false where usuario_id='{actor}' and cliente_id='{client}' and acao='cadastro.gerir'")
    if sql(f"select count(*) from config.sso_concessoes where usuario_id='{actor}' and cliente_id='{client}' and acao='cadastro.gerir' and ativa") != "0": raise RuntimeError("Revogação não confirmada")
    status, _ = request(address, "POST", upload, png)
    if status != 404: raise RuntimeError("Replay após revogação não confirmou recusa (" + str(status) + ")")
    status, _ = request(read, "POST", {**common, "Content-Type": "application/json"}, payload)
    if status != 404: raise RuntimeError("Leitura após revogação não confirmou recusa (" + str(status) + ")")
    if sql("select count(*) from pcm.auvo_sync_outbox") != "0": raise RuntimeError("Outbox sintética alterada")
    print("PASS: login, envio, replay, leitura, digest divergente e revogação em ambiente descartável.")


if __name__ == "__main__":
    exitcode = 0
    try:
        main()
    except Exception as exc:
        print("FALHA:", str(exc))
        exitcode = 1
    finally:
        owned_volumes = set()
        try:
            container_ids = docker("ps", "-a", "--filter", "label=sso.ensaio=" + IDENT, "--format", "{{.ID}}").splitlines()
            for container_id in container_ids:
                for mount in inspect("container", container_id)["Mounts"]:
                    if mount.get("Type") == "volume":
                        if mount["Name"] in initial_volumes: raise RuntimeError("Volume anterior anexado")
                        owned_volumes.add(mount["Name"])
                    else: raise RuntimeError("Mount não autorizado")
        except Exception:
            print("Falha ao identificar volumes exclusivos")
            exitcode = 1
        for name in reversed(extras):
            try:
                if inspect("container", name)["Config"].get("Labels", {}).get("sso.ensaio") != IDENT: raise RuntimeError("propriedade divergente")
                docker("rm", "-f", "-v", name)
            except Exception:
                print("Falha ao remover container exclusivo", name)
                exitcode = 1
        if created:
            try:
                boot("remover")
                remaining = docker("ps", "-a", "--filter", "label=sso.ensaio=" + IDENT, "--format", "{{.ID}}")
                networks = docker("network", "ls", "--filter", "label=sso.ensaio=" + IDENT, "--format", "{{.ID}}")
                volumes = set(docker("volume", "ls", "-q").splitlines())
                for volume in owned_volumes.intersection(volumes):
                    docker("volume", "rm", volume)
                volumes = set(docker("volume", "ls", "-q").splitlines())
                if remaining or networks or owned_volumes.intersection(volumes): raise RuntimeError("recursos restantes")
                print("Recursos descartáveis removidos.")
            except Exception:
                print("Falha ao remover clone exclusivo", NET)
                exitcode = 1
    sys.exit(exitcode)
