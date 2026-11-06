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
import os
import platform
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

# Drivers locais são importados durante o ensaio; não deixe __pycache__ sujar
# o checkout que as jornadas UI precisam empacotar como HEAD limpo.
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-migrations.json"
FOTOS = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-fotos-40e3c9f.json"
OVERLAY_DINAMICO = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-diagnostico-dinamico.json"
OVERLAY_INTEGRACAO = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-integracao-84c9fcf.json"
OVERLAY_AC5 = ROOT / "docs/planejamento/plano-manutencao/recorte-candidato-ac5-s170-diagnostico.json"
OVERLAY_S165_UI = ROOT / "docs/planejamento/plano-manutencao/recorte-s165-1822-overlay.json"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.141"
AUTH_IMAGE = "public.ecr.aws/supabase/gotrue:v2.197.0"
REST_IMAGE = "public.ecr.aws/supabase/postgrest:v14.5"
STORAGE_IMAGE = "public.ecr.aws/supabase/storage-api:v1.77.5"
EDGE_IMAGE = "supabase/edge-runtime:v1.77.4"
IDENT = secrets.token_hex(6)
NETWORK = "sso-recorte-" + IDENT
CONTAINER = NETWORK + "-db"
AUTH_CONTAINER = NETWORK + "-auth"
REST_CONTAINER = NETWORK + "-rest"
STORAGE_CONTAINER = NETWORK + "-storage"
GATEWAY_CONTAINER = NETWORK + "-gateway"
EDGE_CONTAINER = NETWORK + "-edge"
S165_BROWSER = NETWORK + "-s165-browser"
S170_BROWSER = NETWORK + "-s170-browser"
S166_BROWSER = NETWORK + "-s166-browser"
S176_BROWSER = NETWORK + "-s176-browser"
FOTOS_CONTAINERS = {"sistema": NETWORK + "-foto-ativo", "grupo": NETWORK + "-foto-grupo", "equipamento": NETWORK + "-foto-equipamento"}
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
MINIMO_GITHUB = 20 * 1024**3
docker_raiz_github = None


def preparar_github_hosted():
    """Verificações locais; variáveis CI não atestam criptograficamente efemeridade."""
    if (platform.system() != 'Linux' or os.environ.get('GITHUB_ACTIONS') != 'true'
        or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted'
        or os.environ.get('DOCKER_HOST') not in (None, '', 'unix:///var/run/docker.sock')
        or os.environ.get('DOCKER_CONTEXT') not in (None, '', 'default')):
        raise RuntimeError('Ambiente GitHub-hosted ou daemon local não confirmado')
    if docker('context', 'show') != 'default':
        raise RuntimeError('Contexto Docker não é o padrão local')
    contexto = json.loads(docker('context', 'inspect', 'default'))
    if len(contexto) != 1 or contexto[0].get('Endpoints', {}).get('docker', {}).get('Host') != 'unix:///var/run/docker.sock':
        raise RuntimeError('Endpoint Docker local não confirmado')
    info = json.loads(docker('info', '--format', '{{json .}}'))
    raiz = info.get('DockerRootDir')
    if info.get('OSType') != 'linux' or not isinstance(raiz, str) or not os.path.isabs(raiz) or not os.path.isdir(raiz):
        raise RuntimeError('Armazenamento local Docker não comprovado')
    return os.path.realpath(raiz)


def espaco_docker():
    if docker_raiz_github is not None:
        return shutil.disk_usage(docker_raiz_github).free
    return int(docker('exec', 'sso-validacao-isolada-20261104', 'df', '-Pk', '/').splitlines()[-1].split()[3]) * 1024


def run(args, data=None):
    try:
        p = subprocess.run(args, input=data, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo de comando excedido") from None
    if p.returncode: raise RuntimeError("Falha ao executar " + args[0])
    return p.stdout


def docker(*args, data=None):
    return run(["rtk", "proxy", "docker", *args], data).decode().strip()


def git(*args):
    return run(["rtk", "proxy", "git", *args])


def carregar_migrations_s165_ui(manifest):
    """Valida o overlay S165 contra a base e pins locais antes de iniciar o clone."""
    try:
        overlay = json.loads(OVERLAY_S165_UI.read_text())
    except (OSError, json.JSONDecodeError):
        raise RuntimeError("Overlay S165 ausente ou inválido") from None
    base_digest = hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
    if (overlay.get("base_manifesto") != str(MANIFEST.relative_to(ROOT))
        or overlay.get("base_manifesto_sha256") != base_digest
        or overlay.get("base_manifesto_contagem") != manifest.get("contagem")
        or overlay.get("overlay_contagem") != 3
        or overlay.get("story") != "E01-S165"):
        raise RuntimeError("Procedência ou versão base do overlay S165 divergente")
    esperadas = (
        "supabase/migrations/1822_E01-S165_guardar_gerador_legado_integrado.sql",
        "supabase/migrations/1823_E01-S165_recibo_reconciliacao_revisionada.sql",
        "supabase/migrations/1824_E01-S165_aprovacao_exige_recibo_completo.sql",
    )
    adicionais = overlay.get("migrations")
    if not isinstance(adicionais, list) or tuple(x.get("caminho") for x in adicionais) != esperadas:
        raise RuntimeError("IDs ou ordem do overlay S165 divergentes")
    base_paths = {x.get("caminho") for x in manifest.get("migrations", [])}
    base_numbers = {Path(p).name[:4] for p in base_paths if isinstance(p, str)}
    nomes = set()
    numeros = set()
    resultado = []
    for item in adicionais:
        caminho = item["caminho"]
        numero = Path(caminho).name[:4]
        if (not re.fullmatch(r"supabase/migrations/18[0-9]{2}_[A-Za-z0-9_-]+\.sql", caminho)
            or caminho in base_paths or caminho in nomes or numero in base_numbers or numero in numeros):
            raise RuntimeError("Caminho ou ID de migration S165 inválido")
        nomes.add(caminho)
        numeros.add(numero)
        arquivo = ROOT / caminho
        try:
            dados = arquivo.read_bytes()
        except OSError:
            raise RuntimeError("Migration do overlay S165 ausente: " + caminho) from None
        if (hashlib.sha256(dados).hexdigest() != item.get("sha256")
            or git("hash-object", caminho).decode().strip() != item.get("git_blob")):
            raise RuntimeError("Hash ou blob da migration S165 divergente: " + caminho)
        deps = item.get("depende_de")
        if not isinstance(deps, list) or any(dep.startswith("supabase/migrations/") and dep not in base_paths and dep not in nomes and not (ROOT / dep).is_file() for dep in deps):
            raise RuntimeError("Dependência de migration ausente no overlay S165: " + caminho)
        resultado.append((caminho, dados))
    pins = overlay.get("pins")
    if not isinstance(pins, list) or not pins:
        raise RuntimeError("Pins do overlay S165 ausentes")
    pins_vistos = set()
    for pin in pins:
        caminho = pin.get("caminho", "")
        if not re.fullmatch(r"(?:apps/web|supabase|\.github/workflows)/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+", caminho) or caminho in pins_vistos:
            raise RuntimeError("Caminho de pin S165 inválido ou duplicado")
        pins_vistos.add(caminho)
        try:
            digest = hashlib.sha256((ROOT / caminho).read_bytes()).hexdigest()
        except OSError:
            raise RuntimeError("Pin S165 ausente: " + caminho) from None
        if digest != pin.get("sha256"):
            raise RuntimeError("Hash de pin S165 divergente: " + caminho)
    return resultado


def inspect(kind, name):
    return json.loads(docker("inspect", "--type", kind, name))[0]


def sql(data, label):
    # Sem transações embutidas ou comandos explicitamente não transacionais: parar em vez
    # de alegar atomicidade que o psql não pode garantir.
    if re.search(rb"(?im)^\s*(?:begin|commit|rollback)\s*;|^\s*(?:vacuum|create\s+database|alter\s+system)\b|\bcreate\s+(?:unique\s+)?index\s+concurrently\b", data):
        raise RuntimeError("Migration incompatível com transação única: " + label)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "VERBOSITY=verbose", "-v", "ON_ERROR_STOP=1", "--single-transaction", "-q"], input=data, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da migration excedido: " + label) from None
    if p.returncode:
        output = p.stderr.decode(errors="replace")
        # Sem SQL, caminhos de conexão ou valores: registrar estado e objeto ausente,
        # quando PostgreSQL fornece identificador de relação entre aspas.
        m = re.search(r"ERROR:\s+([A-Z0-9]{5}):", output)
        relacao = re.search(r'relation "([A-Za-z0-9_.]+)" does not exist', output)
        detalhe = "; relação ausente " + relacao.group(1) if relacao else ""
        raise RuntimeError("Migration " + label + "; SQLSTATE " + (m.group(1) if m else "não identificado") + detalhe)


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
            vm = espaco_docker() if docker_raiz_github is not None else int(docker_monitor("exec", "sso-validacao-isolada-20261104", "df", "-Pk", "/").splitlines()[-1].split()[3]) * 1024
            if min(host, vm) < (MINIMO_GITHUB if docker_raiz_github is not None else MINIMO_LIVRE):
                raise RuntimeError("limite de espaço")
        except Exception:
            if watchdog_stop.is_set():
                return
            watchdog_triggered.set()
            with watchdog_lock:
                if watchdog_stop.is_set():
                    return
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


def diagnostico_plataforma(nome):
    """Retorna apenas categorias fixas; nunca replica logs ou credenciais."""
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "logs", "--tail", "100", nome], capture_output=True, timeout=4)
        if p.returncode: return "logs indisponíveis"
        conteudo = (p.stdout + p.stderr).decode(errors="replace").lower()
    except Exception:
        return "logs indisponíveis"
    categorias = (
        (r"permission denied|insufficient privilege|42501", "permissão de banco"),
        (r"password authentication failed|authentication failed for user|28p01", "autenticação no banco"),
        (r"connection refused|connection reset|no route to host|network is unreachable", "conexão de serviço"),
        (r"schema cache|pgrst00[0-9]|pgrst10[0-9]", "cache de schema PostgREST"),
        (r"schema .{0,40} does not exist|3f000", "schema ausente"),
        (r"migration|migrat", "migração de serviço"),
        (r"missing|must be set|required|invalid configuration", "configuração"),
    )
    rotulos = [rotulo for padrao, rotulo in categorias if re.search(padrao, conteudo)]
    return ", ".join(rotulos) if rotulos else "causa não classificada"


