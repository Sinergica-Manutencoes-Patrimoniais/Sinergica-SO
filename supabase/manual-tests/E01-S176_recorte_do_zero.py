#!/usr/bin/env python3
"""Aplica base Git e manifesto candidato em PostgreSQL descartável, sem Auvo.

O teste para na primeira falha. Não publica portas, não utiliza credenciais reais e
não altera serviços existentes. Resultado não substitui Auth/Storage/Edge reais.
"""
import hashlib
import json
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-migrations.json"
FOTOS = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-fotos-40e3c9f.json"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.141"
AUTH_IMAGE = "public.ecr.aws/supabase/gotrue:v2.197.0"
IDENT = secrets.token_hex(6)
NETWORK = "sso-recorte-" + IDENT
CONTAINER = NETWORK + "-db"
AUTH_CONTAINER = NETWORK + "-auth"
created_net = created_container = False
initial_volumes = None
space_before = None
watchdog_stop = threading.Event()
watchdog_triggered = threading.Event()
watchdog_thread = None
watchdog_lock = threading.Lock()
auth_container_id = None
MINIMO_LIVRE = 8 * 1024**3


def run(args, data=None):
    try:
        p = subprocess.run(args, input=data, capture_output=True, timeout=15)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo de comando excedido") from None
    if p.returncode: raise RuntimeError("Falha ao executar " + args[0])
    return p.stdout


def docker(*args, data=None):
    return run(["rtk", "proxy", "docker", *args], data).decode().strip()


def git(*args):
    return run(["rtk", "proxy", "git", *args])


def inspect(kind, name):
    return json.loads(docker("inspect", "--type", kind, name))[0]


def sql(data, label):
    # Sem transações embutidas ou comandos explicitamente não transacionais: parar em vez
    # de alegar atomicidade que o psql não pode garantir.
    if re.search(rb"(?im)^\s*(?:begin|commit|rollback)\s*;|^\s*(?:vacuum|create\s+database|alter\s+system)\b|\bcreate\s+(?:unique\s+)?index\s+concurrently\b", data):
        raise RuntimeError("Migration incompatível com transação única: " + label)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"], input=data, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da migration excedido: " + label) from None
    if p.returncode:
        output = p.stderr.decode(errors="replace")
        # Sem SQL, caminhos de conexão ou dados do erro: registrar só estado e arquivo.
        m = re.search(r"ERROR:\s+([A-Z0-9]{5}):", output)
        raise RuntimeError("Migration " + label + "; SQLSTATE " + (m.group(1) if m else "não identificado"))


