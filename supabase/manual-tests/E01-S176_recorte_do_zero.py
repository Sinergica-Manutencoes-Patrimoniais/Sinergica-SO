#!/usr/bin/env python3
"""Aplica base Git e manifesto candidato em PostgreSQL descartável, sem Auvo.

O teste para na primeira falha. Não publica portas, não utiliza credenciais reais e
não altera serviços existentes. Resultado não substitui Auth/Storage/Edge reais.
"""
import argparse
import base64
import hashlib
import hmac
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
OVERLAY_DINAMICO = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-diagnostico-dinamico.json"
OVERLAY_INTEGRACAO = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-integracao-84c9fcf.json"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.141"
AUTH_IMAGE = "public.ecr.aws/supabase/gotrue:v2.197.0"
REST_IMAGE = "public.ecr.aws/supabase/postgrest:v14.5"
STORAGE_IMAGE = "public.ecr.aws/supabase/storage-api:v1.77.5"
IDENT = secrets.token_hex(6)
NETWORK = "sso-recorte-" + IDENT
CONTAINER = NETWORK + "-db"
AUTH_CONTAINER = NETWORK + "-auth"
REST_CONTAINER = NETWORK + "-rest"
STORAGE_CONTAINER = NETWORK + "-storage"
created_net = created_container = False
initial_volumes = None
space_before = None
watchdog_stop = threading.Event()
watchdog_triggered = threading.Event()
watchdog_thread = None
watchdog_lock = threading.Lock()
auth_container_id = None
platform_container_ids = {}
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


def definir_senha_auth(password):
    # Somente esta configuração fixa precisa do superusuário da imagem. Nunca exibir SQL ou stderr.
    data = ("\\set VERBOSITY verbose\nalter role supabase_auth_admin password '" + password + "';\n"
        "alter role authenticator password '" + password + "';\n"
        "alter role supabase_storage_admin password '" + password + "';\n"
        "alter schema storage owner to supabase_storage_admin;\n").encode()
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"], input=data, capture_output=True, timeout=15)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido ao configurar Auth sintético") from None
    if p.returncode:
        m = re.search(r"ERROR:\s+([A-Z0-9]{5}):", p.stderr.decode(errors="replace"))
        raise RuntimeError("Configuração Auth falhou; SQLSTATE " + (m.group(1) if m else "não identificado"))


def diagnostico_auth():
    """Classifica logs em memória; nunca devolve mensagens, URLs, SQL ou credenciais."""
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "logs", "--tail", "100", AUTH_CONTAINER], capture_output=True, timeout=4)
        if p.returncode: return "logs indisponíveis"
        log = (p.stdout + p.stderr).decode(errors="replace").lower()
    except Exception:
        return "logs indisponíveis"
    # Somente rótulos fixos e não sensíveis; não ecoar fragmentos do serviço.
    categorias = (
        (r"permission denied|insufficient privilege|42501", "permissão do banco"),
        (r"password authentication failed|authentication failed for user|28p01", "autenticação no banco"),
        (r"connection refused|connection reset|no route to host|network is unreachable", "conexão ao banco"),
        (r"already exists|duplicate table|42p07|42710", "objeto de banco já existente"),
        (r"migration|migrat", "migração do Auth"),
        (r"missing|must be set|required|invalid configuration", "configuração do Auth"),
    )
    encontrados = [nome for padrao, nome in categorias if re.search(padrao, log)]
    return ", ".join(encontrados) if encontrados else "causa não classificada"


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
                alvos = [(container_id, CONTAINER), (auth_container_id, AUTH_CONTAINER), *[(identidade, nome) for nome, identidade in platform_container_ids.items()]]
                for alvo, nome in alvos:
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