def main(opcoes):
    global created_net, created_container, initial_volumes, space_before, watchdog_thread, auth_container_id, docker_raiz_github
    if opcoes.github_hosted:
        docker_raiz_github = preparar_github_hosted()
        print('Modo GitHub opt-in: reserva hipotética de 20 GiB; efemeridade não atestada.', flush=True)
    fixture_s165 = None
    fixture_s166 = None
    proxy_s165 = None
    proxy_s166 = None
    proxy_s170 = None
    fixture_s170 = None
    migracoes_s170_ui = []
    proxy_s176 = None
    migracoes_s165_ui = []
    migracoes_s176_ui = []
    migracoes_s166_ui = []
    if opcoes.ui_s165_e2e or opcoes.fixtures_pgtap:
        permitidas = {"github_hosted", "integracao_candidata", "fixture_s165_e2e", "ui_s165_e2e",
                      "aprovacao_1804", "aprovacao_1805", "aprovacao_1806", "revisao_1807"}
        if opcoes.ui_s165_e2e and (not opcoes.github_hosted or not opcoes.integracao_candidata or not opcoes.fixture_s165_e2e or any(
            valor is True and nome not in permitidas for nome, valor in vars(opcoes).items()
        )):
            raise RuntimeError("UI S165 exige clone GitHub exclusivo com integração e fixture sintéticas")
        manifest_ui = json.loads(MANIFEST.read_text())
        migracoes_s165_ui = carregar_migrations_s165_ui(manifest_ui)
    if opcoes.ui_s166_e2e or opcoes.fixtures_pgtap:
        permitidas = {"github_hosted", "integracao_candidata", "fixture_s166_e2e", "ui_s166_e2e"}
        if opcoes.ui_s166_e2e and (not opcoes.github_hosted or not opcoes.integracao_candidata or not opcoes.fixture_s166_e2e or any(
            valor is True and nome not in permitidas for nome, valor in vars(opcoes).items()
        )):
            raise RuntimeError("UI S166 exige clone GitHub exclusivo com integração candidata e fixture S166")
        for nome, digest in (
            ("supabase/migrations/1820_E01-S166_mudanca_dia_v2_fundacao.sql", "83357f5534af165164f45a375d5750829e243e121395270e9d7675167a61b551"),
            ("supabase/migrations/1821_E01-S166_mudanca_dia_v2_rpc.sql", "a8c33a04467c7814c2e8a4aef274129b9a30df4a48690b13dfd5fa41fce9cfba"),
        ):
            dados = (ROOT / nome).read_bytes()
            if hashlib.sha256(dados).hexdigest() != digest:
                raise RuntimeError("Migration UI S166 divergente")
            migracoes_s166_ui.append((nome, dados))
    if opcoes.ui_s176_e2e:
        permitidas = {"github_hosted", "integracao_candidata", "ui_s176_e2e"}
        if not opcoes.github_hosted or not opcoes.integracao_candidata or any(
            valor is True and nome not in permitidas for nome, valor in vars(opcoes).items()
        ):
            raise RuntimeError("UI S176 exige clone GitHub exclusivo com integração candidata")
        for nome, digest in (
            ("supabase/migrations/1809_E01-S176_isolamento_leitura_estrutura.sql", "32b4b98a3080c99375c41b4e66cebe6495a32740e07c6591614117bcdc10d5cc"),
            ("supabase/migrations/1810_E01-S176_composicao_estrutura_mediada.sql", "316c97af549af63690e27b90abefe2b18f7bc971e7632595997940fe4e9e0cfd"),
        ):
            dados = (ROOT / nome).read_bytes()
            if hashlib.sha256(dados).hexdigest() != digest:
                raise RuntimeError("Migration UI S176 divergente")
            migracoes_s176_ui.append((nome, dados))
        arquivo = ROOT / "supabase/manual-tests/s176_fixture_ui_isolada.py"
        if hashlib.sha256(arquivo.read_bytes()).hexdigest() != "2d1c29207f1d080171785f6ca6e9f3423b1a1dbc86c8960cb47d80aa1d3f5e53":
            raise RuntimeError("Fixture UI S176 divergente")
        import s176_fixture_ui_isolada
    if opcoes.ui_s170_e2e:
        for caminho, digest in (
            ("supabase/migrations/1802_E01-S176_foto_cadastral_grupo_mediada.sql", "7756cb70c7491583b1a279b0ad5dcfee24244df3b5bcf9f284533f8a07374e24"),
            ("supabase/migrations/1803_E01-S176_ingestao_foto_cadastral_grupo.sql", "cf0228021475f55810bed334dd6b60918a58ace3c68e944bb9abbb01f4171747"),
            ("supabase/migrations/1804_E01-S165_aprovacao_versao_esperada.sql", "dc22888e1da288fcb28dbfead1a71cb637215c9fe7a1d2be967863e1e86bd9ac"),
        ):
            dados = (ROOT / caminho).read_bytes()
            if hashlib.sha256(dados).hexdigest() != digest:
                raise RuntimeError("Migration UI S170 divergente: " + Path(caminho).name[:4])
            migracoes_s170_ui.append((caminho, dados))
    if opcoes.fixture_s166_e2e:
        if not opcoes.github_hosted or not opcoes.integracao_candidata:
            raise RuntimeError("Fixture S166 exige candidato de integração em clone GitHub descartável")
        if any(getattr(opcoes, x) for x in (
            "diagnostico_0415", "diagnostico_ac5", "fixture_s165_e2e", "ui_s165_e2e",
            "fixture_s170_e2e", "ui_s170_e2e", "isolamento_1810", "fixtures_pgtap",
            "fixtures_pgtap_ci", "jornada_ac5_http", "concorrencia_1810", "concorrencia_parcial",
            "aprovacao_1804", "aprovacao_1805", "aprovacao_1806", "revisao_1807",
            "consulta_1808", "concorrencia_1805", "concorrencia_1807", "upload_1811",
            "documento_1812", "hierarquia_1813", "policies_1814", "dispatch_1815",
            "gates_1816", "criacao_1817", "ativacao_1818", "edge_documento_http", "edge_fotos_http",
        )):
            raise RuntimeError("Fixture E2E S166 não aceita outros cenários no mesmo clone")
        driver_s166 = ROOT / "apps/web/e2e/s166-isolado/fixture.py"
        if hashlib.sha256(driver_s166.read_bytes()).hexdigest() != "170d80596ccea1b30d58beedccb5e17f2023c1064e0d700dd8e2eb502c9d42bf":
            raise RuntimeError("Driver fixture E2E S166 divergente")
        driver_fixture_s166 = ROOT / "supabase/manual-tests/s166_fixture_isolada.py"
        if hashlib.sha256(driver_fixture_s166.read_bytes()).hexdigest() != "16f9f4289b9426a326476a1e766014d4a349f79f19017bc8345b96764b91cdf3":
            raise RuntimeError("Wrapper fixture E2E S166 divergente")
        import importlib.util
        spec_s166 = importlib.util.spec_from_file_location("s166_fixture_e2e", driver_s166)
        if spec_s166 is None or spec_s166.loader is None:
            raise RuntimeError("Driver fixture E2E S166 indisponível")
        modulo_s166 = importlib.util.module_from_spec(spec_s166)
        spec_s166.loader.exec_module(modulo_s166)
        fixture_s166 = modulo_s166.preparar(ROOT, "894fb4c9ef50fdddf4aeec2f108a7699e887cda7eef149a6f4d146b512242827")
    if opcoes.ui_s166_e2e and not opcoes.fixture_s166_e2e:
        raise RuntimeError("UI S166 exige fixture persistente S166")
    if opcoes.fixture_s170_e2e:
        proibidas_s170 = ("fixture_s165_e2e", "ui_s165_e2e", "isolamento_1810", "fixtures_pgtap",
                          "fixtures_pgtap_ci", "jornada_ac5_http", "concorrencia_1810",
                          "concorrencia_parcial", "aprovacao_1804", "aprovacao_1805",
                          "aprovacao_1806", "revisao_1807", "consulta_1808", "concorrencia_1805",
                          "concorrencia_1807", "aprovacao_1805_pos_commit", "upload_1811",
                          "documento_1812", "hierarquia_1813", "policies_1814", "dispatch_1815",
                          "gates_1816", "criacao_1817", "ativacao_1818", "edge_documento_http",
                          "edge_fotos_http")
        if (not opcoes.github_hosted or not opcoes.integracao_candidata or not opcoes.diagnostico_ac5
                or any(getattr(opcoes, x) for x in proibidas_s170)):
            raise RuntimeError("Fixture S170 exige clone GitHub com overlay AC5 e sem outros cenários")
        driver_s170 = ROOT / "supabase/manual-tests/s170_fixture_isolada.py"
        if hashlib.sha256(driver_s170.read_bytes()).hexdigest() != "9725537d76c5196e8d05bf5aaf8d0333fd85932e24e7655a2386f582902b5b3b":
            raise RuntimeError("Driver S170 divergente")
        import s170_fixture_isolada
        fixture_s170 = s170_fixture_isolada.preparar(ROOT, "ee4d232329253af70c27abd39c97d92bbc89280ef9cb6f85eb86b55be0eaf967")
    if opcoes.ui_s170_e2e and not opcoes.fixture_s170_e2e:
        raise RuntimeError("UI S170 exige fixture S170 isolada")
    if opcoes.ui_s165_e2e or opcoes.ui_s170_e2e or opcoes.ui_s166_e2e or opcoes.ui_s176_e2e:
        if (opcoes.ui_s165_e2e and not opcoes.fixture_s165_e2e) or not opcoes.github_hosted:
            raise RuntimeError("UI isolada exige fixture correspondente e runner GitHub dedicado")
        run_id = os.environ.get("GITHUB_RUN_ID", "")
        tentativa = os.environ.get("GITHUB_RUN_ATTEMPT", "")
        temporario = os.environ.get("RUNNER_TEMP", "")
        if not run_id.isdigit() or not tentativa.isdigit() or not os.path.isabs(temporario) or not os.path.isdir(temporario):
            raise RuntimeError("Marcador de limpeza UI indisponível")
        marcador = os.path.join(temporario, "s165-recorte-" + run_id + "-" + tentativa)
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        with os.fdopen(os.open(marcador, flags, 0o600), "w") as arquivo:
            arquivo.write(IDENT + "\n")
        if opcoes.ui_s165_e2e:
            driver_ui = ROOT / "supabase/manual-tests/s165_ui_isolada.py"
            if hashlib.sha256(driver_ui.read_bytes()).hexdigest() != "f91f591aaca6ff28a805bf33c0b181754421dee2e9cbe9e97df5e5896f64d83c":
                raise RuntimeError("Driver UI S165 divergente")
            import s165_ui_isolada
            proxy_s165 = s165_ui_isolada.preparar(ROOT, "490c542dae9190bee628e8145c7c6172e188ffbac99e673003e8afc704b9bfe1")
        if opcoes.ui_s170_e2e:
            driver_ui = ROOT / "supabase/manual-tests/s170_ui_isolada.py"
            if hashlib.sha256(driver_ui.read_bytes()).hexdigest() != "2fb8580e80de6e40c7d8ccdbfad720a85db193c83ea3fa1c6304db7357f9feb0":
                raise RuntimeError("Driver UI S170 divergente")
            import s170_ui_isolada
            proxy_s170 = s170_ui_isolada.preparar(ROOT, "490c542dae9190bee628e8145c7c6172e188ffbac99e673003e8afc704b9bfe1")
        if opcoes.ui_s166_e2e:
            driver_ui = ROOT / "supabase/manual-tests/s166_ui_isolada.py"
            if hashlib.sha256(driver_ui.read_bytes()).hexdigest() != "3da48443beb35ed4c342526d1a887b7b970006257d1c532eec4dac5d9c6a915b":
                raise RuntimeError("Driver UI S166 divergente")
            import s166_ui_isolada
            proxy_s166 = s166_ui_isolada.preparar(ROOT, "490c542dae9190bee628e8145c7c6172e188ffbac99e673003e8afc704b9bfe1")
        if opcoes.ui_s176_e2e:
            driver_ui = ROOT / "supabase/manual-tests/s176_ui_isolada.py"
            if hashlib.sha256(driver_ui.read_bytes()).hexdigest() != "29ed6948f8f48b7d6110064d7da55d5f225188e0c8f9404d85e183eec66affa8":
                raise RuntimeError("Driver UI S176 divergente")
            import s176_ui_isolada
            proxy_s176 = s176_ui_isolada.preparar(ROOT, "490c542dae9190bee628e8145c7c6172e188ffbac99e673003e8afc704b9bfe1")
    if opcoes.fixture_s165_e2e:
        proibidas_s165 = ("diagnostico_ac5", "isolamento_1810", "fixtures_pgtap", "fixtures_pgtap_ci",
                          "jornada_ac5_http", "concorrencia_1810", "concorrencia_parcial",
                          "consulta_1808", "concorrencia_1805", "concorrencia_1807",
                          "aprovacao_1805_pos_commit", "upload_1811", "documento_1812",
                          "hierarquia_1813", "policies_1814", "dispatch_1815", "gates_1816",
                          "criacao_1817", "ativacao_1818", "edge_documento_http", "edge_fotos_http")
        if not opcoes.integracao_candidata or any(getattr(opcoes, x) for x in proibidas_s165):
            raise RuntimeError("Fixture S165 exige integração sem fixtures externas ou atalhos")
        driver_s165 = ROOT / "supabase/manual-tests/s165_e2e_clientes_isolada.py"
        if hashlib.sha256(driver_s165.read_bytes()).hexdigest() != "17bcfde20120c9529b5d12f797c8ba1840ed6b07d16c0c725422cd87531b2c51":
            raise RuntimeError("Driver S165 divergente")
        import s165_e2e_clientes_isolada
        fixture_s165 = s165_e2e_clientes_isolada.preparar(ROOT)
    if opcoes.edge_fotos_http and not opcoes.edge_documento_http:
        raise RuntimeError("Fotos Edge exigem documento Edge sintético")
    if opcoes.edge_fotos_http:
        arquivo = ROOT / "apps/web/e2e/s178-documento-isolado/jornada_fotos.py"
        if hashlib.sha256(arquivo.read_bytes()).hexdigest() != "72be4136ee9b9cc7e551871ee56ef04908677e4795e3ea51aa17ecba482bdea9":
            raise RuntimeError("Driver de fotos Edge divergente")
    if opcoes.edge_documento_http and (not opcoes.jornada_ac5_http or not opcoes.gates_1816):
        raise RuntimeError("Edge documento exige jornada AC5 e gates 1816 em clone descartável")
    if opcoes.edge_documento_http:
        for nome, digest in (
            ("apps/web/e2e/s178-documento-isolado/gateway.ts", "796c0f5bf7cae7248eecd9949cc7b524dfd05b7a73456b62a1b2143fcefa3e8e"),
            ("apps/web/e2e/s178-documento-isolado/jornada.py", "7466b5fb72712e3b1e373c2ba26fbfaf4c324348c918f66d9b044729061eec7f"),
            ("apps/web/e2e/s178-documento-isolado/import-map.json", "de336bac6a7a07a2eb903a185b1004951714134a20cea543e2f35cea4aabde06"),
            ("apps/web/e2e/s178-documento-isolado/vendor/tslib-2.8.1.mjs", "c38da5dd6da6281964435002ce204cd586634fe3bdfb24a0ee116f48cf3292e9"),
        ):
            if hashlib.sha256((ROOT / nome).read_bytes()).hexdigest() != digest:
                raise RuntimeError("Arquivo de ensaio Edge divergente: " + nome)
    criacao_1817 = None
    if opcoes.criacao_1817:
        if not opcoes.gates_1816 or not opcoes.fixtures_pgtap_ci:
            raise RuntimeError("Criação 1817 exige gates 1816 e lote pgTAP CI")
        caminho_1817 = "supabase/migrations/1817_E01-S184_criar_contrato_sem_custos.sql"
        criacao_1817 = (ROOT / caminho_1817).read_bytes()
        if hashlib.sha256(criacao_1817).hexdigest() != "e65453cef0bade6c58845cbaffb3ce69c0e6df53f8d0092edd6c0c7e7ac3f0dc":
            raise RuntimeError("Migration 1817 divergente")
    fixture_1817 = None
    if criacao_1817 is not None:
        driver = ROOT / "supabase/manual-tests/s184_criacao_1817_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "5b95f71f1b1b2a6455b05a0e18832f4cb130e9505bceff727ac77b6e0db2a3f3":
            raise RuntimeError("Driver de criação 1817 divergente")
        import s184_criacao_1817_isolada
        fixture_1817 = s184_criacao_1817_isolada.preparar(ROOT)
    ativacao_1818 = fixture_1818 = None
    if opcoes.ativacao_1818:
        if not opcoes.criacao_1817: raise RuntimeError("Ativação 1818 exige criação 1817")
        caminho_1818 = "supabase/migrations/1818_E01-S184_ativar_contrato_sem_custos.sql"
        ativacao_1818 = (ROOT / caminho_1818).read_bytes()
        if hashlib.sha256(ativacao_1818).hexdigest() != "2ab11bea3b87693e87bad490108a200fe4cf8bb7cb616e973c5e488fc54e6835": raise RuntimeError("Migration 1818 divergente")
        driver = ROOT / "supabase/manual-tests/s184_ativacao_1818_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "b379d855c317574c965df6f4344454b97bbce5815085a6412dae8c69795b2fce": raise RuntimeError("Driver de ativação 1818 divergente")
        import s184_ativacao_1818_isolada
        fixture_1818 = s184_ativacao_1818_isolada.preparar(ROOT)
    fixtures = None
    isolamento_1810 = None
    upload_1811 = None
    documento_1812 = None
    hierarquia_1813 = None
    policies_1814 = None
    dispatch_1815 = None
    gates_1816 = None
    if opcoes.gates_1816:
        if not opcoes.dispatch_1815 or not opcoes.documento_1812:
            raise RuntimeError("Gates 1816 exigem dispatch 1815 e documento 1812")
        driver = ROOT / "supabase/manual-tests/s178_gates_1816_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "a2ec3febbe19d242718056780ffe26e313312cbb3d6553f1e1e3850c6129b026":
            raise RuntimeError("Driver de gates 1816 divergente")
        import s178_gates_1816_isolada
        gates_1816 = s178_gates_1816_isolada.preparar(ROOT)
    if opcoes.dispatch_1815:
        if not opcoes.policies_1814:
            raise RuntimeError("Dispatch 1815 exige policies 1814")
        driver = ROOT / "supabase/manual-tests/s168_dispatch_1815_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "222a387f01c0282c20544701c17f8d44dfd2782fa1bae59569f68ffc98fff5e3":
            raise RuntimeError("Driver de dispatch 1815 divergente")
        import s168_dispatch_1815_isolada
        dispatch_1815 = s168_dispatch_1815_isolada.preparar(ROOT)
    if opcoes.policies_1814:
        if not opcoes.hierarquia_1813 or not opcoes.upload_1811:
            raise RuntimeError("Policies 1814 exigem hierarquia 1813 e upload 1811")
        driver = ROOT / "supabase/manual-tests/s168_policies_1814_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "cdd3ba78af44e7bd969be0659f78b3cd30e5cfed8c58f0df4e30388876d6a313":
            raise RuntimeError("Driver de policies 1814 divergente")
        import s168_policies_1814_isolada
        policies_1814 = s168_policies_1814_isolada.preparar(ROOT)
    if opcoes.hierarquia_1813:
        if not opcoes.documento_1812: raise RuntimeError("Hierarquia 1813 exige --documento-1812")
        driver_hierarquia = ROOT / "supabase/manual-tests/s176_hierarquia_1813_isolada.py"
        if hashlib.sha256(driver_hierarquia.read_bytes()).hexdigest() != "6e7129a210ed5d5a4767eef4f6190cb4fdf2a812185ae70a1992c589fc03454f":
            raise RuntimeError("Driver de hierarquia 1813 divergente")
        import s176_hierarquia_1813_isolada
        hierarquia_1813 = s176_hierarquia_1813_isolada.preparar(ROOT)
    if opcoes.documento_1812:
        if not opcoes.upload_1811: raise RuntimeError("Documento 1812 exige --upload-1811")
        driver_documento = ROOT / "supabase/manual-tests/s178_documento_1812_isolada.py"
        if hashlib.sha256(driver_documento.read_bytes()).hexdigest() != "32563c6d1122f54cc39e2a62f7380c1771fff999ae17ccb08c050b84a666c872":
            raise RuntimeError("Driver de documento 1812 divergente")
        import s178_documento_1812_isolada
        documento_1812 = s178_documento_1812_isolada.preparar(ROOT)
    if opcoes.jornada_ac5_http:
        if not opcoes.upload_1811:
            raise RuntimeError("Jornada HTTP exige --upload-1811 e clone descartável")
        for nome, esperado in (
            ("apps/web/e2e/s168-retorno-isolado/jornada.py", "90439ae590e0e2ff8fd8fca09b082126da4a26320be8c10a063c00b385f0818e"),
            ("supabase/tests/manual_E01-S168_origem_http_sintetica.sql", "429cccd18ec2b47d4b8819550df72223d9a1281cb08db1fa6a32b7dee2f72d40"),
        ):
            if hashlib.sha256((ROOT / nome).read_bytes()).hexdigest() != esperado:
                raise RuntimeError("Jornada HTTP divergente: " + nome)
    if opcoes.upload_1811:
        if not opcoes.isolamento_1810:
            raise RuntimeError("Upload 1811 exige --isolamento-1810 e clone descartável")
        driver = ROOT / "supabase/manual-tests/s168_upload_1811_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "ca1eaedb5d28214abfae7be6d7bfe5fed6c6f0586a6ef920ee15ae788210913a":
            raise RuntimeError("Driver de upload 1811 divergente")
        import s168_upload_1811_isolada
        upload_1811 = s168_upload_1811_isolada.preparar(ROOT)
    if opcoes.concorrencia_1810:
        if not opcoes.isolamento_1810:
            raise RuntimeError("Concorrência 1810 exige --isolamento-1810 e descarte do clone")
        for nome, digest in (
            ("s176_isolamento_concorrencia_1810.py", "e96b7b65a2220136b16843b303ede27660033a8d4f1e06201c78c68ca06136c5"),
            ("s176_runner_concorrencia.py", "c5daefc801ca006ddb5aa2815f5bb541b0275d1740027b55cdaeb5a4b642e0c3"),
        ):
            if hashlib.sha256((ROOT / "supabase/manual-tests" / nome).read_bytes()).hexdigest() != digest:
                raise RuntimeError("Driver de concorrência divergente: " + nome)
    if opcoes.isolamento_1810:
        if (not opcoes.integracao_candidata or not opcoes.diagnostico_ac5
            or opcoes.concorrencia_parcial or opcoes.concorrencia_1805 or opcoes.concorrencia_1807
            or opcoes.aprovacao_1805_pos_commit):
            raise RuntimeError("Isolamento 1810 exige AC5 e integração, sem outros cenários")
        # Inclui 1804–1808 e suas fixtures transacionais na mesma execução.
        opcoes.aprovacao_1804 = opcoes.aprovacao_1805 = opcoes.aprovacao_1806 = True
        opcoes.revisao_1807 = opcoes.consulta_1808 = True
        nomes = (
            ("supabase/migrations/1809_E01-S176_isolamento_leitura_estrutura.sql", "32b4b98a3080c99375c41b4e66cebe6495a32740e07c6591614117bcdc10d5cc"),
            ("supabase/migrations/1810_E01-S176_composicao_estrutura_mediada.sql", "316c97af549af63690e27b90abefe2b18f7bc971e7632595997940fe4e9e0cfd"),
        )
        isolamento_1810 = []
        for caminho, digest in nomes:
            dados = (ROOT / caminho).read_bytes()
            if hashlib.sha256(dados).hexdigest() != digest: raise RuntimeError("Hash divergente: " + caminho)
            isolamento_1810.append((caminho, dados))
        nome_fixture = "E01-S176_isolamento_estrutura_1810.test.sql"
        fixture = (ROOT / "supabase/tests" / nome_fixture).read_bytes()
        if hashlib.sha256(fixture).hexdigest() != "205a7c20a9665b1357e80505c3b45dc44ffda8dd8a457a1a66d2e80c645c04d4":
            raise RuntimeError("Hash da fixture 1810 divergente")
        if (len(re.findall(rb"(?im)^\s*begin\s*;", fixture)) != 1
            or len(re.findall(rb"(?im)^\s*rollback\s*;", fixture)) != 1
            or re.search(rb"(?im)^\s*(commit|end transaction)\s*;|session_replication_role|\\", fixture)):
            raise RuntimeError("Transação ou metacomandos inesperados na fixture 1810")
        import s176_runner_pgtap
        fixture_1810 = [(nome_fixture, fixture, 11)]
    aprovacao_1804 = None
    aprovacao_1805 = None
    aprovacao_1806 = None
    revisao_1807 = None
    consulta_1808 = None
    concorrencia_1807 = None
    if opcoes.consulta_1808:
        if not opcoes.revisao_1807:
            raise RuntimeError("Consulta 1808 exige --revisao-1807")
        caminho_1808 = "supabase/migrations/1808_E01-S165_consulta_recibo_revisao_contratos.sql"
        consulta_1808 = (ROOT / caminho_1808).read_bytes()
        if hashlib.sha256(consulta_1808).hexdigest() != "991d3a56eb15e5a2b23b42f06aa8acfb01ac846efbc0576763c4faa02d51490d":
            raise RuntimeError("Hash da migration 1808 divergente")
        import s165_consulta_1808_isolada
        fixture_1808 = s165_consulta_1808_isolada.preparar(ROOT)
    if opcoes.concorrencia_1807:
        if not opcoes.revisao_1807 or opcoes.concorrencia_1805 or opcoes.aprovacao_1805_pos_commit or opcoes.concorrencia_parcial:
            raise RuntimeError("Concorrência 1807 exige 1807 e clone sem cenários que confirmam dados")
        driver_1807 = ROOT / "supabase/manual-tests/s165_concorrencia_1807_isolada.py"
        if hashlib.sha256(driver_1807.read_bytes()).hexdigest() != "ba97c0fd4210067d15952eea164c8bc22d3503a8953d7e7d23a05dec7f57f18a":
            raise RuntimeError("Hash do driver concorrente 1807 divergente")
        for nome, digest in (
            ("s165_concorrencia_1805_isolada.py", "64266880eb6e5077cd058ab32def97659efe7e1dc8ce9cd87bd8bf075dd48314"),
            ("s176_runner_concorrencia.py", "c5daefc801ca006ddb5aa2815f5bb541b0275d1740027b55cdaeb5a4b642e0c3"),
        ):
            if hashlib.sha256((ROOT / "supabase/manual-tests" / nome).read_bytes()).hexdigest() != digest:
                raise RuntimeError("Dependência do driver concorrente 1807 divergente")
        import s165_concorrencia_1807_isolada
        concorrencia_1807 = s165_concorrencia_1807_isolada.preparar(ROOT)
    if opcoes.revisao_1807:
        if not opcoes.aprovacao_1806 or not opcoes.aprovacao_1805 or not opcoes.aprovacao_1804 or not opcoes.integracao_candidata:
            raise RuntimeError("Revisão 1807 exige integração candidata e migrations 1804, 1805 e 1806")
        caminho_1807 = "supabase/migrations/1807_E01-S165_inicio_revisao_contratos_mediado.sql"
        revisao_1807 = (ROOT / caminho_1807).read_bytes()
        if hashlib.sha256(revisao_1807).hexdigest() != "e6b5641d7cf891fbfd50397c66f634c65f914ad59b99c2d983f5a5446b4f64b6":
            raise RuntimeError("Hash da migration 1807 divergente")
        import s165_revisao_1807_isolada
        fixture_1807 = s165_revisao_1807_isolada.preparar(ROOT)
    if opcoes.aprovacao_1806:
        if not opcoes.aprovacao_1805 or not opcoes.aprovacao_1804 or not opcoes.integracao_candidata:
            raise RuntimeError("Migration 1806 exige integração candidata, 1804 e 1805")
        caminho_1806 = "supabase/migrations/1806_E01-S165_compatibilidade_token_aprovacao.sql"
        aprovacao_1806 = (ROOT / caminho_1806).read_bytes()
        if hashlib.sha256(aprovacao_1806).hexdigest() != "2048b220ce1aac512d2a573f729d65c6b6bda9ef66e880c965b2323704e8652e":
            raise RuntimeError("Hash da migration 1806 divergente")
        import s165_aprovacao_1806_isolada
        fixture_1806 = s165_aprovacao_1806_isolada.preparar(ROOT)
    pos_commit_1805 = None
    concorrencia_1805 = False
    if opcoes.concorrencia_1805:
        if not opcoes.aprovacao_1805 or not opcoes.aprovacao_1804 or not opcoes.integracao_candidata:
            raise RuntimeError("Concorrência 1805 exige integração candidata, 1804 e 1805")
        for nome, digest in (
            ("s165_concorrencia_1805_isolada.py", "64266880eb6e5077cd058ab32def97659efe7e1dc8ce9cd87bd8bf075dd48314"),
            ("s176_runner_concorrencia.py", "c5daefc801ca006ddb5aa2815f5bb541b0275d1740027b55cdaeb5a4b642e0c3"),
        ):
            if hashlib.sha256((ROOT / "supabase/manual-tests" / nome).read_bytes()).hexdigest() != digest:
                raise RuntimeError("Hash do controlador de concorrência divergente: " + nome)
        concorrencia_1805 = True
    if opcoes.aprovacao_1805_pos_commit:
        if not opcoes.aprovacao_1805 or not opcoes.aprovacao_1804 or not opcoes.integracao_candidata:
            raise RuntimeError("Pós-commit exige integração candidata, 1804 e 1805")
        import s165_aprovacao_1805_pos_commit
        pos_commit_1805 = s165_aprovacao_1805_pos_commit.preparar(ROOT)
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
    if opcoes.fixtures_pgtap_ci:
        if not opcoes.integracao_candidata or not opcoes.diagnostico_ac5 or not opcoes.isolamento_1810 or not opcoes.gates_1816 or opcoes.fixtures_pgtap:
            raise RuntimeError("pgTAP CI exige integração, AC5, isolamento 1810 e gates 1816, sem fixtures duplicadas")
        driver = ROOT / "supabase/manual-tests/s176_pgtap_ci_isolada.py"
        if hashlib.sha256(driver.read_bytes()).hexdigest() != "2f91c0ecb7014ab126f772183407e199190c454f024573e155c33ca5f85f19cb":
            raise RuntimeError("Driver pgTAP CI divergente")
        runner = ROOT / "supabase/manual-tests/s176_runner_pgtap.py"
        if hashlib.sha256(runner.read_bytes()).hexdigest() != "4e192bc66c3c75c52d92f5f2f9380aa4ee9b91dc87b3f7eb5c1754552b4e8583":
            raise RuntimeError("Runner pgTAP divergente")
        import s176_pgtap_ci_isolada
        fixtures = s176_pgtap_ci_isolada.preparar(ROOT)
    if opcoes.fixtures_pgtap:
        if not opcoes.integracao_candidata:
            raise RuntimeError("Fixtures exigem --integracao-candidata")
        import s176_runner_pgtap
        fixtures = s176_runner_pgtap.preparar(ROOT)
    if opcoes.diagnostico_ac5 and (not opcoes.integracao_candidata or (opcoes.fixtures_pgtap and not opcoes.isolamento_1810) or opcoes.concorrencia_parcial or opcoes.concorrencia_1805 or opcoes.concorrencia_1807 or opcoes.aprovacao_1805_pos_commit or (not opcoes.isolamento_1810 and (opcoes.aprovacao_1804 or opcoes.aprovacao_1805 or opcoes.aprovacao_1806 or opcoes.revisao_1807 or opcoes.consulta_1808))):
        raise RuntimeError("AC5 diagnóstico exige integração sem cenários não previstos")
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
    if migracoes_s170_ui:
        for caminho, dados in migracoes_s170_ui:
            numero = Path(caminho).name[:4]
            existentes = [(p, blob) for p, blob in blobs if Path(p).name[:4] == numero]
            if caminho in base_files:
                if git("show", base + ":" + caminho) != dados:
                    raise RuntimeError("Migration base UI S170 divergente: " + numero)
                continue
            if existentes:
                if existentes != [(caminho, dados)]:
                    raise RuntimeError("Migration UI S170 duplicada: " + numero)
                continue
            blobs.append((caminho, dados))
        blobs.sort(key=lambda item: item[0])
        names = [p for p, _ in blobs]
        numeros = [Path(p).name[:4] for p in base_files + names]
        if len(numeros) != len(set(numeros)) or base_files[-1] >= names[0]:
            raise RuntimeError("Ordem ou duplicidade de migration UI S170")
    if opcoes.diagnostico_ac5:
        if not OVERLAY_AC5.is_file():
            raise RuntimeError("Manifesto diagnóstico AC5 ainda não está disponível")
        ac5 = json.loads(OVERLAY_AC5.read_text())
        source_ac5 = "f94282991911ee02d6ed50365ff5f78513ea34f3"
        if ac5.get("status") != "apto_a_ensaio_diagnostico" or ac5.get("base_main") != base or ac5.get("fonte_backup") != source_ac5:
            raise RuntimeError("Manifesto AC5 incompleto ou com procedência divergente")
        if git("rev-parse", "--verify", source_ac5 + "^{commit}").decode().strip() != source_ac5:
            raise RuntimeError("Commit AC5 ausente ou divergente")
        adicionais = ac5.get("migrations_adicionais")
        if not isinstance(adicionais, list) or not adicionais:
            raise RuntimeError("Sobreposição AC5 vazia ou inválida")
        for item in adicionais:
            if not isinstance(item, dict): raise RuntimeError("Entrada AC5 inválida")
            path = item.get("caminho", "")
            if not re.fullmatch(r"supabase/migrations/[0-9]{4}_[A-Za-z0-9_-]+\.sql", path):
                raise RuntimeError("Caminho AC5 inválido")
            numero = Path(path).name[:4]
            if path in base_files or path in names or any(Path(p).name[:4] == numero for p in base_files + names):
                raise RuntimeError("Migration AC5 duplicada: " + numero)
            data = git("show", source_ac5 + ":" + path)
            if hashlib.sha256(data).hexdigest() != item.get("sha256") or git("rev-parse", source_ac5 + ":" + path).decode().strip() != item.get("git_blob"):
                raise RuntimeError("Hash da sobreposição AC5 divergente: " + numero)
            blobs.append((path, data))
            names.append(path)
        blobs.sort(key=lambda item: item[0])
        names = [p for p, _ in blobs]
        numeros = [Path(p).name[:4] for p in base_files + names]
        if len(numeros) != len(set(numeros)) or base_files != sorted(base_files) or base_files[-1] >= names[0]:
            raise RuntimeError("Ordem ou duplicidade da sobreposição AC5")
        gates_ac5 = ac5.get("gates_default_fechados")
        if not isinstance(gates_ac5, list) or not gates_ac5:
            raise RuntimeError("Manifesto AC5 não lista gates para conferência")
        for gate in gates_ac5:
            if not isinstance(gate, dict) or not re.fullmatch(r"[a-z_][a-z0-9_]*", gate.get("tabela", "")) or not re.fullmatch(r"[a-z_][a-z0-9_]*", gate.get("coluna", "")):
                raise RuntimeError("Gate AC5 inválido")
        print("DIAGNÓSTICO AC5: sobreposição isolada; resultado NÃO autoriza release.", flush=True)
    if migracoes_s176_ui:
        for caminho, dados in migracoes_s176_ui:
            if any(Path(p).name[:4] == Path(caminho).name[:4] for p in base_files + names) or names[-1] >= caminho:
                raise RuntimeError("Ordem ou duplicidade de migration UI S176")
            blobs.append((caminho, dados))
            names.append(caminho)
    if aprovacao_1804 is not None:
        # A 1804 sucede a ingestão de fotos S176 no histórico global. O recorte
        # S165 parte da base 1800–1801, então aplica também 1802–1803 antes dela.
        for caminho, digest in (
            ("supabase/migrations/1802_E01-S176_foto_cadastral_grupo_mediada.sql", "7756cb70c7491583b1a279b0ad5dcfee24244df3b5bcf9f284533f8a07374e24"),
            ("supabase/migrations/1803_E01-S176_ingestao_foto_cadastral_grupo.sql", "cf0228021475f55810bed334dd6b60918a58ace3c68e944bb9abbb01f4171747"),
        ):
            numero = Path(caminho).name[:4]
            existentes = [p for p in base_files + names if Path(p).name[:4] == numero]
            if existentes:
                if existentes != [caminho]:
                    raise RuntimeError("Migration S176 duplicada no recorte S165: " + numero)
                continue
            dados = (ROOT / caminho).read_bytes()
            if hashlib.sha256(dados).hexdigest() != digest:
                raise RuntimeError("Hash da migration S176 predecessora divergente: " + numero)
            if not names or names[-1] >= caminho:
                raise RuntimeError("Ordem da migration S176 predecessora inválida: " + numero)
            blobs.append((caminho, dados))
            names.append(caminho)
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
    if aprovacao_1806 is not None:
        if any(Path(p).name.startswith("1806_") for p in base_files + names) or names[-1] >= caminho_1806:
            raise RuntimeError("Ordem ou duplicidade da migration 1806")
        blobs.append((caminho_1806, aprovacao_1806))
        names.append(caminho_1806)
    if revisao_1807 is not None:
        if any(Path(p).name.startswith("1807_") for p in base_files + names) or names[-1] != caminho_1806 or names[-1] >= caminho_1807:
            raise RuntimeError("Ordem ou duplicidade da migration 1807")
        blobs.append((caminho_1807, revisao_1807))
        names.append(caminho_1807)
    if consulta_1808 is not None:
        if any(Path(p).name.startswith("1808_") for p in base_files + names) or names[-1] != caminho_1807 or names[-1] >= caminho_1808:
            raise RuntimeError("Ordem ou duplicidade da migration 1808")
        blobs.append((caminho_1808, consulta_1808))
        names.append(caminho_1808)
    if isolamento_1810 is not None:
        for caminho, dados in isolamento_1810:
            if any(Path(p).name[:4] == Path(caminho).name[:4] for p in base_files + names) or names[-1] >= caminho:
                raise RuntimeError("Ordem ou duplicidade de isolamento: " + caminho)
            blobs.append((caminho, dados))
            names.append(caminho)
    if upload_1811 is not None:
        caminho = s168_upload_1811_isolada.MIGRATION
        if any(Path(p).name[:4] == "1811" for p in base_files + names) or names[-1] >= caminho:
            raise RuntimeError("Ordem ou duplicidade de upload 1811")
        blobs.append((caminho, upload_1811[0]))
        names.append(caminho)
    if documento_1812 is not None:
        caminho = s178_documento_1812_isolada.MIGRATION
        if any(Path(p).name[:4] == "1812" for p in base_files + names) or names[-1] >= caminho:
            raise RuntimeError("Ordem ou duplicidade de documento 1812")
        blobs.append((caminho, documento_1812[0]))
        names.append(caminho)
    if hierarquia_1813 is not None:
        caminho = s176_hierarquia_1813_isolada.MIGRATION
        if any(Path(p).name[:4] == "1813" for p in base_files + names) or names[-1] >= caminho:
            raise RuntimeError("Ordem ou duplicidade de hierarquia 1813")
        blobs.append((caminho, hierarquia_1813[0]))
        names.append(caminho)
    if policies_1814 is not None:
        caminho = s168_policies_1814_isolada.MIGRATION
        if any(Path(p).name[:4] == "1814" for p in base_files + names) or names[-1] >= caminho:
            raise RuntimeError("Ordem ou duplicidade de policies 1814")
        blobs.append((caminho, policies_1814[0]))
        names.append(caminho)
    if dispatch_1815 is not None:
        caminho = s168_dispatch_1815_isolada.MIGRATION
        if any(Path(p).name[:4] == "1815" for p in base_files + names) or names[-1] != s168_policies_1814_isolada.MIGRATION:
            raise RuntimeError("Ordem ou duplicidade de dispatch 1815")
        blobs.append((caminho, dispatch_1815[0]))
        names.append(caminho)
    if gates_1816 is not None:
        caminho = s178_gates_1816_isolada.MIGRATION
        if any(Path(p).name[:4] == "1816" for p in base_files + names) or names[-1] != s168_dispatch_1815_isolada.MIGRATION:
            raise RuntimeError("Ordem ou duplicidade de gates 1816")
        blobs.append((caminho, gates_1816[0]))
        names.append(caminho)
    if criacao_1817 is not None:
        if any(Path(p).name[:4] == "1817" for p in base_files + names) or names[-1] != s178_gates_1816_isolada.MIGRATION:
            raise RuntimeError("Ordem ou duplicidade da criação 1817")
        blobs.append((caminho_1817, criacao_1817))
        names.append(caminho_1817)
    if ativacao_1818 is not None:
        if any(Path(p).name[:4] == "1818" for p in base_files + names) or names[-1] != caminho_1817:
            raise RuntimeError("Ordem ou duplicidade da ativação 1818")
        blobs.append((caminho_1818, ativacao_1818))
        names.append(caminho_1818)
    if migracoes_s166_ui:
        for caminho, dados in migracoes_s166_ui:
            if any(Path(p).name[:4] == Path(caminho).name[:4] for p in base_files + names) or names[-1] >= caminho:
                raise RuntimeError("Ordem ou duplicidade de migration S166 V2")
            blobs.append((caminho, dados))
            names.append(caminho)
    if migracoes_s165_ui:
        for caminho, dados in migracoes_s165_ui:
            numero = Path(caminho).name[:4]
            if (any(Path(p).name[:4] == numero for p in base_files + names)
                or not names or names[-1] >= caminho):
                raise RuntimeError("Ordem ou duplicidade do overlay S165: " + numero)
            blobs.append((caminho, dados))
            names.append(caminho)
        print("OVERLAY S165: migrations 1822–1824 aplicadas após as demais candidatas.", flush=True)
    if opcoes.diagnostico_0415 and sum(Path(p).name.startswith("0415_") for p in names) != 1:
        raise RuntimeError("Diagnóstico exige exatamente uma migration 0415")
    numeros = [Path(p).name[:4] for p in base_files + names]
    if len(numeros) != len(set(numeros)): raise RuntimeError("Número de migration duplicado entre base e candidatas")
    ordem_aplicacao = base_files + names
    for caminho, _dados in migracoes_s165_ui:
        item = next(m for m in json.loads(OVERLAY_S165_UI.read_text())["migrations"] if m["caminho"] == caminho)
        for dependencia in item["depende_de"]:
            if dependencia.startswith("supabase/migrations/") and (
                dependencia not in ordem_aplicacao or ordem_aplicacao.index(dependencia) >= ordem_aplicacao.index(caminho)
            ):
                raise RuntimeError("Dependência S165 ausente ou fora de ordem: " + Path(dependencia).name)
    for imagem in (IMAGE, AUTH_IMAGE, REST_IMAGE, STORAGE_IMAGE) + ((EDGE_IMAGE,) if opcoes.edge_documento_http else ()):
        image = json.loads(docker("image", "inspect", imagem))[0]
        if image["Config"].get("Volumes"): raise RuntimeError("Imagem declara volumes implícitos")
        if imagem == EDGE_IMAGE and "supabase/edge-runtime@sha256:ad45164b7548bf5820ed7be714789c17ac2865edce79a09cfb4c3756c3d365a8" not in (image.get("RepoDigests") or []):
            raise RuntimeError("Digest da imagem Edge divergente")
    initial_volumes = set(docker("volume", "ls", "-q").splitlines())
    # A base só é consultada para dimensionamento. Não são lidos/copied dados dela.
    source_container = "sso-validacao-isolada-20261104"
    if docker_raiz_github is None:
        src = inspect("container", source_container)
        if src["Config"]["Image"] != IMAGE or src["HostConfig"].get("NetworkMode") != "none" or src["Mounts"] or any(src["NetworkSettings"].get("Ports", {}).values()):
            raise RuntimeError("Referência de espaço não atestada")
        database_bytes = int(docker("exec", source_container, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "select pg_database_size(current_database())"))
        data_dir = docker("exec", source_container, "psql", "-U", "postgres", "-d", "postgres", "-Atqc", "show data_directory")
        if not data_dir.startswith("/var/lib/postgresql/") or ".." in data_dir: raise RuntimeError("Diretório de WAL não reconhecido")
        wal_bytes = int(docker("exec", source_container, "du", "-sk", data_dir + "/pg_wal").split()[0]) * 1024
        budget = 2 * database_bytes + 2 * wal_bytes + sum(len(b) for _, b in blobs) * 4
    else:
        budget = MINIMO_GITHUB + sum(len(b) for _, b in blobs) * 4
    vm_bytes = espaco_docker()
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
    if opcoes.jornada_ac5_http or opcoes.fixture_s165_e2e or opcoes.fixture_s170_e2e or opcoes.fixture_s166_e2e or opcoes.ui_s176_e2e:
        auth_env.update({"GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED": "true", "GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI": "pg-functions://postgres/config/custom_access_token_hook"})
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

    def iniciar_plataforma(nome, imagem, env, comando=None, arquivo=None):
        args = ["create", "--name", nome, "--network", NETWORK, "--label", "sso.recorte=" + IDENT]
        for key, value in env.items(): args += ["--env", key + "=" + value]
        docker(*args, imagem, *(comando or []))
        if arquivo is not None: docker("cp", str(arquivo), nome + ":/tmp/index.ts")
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
        rotulo = "PostgREST" if nome == REST_CONTAINER else "Storage"
        status = "sem resposta"
        for _ in range(45):
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
            if not inspect("container", nome)["State"]["Running"]:
                raise RuntimeError(rotulo + " encerrou antes de ficar pronto: " + diagnostico_plataforma(nome))
            try:
                recebido = docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + nome + ":" + porta + caminho)
                status = recebido if re.fullmatch(r"[0-9]{3}", recebido) else "inválido"
                if status == "200": break
            except Exception: status = "sem resposta"
            time.sleep(1)
        else: raise RuntimeError(rotulo + " não ficou pronto; HTTP " + status + "; " + diagnostico_plataforma(nome))
    if query("select to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null and to_regclass('storage.migrations') is not null") != "t":
        raise RuntimeError("Migrations oficiais Storage incompletas")
    print("PostgREST e Storage oficiais prontos; relações de Storage presentes.", flush=True)
    prefix = b"\\set VERBOSITY verbose\n"
    for path in base_files:
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
        if min(shutil.disk_usage(ROOT).free, espaco_docker()) < budget:
            raise RuntimeError("Espaço atingiu limite durante aplicação da base")
        sql(prefix + git("show", base + ":" + path), path)
    print("Base Git aplicada:", len(base_files), flush=True)
    for path, data in blobs:
        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
        if min(shutil.disk_usage(ROOT).free, espaco_docker()) < budget:
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
        if policies_1814 is not None and path == s168_policies_1814_isolada.MIGRATION:
            s168_policies_1814_isolada.executar(CONTAINER, policies_1814[1], query, watchdog_triggered)
    print("Migrations candidatas aplicadas:", len(blobs), flush=True)
    if aprovacao_1805 is not None:
        print("Migration 1805 aplicada com gate desligado; isto não comprova sua guarda.", flush=True)
    if aprovacao_1806 is not None:
        print("Migration 1806 aplicada em clone; fixtures seguintes avaliam cenários selecionados.", flush=True)
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0") != "t": raise RuntimeError("Banco contém dados inesperados")
    if opcoes.diagnostico_ac5:
        for gate in gates_ac5:
            tabela, coluna = gate["tabela"], gate["coluna"]
            estado = query(f'select coalesce((select not "{coluna}" from pcm."{tabela}" where id),false)::text')
            if estado.strip() != "true":
                raise RuntimeError("Gate diagnóstico AC5 ausente ou aberto: " + tabela + "." + coluna)
        print("Gates AC5 listados confirmados fechados; demais gates exigem revisão independente.", flush=True)
    if fixture_1817 is not None:
        s184_criacao_1817_isolada.executar(CONTAINER, fixture_1817, query, watchdog_triggered)
    if fixture_1818 is not None:
        s184_ativacao_1818_isolada.executar(CONTAINER, fixture_1818, query, watchdog_triggered)
    if isolamento_1810 is not None:
        if query("select not habilitado from config.sso_estrutura_cliente_leitura_gate where id") != "t":
            raise RuntimeError("Gate de isolamento inicial aberto ou ausente")
        # Um runner verifica baseline e rollback para todas as fixtures pgTAP selecionadas.
        s176_runner_pgtap.executar(CONTAINER, fixtures if opcoes.fixtures_pgtap_ci else (fixtures or []) + fixture_1810, sql, query, watchdog_triggered)
    elif fixtures is not None:
        s176_runner_pgtap.executar(CONTAINER, fixtures, sql, query, watchdog_triggered)
    if aprovacao_1804 is not None:
        s165_aprovacao_1804_isolada.executar(CONTAINER, aprovacao_1804[1:], query, watchdog_triggered)
    if aprovacao_1805 is not None:
        s165_aprovacao_1805_isolada.executar(CONTAINER, fixture_1805, query, watchdog_triggered)
    if aprovacao_1806 is not None:
        s165_aprovacao_1806_isolada.executar(CONTAINER, fixture_1806, query, watchdog_triggered)
    if revisao_1807 is not None:
        s165_revisao_1807_isolada.executar(CONTAINER, fixture_1807, query, watchdog_triggered)
    if consulta_1808 is not None:
        s165_consulta_1808_isolada.executar(CONTAINER, fixture_1808, query, watchdog_triggered)
    if isolamento_1810 is not None:
        if query("select not habilitado from config.sso_estrutura_cliente_leitura_gate where id") != "t":
            raise RuntimeError("Gate de isolamento alterado após fixtures")
        for gate in gates_ac5:
            tabela, coluna = gate["tabela"], gate["coluna"]
            if query(f'select coalesce((select not "{coluna}" from pcm."{tabela}" where id),false)::text').strip() != "true":
                raise RuntimeError("Gate AC5 alterado após fixtures: " + tabela + "." + coluna)
    if dispatch_1815 is not None:
        s168_dispatch_1815_isolada.executar(CONTAINER, dispatch_1815[1], query, watchdog_triggered)
    if upload_1811 is not None:
        s168_upload_1811_isolada.executar(CONTAINER, upload_1811[1], query, watchdog_triggered)
    if gates_1816 is not None:
        s178_gates_1816_isolada.executar(CONTAINER, gates_1816[1], query, watchdog_triggered)
    if documento_1812 is not None:
        if query("select not habilitado from pcm.sso_documento_ativo_mediado_gate where id") != "t":
            raise RuntimeError("Gate de documento inicial aberto ou ausente")
        s178_documento_1812_isolada.executar(CONTAINER, documento_1812[1], query, watchdog_triggered)
        if query("select not habilitado from pcm.sso_documento_ativo_mediado_gate where id") != "t":
            raise RuntimeError("Gate de documento alterado após fixture")
    if hierarquia_1813 is not None:
        if query("select not habilitado from pcm.sso_hierarquia_grupos_mediada_gate where id") != "t":
            raise RuntimeError("Gate da hierarquia inicial aberto ou ausente")
        s176_hierarquia_1813_isolada.executar(CONTAINER, hierarquia_1813[1], query, watchdog_triggered)
        if query("select not habilitado from pcm.sso_hierarquia_grupos_mediada_gate where id") != "t":
            raise RuntimeError("Gate da hierarquia alterado após fixture")
    if opcoes.concorrencia_1810:
        import s176_isolamento_concorrencia_1810
        s176_isolamento_concorrencia_1810.executar(CONTAINER, watchdog_triggered)
        if query("select not habilitado from config.sso_estrutura_cliente_leitura_gate where id") != "t":
            raise RuntimeError("Gate de isolamento alterado após concorrência")
    if opcoes.jornada_ac5_http or opcoes.fixture_s165_e2e or opcoes.fixture_s170_e2e or opcoes.fixture_s166_e2e or opcoes.ui_s176_e2e:
        # pcm só existe após as migrations: recriar apenas o PostgREST próprio,
        # agora expondo o schema real. Nunca criar schema artificialmente.
        if query("select to_regnamespace('pcm') is not null") != "t":
            raise RuntimeError("Schema pcm ausente após migrations")
        with watchdog_lock:
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
            anterior = inspect("container", REST_CONTAINER)
            if (anterior["Id"] != platform_container_ids.get(REST_CONTAINER)
                or anterior["Name"] != "/" + REST_CONTAINER
                or anterior["Config"].get("Labels", {}).get("sso.recorte") != IDENT):
                raise RuntimeError("Identidade PostgREST divergente")
            docker("rm", "-f", anterior["Id"])
            del platform_container_ids[REST_CONTAINER]
        rest_env["PGRST_DB_SCHEMAS"] = (
            "public,pcm,atendimento" if opcoes.edge_documento_http
            else "public,pcm,config" if opcoes.fixture_s165_e2e or opcoes.fixture_s170_e2e or opcoes.fixture_s166_e2e or opcoes.ui_s176_e2e
            else "public,pcm"
        )
        iniciar_plataforma(REST_CONTAINER, REST_IMAGE, rest_env)
        for _ in range(45):
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio")
            if not inspect("container", REST_CONTAINER)["State"]["Running"]:
                raise RuntimeError("PostgREST encerrou após migrations: " + diagnostico_plataforma(REST_CONTAINER))
            try:
                status = docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + REST_CONTAINER + ":3000/")
                if status == "200": break
            except Exception: pass
            time.sleep(1)
        else: raise RuntimeError("PostgREST não ficou pronto após migrations: " + diagnostico_plataforma(REST_CONTAINER))
    if opcoes.jornada_ac5_http:
        import importlib.util
        modulo = importlib.util.spec_from_file_location("s168_jornada_http", ROOT / "apps/web/e2e/s168-retorno-isolado/jornada.py")
        if modulo is None or modulo.loader is None: raise RuntimeError("Driver HTTP indisponível")
        jornada = importlib.util.module_from_spec(modulo)
        modulo.loader.exec_module(jornada)
        def requisitar(url, metodo, headers, corpo):
            permitidos = ("http://" + AUTH_CONTAINER + ":9999/", "http://" + REST_CONTAINER + ":3000/", "http://" + STORAGE_CONTAINER + ":5000/")
            if not any(url.startswith(prefixo) for prefixo in permitidos): raise RuntimeError("URL fora da rede do ensaio")
            cmd = ["rtk", "proxy", "docker", "exec", "-i", CONTAINER, "curl", "--silent", "--show-error", "--max-time", "35", "--request", metodo, "--output", "-", "--write-out", "\n%{http_code}"]
            for chave_header, valor_header in headers.items(): cmd += ["--header", chave_header + ": " + valor_header]
            cmd += ["--data-binary", "@-", url]
            try: resposta = subprocess.run(cmd, input=corpo, capture_output=True, timeout=40)
            except subprocess.TimeoutExpired: raise RuntimeError("Prazo HTTP do ensaio excedido") from None
            if resposta.returncode: raise RuntimeError("Transporte HTTP interno falhou")
            try:
                conteudo, codigo = resposta.stdout.rsplit(b"\n", 1)
                return int(codigo), conteudo
            except (ValueError, TypeError): raise RuntimeError("Resposta HTTP inválida") from None
        jornada.executar(sql, query, requisitar, "http://" + AUTH_CONTAINER + ":9999", "http://" + REST_CONTAINER + ":3000", "http://" + STORAGE_CONTAINER + ":5000", chave("anon"), watchdog_triggered)
        print("Jornada HTTP parcial concluída; não comprova Edge nem origem real.", flush=True)
        if opcoes.edge_documento_http:
            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu ensaio Edge")
            segredo_barreira = secrets.token_hex(32)
            gateway_env = {"AUTH_ORIGIN": "http://" + AUTH_CONTAINER + ":9999", "REST_ORIGIN": "http://" + REST_CONTAINER + ":3000", "STORAGE_ORIGIN": "http://" + STORAGE_CONTAINER + ":5000", "BARRIER_SECRET": segredo_barreira}
            gateway_path = ROOT / "apps/web/e2e/s178-documento-isolado/gateway.ts"
            driver_path = ROOT / "apps/web/e2e/s178-documento-isolado/jornada.py"
            with tempfile.TemporaryDirectory(prefix="sso-documento-bundle-") as temporario:
                bundle = Path(temporario) / "index.ts"
                try:
                    compilacao = subprocess.run(["deno", "bundle", "--deny-import", "--frozen", "--lock", str(ROOT / "deno.lock"), "--import-map", str(ROOT / "apps/web/e2e/s178-documento-isolado/import-map.json"), "--node-modules-dir=none", "-o", str(bundle), str(ROOT / "supabase/functions/pcm-documento-staging-ativo-seguro/index.ts")], capture_output=True, timeout=120)
                except subprocess.TimeoutExpired: raise RuntimeError("Prazo de compilação Edge excedido") from None
                if compilacao.returncode or not bundle.is_file(): raise RuntimeError("Bundle Edge indisponível sem rede")
                iniciar_plataforma(GATEWAY_CONTAINER, EDGE_IMAGE, gateway_env, ["start", "--main-service", "/tmp", "--port", "9000"], gateway_path)
                edge_env = {"SUPABASE_URL": "http://" + GATEWAY_CONTAINER + ":9000", "SUPABASE_ANON_KEY": chave("anon"), "SUPABASE_SERVICE_ROLE_KEY": chave("service_role"), "SSO_DOCUMENTO_ATIVO_MEDIADO_ENABLED": "true"}
                iniciar_plataforma(EDGE_CONTAINER, EDGE_IMAGE, edge_env, ["start", "--main-service", "/tmp", "--port", "9000"], bundle)
                for nome in (GATEWAY_CONTAINER, EDGE_CONTAINER):
                    for _ in range(30):
                        if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu Edge")
                        try:
                            if docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + nome + ":9000/") in ("404", "405"): break
                        except Exception: pass
                        time.sleep(1)
                    else: raise RuntimeError("Serviço Edge sintético indisponível")
                spec = importlib.util.spec_from_file_location("s178_documento_http", driver_path)
                if spec is None or spec.loader is None: raise RuntimeError("Driver de documento indisponível")
                modulo = importlib.util.module_from_spec(spec); spec.loader.exec_module(modulo)
                def requisitar_edge(url, metodo, headers, corpo):
                    if any(url.startswith("http://" + nome + ":9000/") for nome in (GATEWAY_CONTAINER, EDGE_CONTAINER, *FOTOS_CONTAINERS.values())):
                        cmd = ["rtk", "proxy", "docker", "exec", "-i", CONTAINER, "curl", "--silent", "--show-error", "--max-time", "35", "--request", metodo, "--output", "-", "--write-out", "\n%{http_code}"]
                        for k, v in headers.items(): cmd += ["--header", k + ": " + v]
                        cmd += ["--data-binary", "@-", url]
                        try: resposta = subprocess.run(cmd, input=corpo, capture_output=True, timeout=40)
                        except subprocess.TimeoutExpired: raise RuntimeError("Prazo HTTP Edge excedido") from None
                        if resposta.returncode: raise RuntimeError("Transporte Edge interno falhou")
                        try:
                            conteudo, codigo = resposta.stdout.rsplit(b"\n", 1)
                            return int(codigo), conteudo
                        except (ValueError, TypeError): raise RuntimeError("Resposta Edge inválida") from None
                    return requisitar(url, metodo, headers, corpo)
                modulo.executar(sql, query, requisitar_edge, "http://" + AUTH_CONTAINER + ":9999", "http://" + STORAGE_CONTAINER + ":5000", "http://" + EDGE_CONTAINER + ":9000", "http://" + GATEWAY_CONTAINER + ":9000", chave("anon"), chave("service_role"), segredo_barreira, watchdog_triggered)
                if opcoes.edge_fotos_http:
                    fontes = {"sistema": "pcm-foto-staging-ativo-segura", "grupo": "pcm-foto-staging-grupo-segura", "equipamento": "pcm-foto-equipamento-segura"}
                    for tipo, fonte in fontes.items():
                        destino = Path(temporario) / (tipo + ".ts")
                        try:
                            compilacao = subprocess.run(["deno", "bundle", "--deny-import", "--frozen", "--lock", str(ROOT / "deno.lock"), "--import-map", str(ROOT / "apps/web/e2e/s178-documento-isolado/import-map.json"), "--node-modules-dir=none", "-o", str(destino), str(ROOT / "supabase/functions" / fonte / "index.ts")], capture_output=True, timeout=120)
                        except subprocess.TimeoutExpired: raise RuntimeError("Prazo do bundle foto excedido") from None
                        if compilacao.returncode or not destino.is_file(): raise RuntimeError("Bundle foto indisponível: " + tipo)
                        iniciar_plataforma(FOTOS_CONTAINERS[tipo], EDGE_IMAGE, {**edge_env, "SSO_FOTO_GRUPO_MEDIADA_ENABLED": "true"}, ["start", "--main-service", "/tmp", "--port", "9000"], destino)
                        for _ in range(30):
                            if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu foto Edge")
                            try:
                                if docker("exec", CONTAINER, "curl", "--silent", "--max-time", "2", "--output", "/dev/null", "--write-out", "%{http_code}", "http://" + FOTOS_CONTAINERS[tipo] + ":9000/") == "405": break
                            except Exception: pass
                            time.sleep(1)
                        else: raise RuntimeError("Rota foto sintética indisponível: " + tipo)
                    spec = importlib.util.spec_from_file_location("s178_fotos_http", ROOT / "apps/web/e2e/s178-documento-isolado/jornada_fotos.py")
                    if spec is None or spec.loader is None: raise RuntimeError("Driver de fotos indisponível")
                    fotos = importlib.util.module_from_spec(spec); spec.loader.exec_module(fotos)
                    fotos.executar(sql, query, requisitar_edge, "http://" + AUTH_CONTAINER + ":9999", "http://" + STORAGE_CONTAINER + ":5000", {k: "http://" + v + ":9000" for k,v in FOTOS_CONTAINERS.items()}, "http://" + GATEWAY_CONTAINER + ":9000", chave("anon"), chave("service_role"), segredo_barreira, watchdog_triggered)

    if concorrencia_1807 is not None:
        s165_concorrencia_1807_isolada.executar(CONTAINER, concorrencia_1807, watchdog_triggered)
    if concorrencia_1805:
        import s165_concorrencia_1805_isolada
        s165_concorrencia_1805_isolada.executar(CONTAINER, watchdog_triggered)
    if opcoes.concorrencia_parcial:
        import s176_runner_concorrencia
        s176_runner_concorrencia.executar(CONTAINER, watchdog_triggered)
    if pos_commit_1805 is not None:
        s165_aprovacao_1805_pos_commit.executar(CONTAINER, pos_commit_1805, query, watchdog_triggered)
    if proxy_s176 is not None:
        credenciais_s176 = s176_fixture_ui_isolada.executar(
            sql, query, inspect, IDENT, NETWORK,
            {"db": CONTAINER, "auth": AUTH_CONTAINER, "rest": REST_CONTAINER}, watchdog_triggered,
        )
        s176_ui_isolada.executar(ROOT, docker, docker_monitor, inspect, IDENT, NETWORK, S176_BROWSER,
                                 chave("anon"), credenciais_s176, proxy_s176, watchdog_triggered,
                                 watchdog_lock, platform_container_ids)
        del credenciais_s176
    if fixture_s170 is not None:
        credenciais_s170 = s170_fixture_isolada.executar(
            ROOT, sql, query, inspect, IDENT, NETWORK,
            {"db": CONTAINER, "auth": AUTH_CONTAINER, "rest": REST_CONTAINER},
            fixture_s170, watchdog_triggered,
        )
        if proxy_s170 is not None:
            s170_ui_isolada.executar(ROOT, docker, docker_monitor, inspect, IDENT, NETWORK, S170_BROWSER,
                                     chave("anon"), credenciais_s170, proxy_s170, watchdog_triggered,
                                     watchdog_lock, platform_container_ids)
        del credenciais_s170
        print("Fixture S170 sintética preparada no clone descartável.", flush=True)
    if fixture_s165 is not None:
        credenciais_s165 = s165_e2e_clientes_isolada.executar(
            sql, query, inspect, IDENT, NETWORK,
            {"db": CONTAINER, "auth": AUTH_CONTAINER, "rest": REST_CONTAINER},
            fixture_s165, watchdog_triggered,
        )
        if proxy_s165 is not None:
            s165_ui_isolada.executar(ROOT, docker, docker_monitor, inspect, IDENT, NETWORK, S165_BROWSER,
                                     chave("anon"), credenciais_s165, proxy_s165, watchdog_triggered,
                                     watchdog_lock, platform_container_ids)
        del credenciais_s165
        print("Fixture parcial S165: dois Clientes e atores sintéticos; revisão e histórico não executados.", flush=True)
    if fixture_s166 is not None:
        import s166_fixture_isolada
        credenciais_s166 = s166_fixture_isolada.executar(
            sql, query, inspect, IDENT, NETWORK,
            {"db": CONTAINER, "auth": AUTH_CONTAINER, "rest": REST_CONTAINER},
            fixture_s166, watchdog_triggered,
        )
        if proxy_s166 is not None:
            s166_ui_isolada.executar(ROOT, docker, docker_monitor, inspect, IDENT, NETWORK, S166_BROWSER,
                                     chave("anon"), credenciais_s166, proxy_s166, watchdog_triggered,
                                     watchdog_lock, platform_container_ids)
        del credenciais_s166
        print("Fixture persistente S166: 501 Visitas sintéticas e atores A/B no clone descartável.", flush=True)
    if watchdog_triggered.is_set(): raise RuntimeError("Monitor interrompeu o ensaio por espaço ou falha de medição")
    if opcoes.diagnostico_0415:
        print("PASS DIAGNÓSTICO: ações antecipadas; NÃO prova recorte implantável nem testes funcionais.")
    elif opcoes.diagnostico_ac5:
        print("PASS DIAGNÓSTICO AC5: compilação e gates listados; NÃO prova prontidão nem autoriza release.")
    elif opcoes.integracao_candidata:
        print("PASS INTEGRAÇÃO CANDIDATA: compilação apenas; NÃO autoriza release nem prova testes funcionais.")
    else:
        print("PASS: compilação das migrations selecionadas em banco descartável; testes funcionais não executados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ui-s165-e2e", action="store_true", help="Executa somente cenário parcial UI S165 dentro da rede interna.")
    parser.add_argument("--fixture-s165-e2e", action="store_true", help="Prepara somente usuários e dois Clientes sintéticos; não executa a interface.")
    parser.add_argument("--fixture-s170-e2e", action="store_true", help="Prepara apenas fixture S170 em clone AC5; não executa interface.")
    parser.add_argument("--ui-s170-e2e", action="store_true", help="Executa UI S170 no mesmo clone interno da fixture.")
    parser.add_argument("--ui-s176-e2e", action="store_true", help="Executa UI S176 em clone exclusivo com isolamento.")
    parser.add_argument("--fixture-s166-e2e", action="store_true", help="Prepara 501 Visitas sintéticas em clone descartável para E2E S166.")
    parser.add_argument("--ui-s166-e2e", action="store_true", help="Executa jornada UI S166 no clone com fixture persistente.")
    parser.add_argument("--edge-fotos-http", action="store_true", help="Valida três rotas de foto em clone sintético; exige --edge-documento-http.")
    parser.add_argument("--edge-documento-http", action="store_true", help="Valida Edge documental com Auth/Storage e revogação em clone; exige jornada AC5 e 1816.")
    parser.add_argument("--github-hosted", action="store_true", help="Modo opt-in Linux/CI; reserva hipotética de 20 GiB, não atesta efemeridade.")
    grupo = parser.add_mutually_exclusive_group()
    grupo.add_argument("--diagnostico-0415", action="store_true", help="Antecipa duas ações somente no clone; resultado não prova recorte implantável.")
    grupo.add_argument("--integracao-candidata", action="store_true", help="Inclui migrations originais candidatas, sem seeds artificiais; não autoriza release.")
    parser.add_argument("--ativacao-1818", action="store_true", help="Aplica e testa ativação 1818; exige criação 1817.")
    parser.add_argument("--criacao-1817", action="store_true", help="Aplica mediação comercial 1817 antes do lote pgTAP; exige gates 1816.")
    parser.add_argument("--fixtures-pgtap-ci", action="store_true", help="Executa seleção SQL da CI no clone; não equivale a supabase start.")
    parser.add_argument("--fixtures-pgtap", action="store_true", help="Executa cinco fixtures sintéticas apenas no candidato de integração descartável.")
    parser.add_argument("--concorrencia-parcial", action="store_true", help="Executa dois cenários concorrentes parciais apenas no candidato de integração descartável.")
    parser.add_argument("--aprovacao-1804", action="store_true", help="Aplica 1804 fixada e executa fixture sintética com rollback; exige integração candidata.")
    parser.add_argument("--aprovacao-1805", action="store_true", help="Aplica 1805 fixada após 1804, com gate desligado; exige --aprovacao-1804.")
    parser.add_argument("--aprovacao-1806", action="store_true", help="Aplica 1806 fixada após 1805; exige integração, 1804 e 1805.")
    parser.add_argument("--revisao-1807", action="store_true", help="Aplica 1807 e fixture isolada com rollback; exige integração e 1804–1806.")
    parser.add_argument("--consulta-1808", action="store_true", help="Aplica 1808 e fixture isolada com rollback; exige --revisao-1807.")
    parser.add_argument("--diagnostico-ac5", action="store_true", help="Compila sobreposição AC5 revisada em clone; exige integração, sem fixtures.")
    parser.add_argument("--isolamento-1810", action="store_true", help="Inclui 1804–1810 e suas fixtures; aceita --fixtures-pgtap; exige AC5 e integração.")
    parser.add_argument("--concorrencia-1810", action="store_true", help="Executa quatro disputas sintéticas; exige --isolamento-1810 e descarte integral do clone.")
    parser.add_argument("--gates-1816", action="store_true", help="Aplica e valida gates 1816 antes da fixture 1812; exige dispatch 1815.")
    parser.add_argument("--dispatch-1815", action="store_true", help="Aplica e valida 1815 após policy 1814; exige --policies-1814.")
    parser.add_argument("--policies-1814", action="store_true", help="Aplica 1814 e valida policies antes da fixture 1811; exige hierarquia 1813.")
    parser.add_argument("--upload-1811", action="store_true", help="Aplica 1811 e executa fixture SQL com rollback; exige isolamento 1810.")
    parser.add_argument("--documento-1812", action="store_true", help="Aplica 1812 e valida ACL/gates com rollback; exige --upload-1811.")
    parser.add_argument("--hierarquia-1813", action="store_true", help="Aplica 1813 e valida hierarquia com rollback; exige --documento-1812.")
    parser.add_argument("--jornada-ac5-http", action="store_true", help="Executa jornada HTTP parcial Auth/Storage em clone descartável; exige --upload-1811.")
    parser.add_argument("--concorrencia-1807", action="store_true", help="Cenários concorrentes 1807 com commit sintético e descarte obrigatório do clone.")
    parser.add_argument("--aprovacao-1805-pos-commit", action="store_true", help="Fixture sintética com COMMIT em clone descartável; exige 1804 e 1805.")
    parser.add_argument("--concorrencia-1805", action="store_true", help="Cenários concorrentes 1805 em clone descartável; exige integração, 1804 e 1805.")
    opcoes = parser.parse_args()
    code = 0
    try: main(opcoes)
    except Exception as exc: print("FALHA:", str(exc)); code = 1
    finally:
        watchdog_stop.set()
        if watchdog_thread is not None:
            watchdog_thread.join(timeout=45)
            if watchdog_thread.is_alive():
                print("Monitor não encerrou; tentando limpeza com exclusão mútua.")
                code = 1
        if watchdog_triggered.is_set():
            print("Monitor acionado: limite de espaço ou falha de medição.")
            code = 1
        # Varrer por rótulo e nome, inclusive se `docker create` tiver falhado depois
        # de criar o recurso. Nunca remover volume anterior à execução.
        limpeza_trava = watchdog_lock.acquire(timeout=8)
        try:
            if not limpeza_trava:
                raise RuntimeError("Monitor mantém trava de limpeza")
            containers = docker("ps", "-a", "--filter", "label=sso.recorte=" + IDENT, "--format", "{{.ID}}").splitlines()
            for container_id in containers:
                c = inspect("container", container_id)
                if c["Name"] not in ("/" + CONTAINER, "/" + AUTH_CONTAINER, "/" + REST_CONTAINER, "/" + STORAGE_CONTAINER, "/" + GATEWAY_CONTAINER, "/" + EDGE_CONTAINER, "/" + S165_BROWSER, "/" + S170_BROWSER, "/" + S166_BROWSER, "/" + S176_BROWSER, *("/" + nome for nome in FOTOS_CONTAINERS.values())) or c["Config"].get("Labels", {}).get("sso.recorte") != IDENT:
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
            print("Identidade exclusiva para inspeção:", IDENT, "rede esperada:", NETWORK)
            code = 1
        finally:
            if limpeza_trava:
                watchdog_lock.release()
        if space_before is not None:
            try:
                host_after = shutil.disk_usage(ROOT).free
                vm_after = espaco_docker()
                print(f"Espaço depois: host={host_after} bytes; VM={vm_after} bytes.")
            except Exception:
                print("Espaço após limpeza indisponível.")
                code = 1
    sys.exit(code)