def query(statement):
    return docker("exec", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atqc", statement)


def docker_monitor(*args):
    p = subprocess.run(["rtk", "proxy", "docker", *args], capture_output=True, timeout=4)
    if p.returncode: raise RuntimeError("docker indisponível")
    return p.stdout.decode().strip()


def monitorar(container_id):
    """Falha fechada: só pode parar o ID criado, com nome e rótulo esperados."""
    while not watchdog_stop.is_set():
        try:
            host = shutil.disk_usage(ROOT).free
            vm = int(docker_monitor("exec", "sso-validacao-isolada-20261104", "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024
            if min(host, vm) < MINIMO_LIVRE:
                raise RuntimeError("limite de espaço")
        except Exception:
            watchdog_triggered.set()
            with watchdog_lock:
                for alvo, nome in ((container_id, CONTAINER), (auth_container_id, AUTH_CONTAINER)):
                    if not alvo: continue
                    try:
                        c = json.loads(docker_monitor("inspect", "--type", "container", alvo))[0]
                        if c["Id"] != alvo or c["Name"] != "/" + nome or c["Config"].get("Labels", {}).get("sso.recorte") != IDENT:
                            raise RuntimeError("identidade divergente")
                        if c["State"]["Running"]: docker_monitor("kill", alvo)
                    except Exception:
                        # A execução principal detectará a marca e fará cleanup verificado.
                        pass
            return
        if watchdog_stop.wait(1): return


def main():
    global created_net, created_container, initial_volumes, space_before, watchdog_thread, auth_container_id
    manifest = json.loads(MANIFEST.read_text())
    fotos = json.loads(FOTOS.read_text())
    base, source = manifest["base_main"], manifest["fonte_backup"]
    if base != fotos["base_main"] or source != fotos["snapshot_original_preservado"]:
        raise RuntimeError("Manifestos com base divergente")
    # Verificar integralidade antes de criar qualquer container.
    paths = git("ls-tree", "-r", "--name-only", base, "supabase/migrations").decode().splitlines()
    base_files = [p for p in paths if re.search(r"/\d{4}_[^/]+\.sql$", p)]
    if not base_files or len(base_files) != len(set(base_files)): raise RuntimeError("Base Git incompleta")
    candidates = manifest["migrations"]
    if len(candidates) != manifest["contagem"]: raise RuntimeError("Contagem do manifesto divergente")
    blobs = []
    for item in candidates:
        data = git("show", source + ":" + item["caminho"])
        if hashlib.sha256(data).hexdigest() != item["sha256"] or git("rev-parse", source + ":" + item["caminho"]).decode().strip() != item["git_blob"]:
            raise RuntimeError("Hash divergente: " + item["caminho"])
        blobs.append((item["caminho"], data))
    for item in fotos["novas_migrations_candidatas"]:
        data = git("show", fotos["fonte_backup"] + ":" + item["caminho"])
        if hashlib.sha256(data).hexdigest() != item["sha256"] or git("rev-parse", fotos["fonte_backup"] + ":" + item["caminho"]).decode().strip() != item["git_blob"]: raise RuntimeError("Hash de foto divergente")
        blobs.append((item["caminho"], data))
    names = [p for p, _ in blobs]
    if len(names) != len(set(names)) or names != sorted(names): raise RuntimeError("Ordem ou duplicidade no manifesto")
    numeros = [Path(p).name[:4] for p in base_files + names]
    if len(numeros) != len(set(numeros)): raise RuntimeError("Número de migration duplicado entre base e candidatas")
    for imagem in (IMAGE, AUTH_IMAGE):
        image = json.loads(docker("image", "inspect", imagem))[0]
        if image["Config"].get("Volumes"): raise RuntimeError("Imagem declara volumes implícitos")
    initial_volumes = set(docker("volume", "ls", "-q").splitlines())
    # A base só é consultada para dimensionamento. Não são lidos/copied dados dela.
    source_container = "sso-validacao-isolada-20261104"
    src = inspect("container", source_container)
    if src["Config"]["Image"] != IMAGE or src["HostConfig"].get("NetworkMode") != "none" or src["Mounts"] or any(src["NetworkSettings"].get("Ports", {}).values()):
        raise RuntimeError("Referência de espaço não atestada")
    database_bytes = int(docker("exec", source_container, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "select pg_database_size(current_database())"))
    data_dir = docker("exec", source_container, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "show data_directory")
    if not data_dir.startswith("/var/lib/postgresql/") or ".." in data_dir: raise RuntimeError("Diretório de WAL não reconhecido")
    wal_bytes = int(docker("exec", source_container, "du", "-sk", data_dir + "/pg_wal").split()[0]) * 1024
    vm_bytes = int(docker("exec", source_container, "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024
    budget = 2 * database_bytes + 2 * wal_bytes + sum(len(b) for _, b in blobs) * 4
    host_bytes = shutil.disk_usage(ROOT).free
    space_before = (host_bytes, vm_bytes)
    print(f"Espaço antes: host={host_bytes} bytes; VM={vm_bytes} bytes; orçamento estimado={budget} bytes.", flush=True)
    if min(host_bytes, vm_bytes) < max(budget, MINIMO_LIVRE):
        raise RuntimeError("Espaço de host ou VM abaixo do orçamento ou do mínimo de 8 GiB")
    print("Orçamento de banco/WAL é estimativa inicial; não garante pico de migrações.", flush=True)
    docker("network", "create", "--internal", "--label", "sso.recorte=" + IDENT, NETWORK); created_net = True
    net = inspect("network", NETWORK)
    if not net["Internal"] or net["Labels"].get("sso.recorte") != IDENT: raise RuntimeError("Rede não atestada")
    password = secrets.token_hex(32)
    docker("create", "--name", CONTAINER, "--network", NETWORK, "--label", "sso.recorte=" + IDENT, "--env", "POSTGRES_PASSWORD=" + password, IMAGE, "postgres", "-c", "cron.launch_active_jobs=off"); created_container = True
    info = inspect("container", CONTAINER)
    if info["Mounts"] or info["HostConfig"].get("Privileged") or info["HostConfig"].get("NetworkMode") != NETWORK or info["HostConfig"].get("PortBindings"):
        raise RuntimeError("Banco fora do isolamento")
    docker("start", CONTAINER)
    info = inspect("container", CONTAINER)
    if set(info["NetworkSettings"]["Networks"]) != {NETWORK} or any(info["NetworkSettings"].get("Ports", {}).values()) or info["Mounts"]:
        raise RuntimeError("Banco iniciado fora do isolamento")
    container_id = info["Id"]
    watchdog_thread = threading.Thread(target=monitorar, args=(container_id,), daemon=True)
    watchdog_thread.start()
    for _ in range(45):
        try:
            if query("select (extract(epoch from clock_timestamp()-pg_postmaster_start_time()) >= 5)::text") == "true": break
        except Exception: pass
        time.sleep(1)
    else: raise RuntimeError("Banco não ficou pronto")
    if query("select current_setting('cron.launch_active_jobs',true)") != "off": raise RuntimeError("Cron não está desabilitado")
    # Não permitir segredos ou usuários reais no banco recém-criado pela imagem.
    if query("select (select count(*) from auth.users)=0 and (select count(*) from vault.secrets)=0") != "t": raise RuntimeError("Imagem iniciou com dados inesperados")
    # O PostgreSQL inicial contém auth.users, mas não auth.jwt(). Executar as
    # migrations da imagem oficial Auth antes das migrations do projeto; nenhum stub.
    auth_password, jwt_secret = secrets.token_hex(32), secrets.token_hex(32)
    sql(("alter role supabase_auth_admin password '" + auth_password + "';").encode(), "senha efêmera Auth")
    auth_env = {
        "GOTRUE_DB_DRIVER": "postgres", "GOTRUE_DB_NAMESPACE": "auth",
        "GOTRUE_DB_DATABASE_URL": "postgres://supabase_auth_admin:" + auth_password + "@" + CONTAINER + ":5432/postgres",
        "GOTRUE_API_HOST": "0.0.0.0", "GOTRUE_API_PORT": "9999",
        "API_EXTERNAL_URL": "http://" + AUTH_CONTAINER + ":9999", "GOTRUE_SITE_URL": "http://localhost",
        "GOTRUE_JWT_SECRET": jwt_secret, "GOTRUE_JWT_AUD": "authenticated",
        "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated", "GOTRUE_DISABLE_SIGNUP": "true",
    }
    args = ["create", "--name", AUTH_CONTAINER, "--network", NETWORK, "--label", "sso.recorte=" + IDENT]
    for key, value in auth_env.items(): args += ["--env", key + "=" + value]
    docker(*args, AUTH_IMAGE)
    auth = inspect("container", AUTH_CONTAINER)
    auth_container_id = auth["Id"]
    if auth["Mounts"] or auth["HostConfig"].get("Privileged") or auth["HostConfig"].get("NetworkMode") != NETWORK or auth["HostConfig"].get("PortBindings"):
        raise RuntimeError("Auth fora do isolamento antes de iniciar")
    with watchdog_lock:
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
        docker_monitor("start", AUTH_CONTAINER)
    auth = inspect("container", AUTH_CONTAINER)
    if set(auth["NetworkSettings"]["Networks"]) != {NETWORK} or any(auth["NetworkSettings"].get("Ports", {}).values()) or auth["Mounts"]:
        raise RuntimeError("Auth iniciado fora do isolamento")
    for _ in range(45):
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
        auth = inspect("container", AUTH_CONTAINER)
        if not auth["State"]["Running"]: raise RuntimeError("Auth encerrou antes do readiness")
        try:
            ready = docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + AUTH_CONTAINER + ":9999/health")
            if ready == "200": break
        except Exception: pass
        time.sleep(1)
    else: raise RuntimeError("Auth não ficou pronto")
    if query("select to_regprocedure('auth.jwt()') is not null and to_regprocedure('auth.uid()') is not null and to_regprocedure('auth.role()') is not null") != "t":
        raise RuntimeError("Migrations oficiais Auth incompletas")
    print("Auth oficial pronto; funções de claims presentes.", flush=True)
    prefix = b"\\set VERBOSITY verbose\n"
    for path in base_files:
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
        if min(shutil.disk_usage(ROOT).free, int(docker("exec", source_container, "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024) < budget:
            raise RuntimeError("Espaço atingiu limite durante aplicação da base")
        sql(prefix + git("show", base + ":" + path), path)
    print("Base Git aplicada:", len(base_files), flush=True)
    for path, data in blobs:
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
        if min(shutil.disk_usage(ROOT).free, int(docker("exec", source_container, "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024) < budget:
            raise RuntimeError("Espaço atingiu limite durante aplicação do recorte")
        sql(prefix + data, path)
    print("Migrations candidatas aplicadas:", len(blobs), flush=True)
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0") != "t": raise RuntimeError("Banco contém dados inesperados")
    if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
    print("PASS: compilação das migrations selecionadas em banco descartável; testes funcionais não executados.")


if __name__ == "__main__":
    code = 0
    try: main()
    except Exception as exc: print("FALHA:", str(exc)); code = 1
    finally:
        watchdog_stop.set()
        if watchdog_thread is not None:
            watchdog_thread.join(timeout=25)
            if watchdog_thread.is_alive():
                print("Monitor não encerrou; limpeza bloqueada para evitar corrida.")
                sys.exit(1)
        if watchdog_triggered.is_set():
            print("Monitor acionado: limite de espaço ou falha de medição.")
            code = 1
        # Varrer por rótulo e nome, inclusive se `docker create` tiver falhado depois
        # de criar o recurso. Nunca remover volume anterior à execução.
        try:
            containers = docker("ps", "-a", "--filter", "label=sso.recorte=" + IDENT, "--format", "{{.ID}}").splitlines()
            for container_id in containers:
                c = inspect("container", container_id)
                if c["Name"] not in ("/" + CONTAINER, "/" + AUTH_CONTAINER) or c["Config"].get("Labels", {}).get("sso.recorte") != IDENT:
                    raise RuntimeError("identidade do container divergente")
                volumes = {m["Name"] for m in c["Mounts"] if m.get("Type") == "volume"}
                if volumes and (initial_volumes is None or volumes.intersection(initial_volumes)):
                    docker("rm", "-f", container_id)
                    raise RuntimeError("volume anterior ou sem baseline preservado")
                docker("rm", "-f", "-v", container_id)
                remaining = set(docker("volume", "ls", "-q").splitlines())
                for volume in volumes.intersection(remaining): docker("volume", "rm", volume)
                if volumes.intersection(set(docker("volume", "ls", "-q").splitlines())): raise RuntimeError("volume próprio restante")
            networks = docker("network", "ls", "--filter", "label=sso.recorte=" + IDENT, "--format", "{{.ID}}").splitlines()
            for network_id in networks:
                n = inspect("network", network_id)
                if n["Name"] != NETWORK or n["Labels"].get("sso.recorte") != IDENT: raise RuntimeError("identidade da rede divergente")
                docker("network", "rm", network_id)
            if docker("ps", "-a", "--filter", "label=sso.recorte=" + IDENT, "--format", "{{.ID}}") or docker("network", "ls", "--filter", "label=sso.recorte=" + IDENT, "--format", "{{.ID}}"):
                raise RuntimeError("recursos restantes")
            print("Recursos exclusivos removidos ou inexistentes.")
        except Exception:
            print("Limpeza não comprovada; nenhum recurso sem identidade foi removido.")
            code = 1
        if space_before is not None:
            try:
                host_after = shutil.disk_usage(ROOT).free
                vm_after = int(docker("exec", "sso-validacao-isolada-20261104", "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024
                print(f"Espaço depois: host={host_after} bytes; VM={vm_after} bytes.")
            except Exception:
                print("Espaço após limpeza indisponível.")
                code = 1
    sys.exit(code)