def main(opcoes):
    global created_net, created_container, initial_volumes, space_before, watchdog_thread, auth_container_id
    fixtures = None
    aprovacao_1804 = None
    aprovacao_1805 = None
    if opcoes.aprovacao_1805:
        if not opcoes.aprovacao_1804 or not opcoes.integracao_candidata:
            raise RuntimeError("Migration 1805 exige --aprovacao-1804 e --integracao-candidata")
        caminho_1805 = "supabase/migrations/1805_E01-S165_exigir_versao_aprovacao.sql"
        aprovacao_1805 = (ROOT / caminho_1805).read_bytes()
        if hashlib.sha256(aprovacao_1805).hexdigest() != "2485e4c342f909e672f1773c2d3fe095b8bc885457292fd378fc79dc6c7dbf07":
            raise RuntimeError("Hash da migration 1805 divergente")
        import s165_aprovacao_1805_isolada
        fixture_1805 = s165_aprovacao_1805_isolada.preparar(ROOT)
    if opcoes.aprovacao_1804:
        if not opcoes.integracao_candidata:
            raise RuntimeError("Fixture 1804 exige --integracao-candidata")
        import s165_aprovacao_1804_isolada
        aprovacao_1804 = s165_aprovacao_1804_isolada.preparar(ROOT)
    if opcoes.concorrencia_parcial and not opcoes.integracao_candidata:
        raise RuntimeError("Concorrência parcial exige --integracao-candidata")
    if opcoes.fixtures_pgtap:
        if not opcoes.integracao_candidata:
            raise RuntimeError("Fixtures exigem --integracao-candidata")
        import s176_runner_pgtap
        fixtures = s176_runner_pgtap.preparar(ROOT)
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
    if opcoes.diagnostico_0415:
        overlay = json.loads(OVERLAY_DINAMICO.read_text())
        if overlay["base_main"] != base or overlay["fonte_backup"] != source:
            raise RuntimeError("Sobreposição diagnóstica com procedência divergente")
        additions = overlay["migrations_adicionais"]
        esperadas = (
            "0803_E01-S168_recebimento_origem_visita.sql",
            "0805_E01-S168_guarda_cobertura_origem_visita.sql",
            "0807_E01-S173_pendencia_origem_visita.sql",
            "0811_E01-S168_previa_cobertura_visita.sql",
            "0904_E01-S168_cobertura_retorno_grupo.sql",
            "0905_E01-S168_perguntas_retorno_grupo.sql",
        )
        if tuple(item["caminho"] for item in additions) != tuple("supabase/migrations/" + nome for nome in esperadas):
            raise RuntimeError("Sobreposição diagnóstica inesperada")
        for item in additions:
            path = item["caminho"]
            numero = Path(path).name[:4]
            if path in base_files or path in names or any(Path(p).name[:4] == numero for p in base_files + names):
                raise RuntimeError("Migration diagnóstica duplicada: " + numero)
            data = git("show", source + ":" + path)
            if hashlib.sha256(data).hexdigest() != item["sha256"] or git("rev-parse", source + ":" + path).decode().strip() != item["git_blob"]:
                raise RuntimeError("Hash da sobreposição diagnóstica divergente: " + numero)
            blobs.append((path, data))
        blobs.sort(key=lambda item: item[0])
        names = [p for p, _ in blobs]
        numeros_diag = [Path(p).name[:4] for p in names]
        cadeias = (("0402", "0726", "0729", "0803", "0903"),
                   ("0371", "0726", "0729", "0807", "0906"),
                   ("0582", "0805", "0904", "1692"),
                   ("0562", "0811", "0905", "1692"),
                   ("0815", "0823", "0904", "0905"))
        for cadeia in cadeias:
            if any(numeros_diag.count(n) != 1 for n in cadeia) or [numeros_diag.index(n) for n in cadeia] != sorted(numeros_diag.index(n) for n in cadeia):
                raise RuntimeError("Dependências diagnósticas ausentes ou fora de ordem")
        print("DIAGNÓSTICO: sobreposição de dependências dinâmicas ativa; resultado NÃO prova recorte implantável.", flush=True)
    if opcoes.integracao_candidata:
        overlay = json.loads(OVERLAY_INTEGRACAO.read_text())
        if overlay["base_main"] != base or overlay["fonte_backup"] != source:
            raise RuntimeError("Sobreposição de integração com procedência divergente")
        esperadas = (
            "0323_E01-S180_despesas_visita_fundacao.sql", "0334_E01-S172_disponibilidade_semanal.sql",
            "0669_E01-S173_rastreabilidade_pendencia.sql", "0803_E01-S168_recebimento_origem_visita.sql",
            "0805_E01-S168_guarda_cobertura_origem_visita.sql", "0807_E01-S173_pendencia_origem_visita.sql",
            "0811_E01-S168_previa_cobertura_visita.sql", "0904_E01-S168_cobertura_retorno_grupo.sql",
            "0905_E01-S168_perguntas_retorno_grupo.sql", "0907_E01-S173_consumidores_origem_grupo.sql",
            "1587_E01-S168_retorno_grupo_chamado.sql", "1588_E01-S173_pendencias_grupo_chamado.sql",
            "1591_E01-S168_cobertura_grupo_chamado.sql", "1675_E01-S53_serializar_materializacao_legada.sql",
        )
        additions = overlay["migrations_adicionais"]
        if tuple(item["caminho"] for item in additions) != tuple("supabase/migrations/" + nome for nome in esperadas):
            raise RuntimeError("Sobreposição de integração inesperada")
        for item in additions:
            path = item["caminho"]
            numero = Path(path).name[:4]
            if path in base_files or path in names or any(Path(p).name[:4] == numero for p in base_files + names):
                raise RuntimeError("Migration de integração duplicada: " + numero)
            data = git("show", source + ":" + path)
            if hashlib.sha256(data).hexdigest() != item["sha256"] or git("rev-parse", source + ":" + path).decode().strip() != item["git_blob"]:
                raise RuntimeError("Hash da sobreposição de integração divergente: " + numero)
            blobs.append((path, data))
        blobs.sort(key=lambda item: item[0])
        names = [p for p, _ in blobs]
        if base_files != sorted(base_files) or base_files[-1] >= names[0]:
            raise RuntimeError("Ordem cronológica entre base e integração divergente")
        numeros_integracao = [Path(p).name[:4] for p in base_files + names]
        prerequisitos = {
            "0323": ("0079", "0239", "0282"), "0334": ("0031", "0239", "0246"),
            "0669": ("0371", "0375", "0438", "0441", "0456"),
            "0803": ("0402", "0726", "0729"), "0805": ("0582", "0726", "0729"),
            "0807": ("0371", "0726", "0729"), "0811": ("0562", "0726", "0729"),
            "0904": ("0805", "0815", "0823"), "0905": ("0811", "0815", "0823"),
            "0907": ("0669", "0891", "0906"), "1587": ("0903", "0905", "1586"),
            "1588": ("0906", "0907", "1586"), "1591": ("0904", "1586"), "1675": ("0224",),
        }
        for alvo, dependencias in prerequisitos.items():
            if numeros_integracao.count(alvo) != 1 or any(numeros_integracao.count(n) != 1 or numeros_integracao.index(n) >= numeros_integracao.index(alvo) for n in dependencias):
                raise RuntimeError("Pré-requisito de integração ausente ou fora de ordem: " + alvo)
        for anterior, posterior in (("0323", "0415"), ("0334", "0415"), ("0803", "0903"), ("0807", "0906"), ("0904", "1692"), ("0905", "1692"), ("1675", "1714")):
            if numeros_integracao.count(posterior) != 1 or numeros_integracao.index(anterior) >= numeros_integracao.index(posterior):
                raise RuntimeError("Consumidor de integração ausente ou fora de ordem: " + posterior)
        print("INTEGRAÇÃO CANDIDATA: migrations originais sem seeds artificiais; resultado NÃO autoriza release.", flush=True)
    if aprovacao_1804 is not None:
        if sum(Path(p).name.startswith("1803_") for p in names) != 1 or any(Path(p).name.startswith("1804_") for p in base_files + names):
            raise RuntimeError("Ordem ou duplicidade da migration 1804")
        if names[-1] >= s165_aprovacao_1804_isolada.MIGRATION:
            raise RuntimeError("Migration 1804 fora de ordem")
        blobs.append((s165_aprovacao_1804_isolada.MIGRATION, aprovacao_1804[0]))
        names.append(s165_aprovacao_1804_isolada.MIGRATION)
    if aprovacao_1805 is not None:
        if any(Path(p).name.startswith("1805_") for p in base_files + names) or names[-1] >= caminho_1805:
            raise RuntimeError("Ordem ou duplicidade da migration 1805")
        blobs.append((caminho_1805, aprovacao_1805))
        names.append(caminho_1805)
    if opcoes.diagnostico_0415 and sum(Path(p).name.startswith("0415_") for p in names) != 1:
        raise RuntimeError("Diagnóstico exige exatamente uma migration 0415")
    numeros = [Path(p).name[:4] for p in base_files + names]
    if len(numeros) != len(set(numeros)): raise RuntimeError("Número de migration duplicado entre base e candidatas")
    for imagem in (IMAGE, AUTH_IMAGE, REST_IMAGE, STORAGE_IMAGE):
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
    docker("create", "--name", CONTAINER, "--network", NETWORK, "--label", "sso.recorte=" + IDENT, "--env", "POSTGRES_PASSWORD=" + password, IMAGE, "postgres", "-D", "/etc/postgresql", "-c", "cron.launch_active_jobs=off"); created_container = True
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
    if query("show listen_addresses") != "*": raise RuntimeError("PostgreSQL não escuta na rede interna esperada")
    if query("select current_setting('cron.launch_active_jobs',true)") != "off": raise RuntimeError("Cron não está desabilitado")
    # Não permitir segredos ou usuários reais no banco recém-criado pela imagem.
    if query("select (select count(*) from auth.users)=0 and (select count(*) from vault.secrets)=0") != "t": raise RuntimeError("Imagem iniciou com dados inesperados")
    # O PostgreSQL inicial contém auth.users, mas não auth.jwt(). Executar as
    # migrations da imagem oficial Auth antes das migrations do projeto; nenhum stub.
    auth_password, jwt_secret = secrets.token_hex(32), secrets.token_hex(32)
    definir_senha_auth(auth_password)
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
        if not auth["State"]["Running"]: raise RuntimeError("Auth encerrou antes do readiness: " + diagnostico_auth())
        try:
            ready = docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + AUTH_CONTAINER + ":9999/health")
            if ready == "200": break
        except Exception: pass
        time.sleep(1)
    else: raise RuntimeError("Auth não ficou pronto: " + diagnostico_auth())
    if query("select to_regprocedure('auth.jwt()') is not null and to_regprocedure('auth.uid()') is not null and to_regprocedure('auth.role()') is not null") != "t":
        raise RuntimeError("Migrations oficiais Auth incompletas")
    print("Auth oficial pronto; funções de claims presentes.", flush=True)
    # Segue a configuração do smoke Storage v1.77.5 em rede interna já validado.
    # As chaves são sintéticas e ficam apenas no ambiente/metadados dos containers próprios.
    def chave(role):
        def enc(v): return base64.urlsafe_b64encode(v).rstrip(b"=")
        head = enc(b'{"alg":"HS256","typ":"JWT"}')
        body = enc(json.dumps({"role": role, "iss": "supabase", "iat": int(time.time()), "exp": int(time.time()) + 3600}, separators=(",", ":")).encode())
        return (head + b"." + body + b"." + enc(hmac.new(jwt_secret.encode(), head + b"." + body, hashlib.sha256).digest())).decode()

    def iniciar_plataforma(nome, imagem, env):
        args = ["create", "--name", nome, "--network", NETWORK, "--label", "sso.recorte=" + IDENT]
        for key, value in env.items(): args += ["--env", key + "=" + value]
        docker(*args, imagem)
        obj = inspect("container", nome)
        if obj["Mounts"] or obj["HostConfig"].get("Privileged") or obj["HostConfig"].get("NetworkMode") != NETWORK or obj["HostConfig"].get("PortBindings"):
            raise RuntimeError("Serviço de plataforma fora do isolamento")
        with watchdog_lock:
            platform_container_ids[nome] = obj["Id"]
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
            docker_monitor("start", nome)
        obj = inspect("container", nome)
        if set(obj["NetworkSettings"]["Networks"]) != {NETWORK} or any(obj["NetworkSettings"].get("Ports", {}).values()) or obj["Mounts"]:
            raise RuntimeError("Serviço de plataforma iniciou fora do isolamento")

    rest_env = {
        "PGRST_DB_URI": "postgres://authenticator:" + auth_password + "@" + CONTAINER + ":5432/postgres",
        "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "anon", "PGRST_JWT_SECRET": jwt_secret,
        "PGRST_SERVER_HOST": "0.0.0.0", "PGRST_SERVER_PORT": "3000",
    }
    iniciar_plataforma(REST_CONTAINER, REST_IMAGE, rest_env)
    storage_env = {
        "ANON_KEY": chave("anon"), "SERVICE_KEY": chave("service_role"),
        "POSTGREST_URL": "http://" + REST_CONTAINER + ":3000", "AUTH_JWT_SECRET": jwt_secret,
        "DATABASE_URL": "postgres://supabase_storage_admin:" + auth_password + "@" + CONTAINER + ":5432/postgres",
        "STORAGE_PUBLIC_URL": "http://" + STORAGE_CONTAINER + ":5000", "STORAGE_BACKEND": "file",
        "FILE_STORAGE_BACKEND_PATH": "/tmp/sso-storage", "GLOBAL_S3_BUCKET": "sso-synthetic",
        "TENANT_ID": "sso-synthetic", "REGION": "local", "ENABLE_IMAGE_TRANSFORMATION": "false",
    }
    iniciar_plataforma(STORAGE_CONTAINER, STORAGE_IMAGE, storage_env)
    for nome, porta, caminho in ((REST_CONTAINER, "3000", "/"), (STORAGE_CONTAINER, "5000", "/status")):
        for _ in range(45):
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
            if not inspect("container", nome)["State"]["Running"]: raise RuntimeError("Serviço de plataforma encerrou antes do readiness")
            try:
                status = docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + nome + ":" + porta + caminho)
                if status == "200": break
            except Exception: pass
            time.sleep(1)
        else: raise RuntimeError("Serviço de plataforma não ficou pronto")
    if query("select to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null and to_regclass('storage.migrations') is not null") != "t":
        raise RuntimeError("Migrations oficiais Storage incompletas")
    print("PostgREST e Storage oficiais prontos; relações de Storage presentes.", flush=True)
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
        if opcoes.diagnostico_0415 and Path(path).name.startswith("0415_"):
            # Diagnóstico exclusivo em clone: valores iguais às declarações 0323/0334.
            # A inserção não representa nem substitui as migrations originais.
            diagnostico = b"""do $$
begin
 insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values
 ('despesa_visita.gerir','pcm','escrita',false),('capacidade.gerir','pcm','escrita',false)
 on conflict(codigo) do nothing;
 if (select count(*) from config.sso_acoes where codigo in ('despesa_visita.gerir','capacidade.gerir') and modulo='pcm' and nivel='escrita' and exige_concessao_individual=false) <> 2 then
   raise exception 'atributos_acoes_diagnostico_divergentes' using errcode='23514';
 end if;
end; $$;"""
            sql(prefix + diagnostico, "ações sintéticas 0415")
            print("DIAGNÓSTICO: ações antecipadas somente no clone; resultado NÃO prova recorte implantável.", flush=True)
        sql(prefix + data, path)
    print("Migrations candidatas aplicadas:", len(blobs), flush=True)
    if aprovacao_1805 is not None:
        print("Migration 1805 aplicada com gate desligado; isto não comprova sua guarda.", flush=True)
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0") != "t": raise RuntimeError("Banco contém dados inesperados")
    if fixtures is not None:
        s176_runner_pgtap.executar(CONTAINER, fixtures, sql, query, watchdog_triggered)
    if aprovacao_1804 is not None:
        s165_aprovacao_1804_isolada.executar(CONTAINER, aprovacao_1804[1:], query, watchdog_triggered)
    if aprovacao_1805 is not None:
        s165_aprovacao_1805_isolada.executar(CONTAINER, fixture_1805, query, watchdog_triggered)
    if opcoes.concorrencia_parcial:
        import s176_runner_concorrencia
        s176_runner_concorrencia.executar(CONTAINER, watchdog_triggered)
    if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
    if opcoes.diagnostico_0415:
        print("PASS DIAGNÓSTICO: ações antecipadas; NÃO prova recorte implantável nem testes funcionais.")
    elif opcoes.integracao_candidata:
        print("PASS INTEGRAÇÃO CANDIDATA: compilação apenas; NÃO autoriza release nem prova testes funcionais.")
    else:
        print("PASS: compilação das migrations selecionadas em banco descartável; testes funcionais não executados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--diagnostico-0415", action="store_true", help="Antecipa duas ações somente no clone; resultado não prova recorte implantável.")
    grupo.add_argument("--integracao-candidata", action="store_true", help="Inclui migrations originais candidatas, sem seeds artificiais; não autoriza release.")
    parser.add_argument("--fixtures-pgtap", action="store_true", help="Executa quatro fixtures sintéticas apenas no candidato de integração descartável.")
    parser.add_argument("--concorrencia-parcial", action="store_true", help="Executa dois cenários concorrentes parciais apenas no candidato de integração descartável.")
    parser.add_argument("--aprovacao-1804", action="store_true", help="Aplica 1804 fixada e executa fixture sintética com rollback; exige integração candidata.")
    parser.add_argument("--aprovacao-1805", action="store_true", help="Aplica 1805 fixada após 1804, com gate desligado; exige --aprovacao-1804.")
    opcoes = parser.parse_args()
    code = 0
    try: main(opcoes)
    except Exception as exc: print("FALHA:", str(exc)); code = 1
    finally:
        watchdog_stop.set()
        if watchdog_thread is not None:
            watchdog_thread.join(timeout=45)
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
                if c["Name"] not in ("/" + CONTAINER, "/" + AUTH_CONTAINER, "/" + REST_CONTAINER, "/" + STORAGE_CONTAINER) or c["Config"].get("Labels", {}).get("sso.recorte") != IDENT:
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
