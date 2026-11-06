"""Rascunho do bootstrap UI S170. Só opera dentro do clone já atestado.

O chamador é responsável por watchdog, remoção do contêiner e rede. Ainda não
prepara revisão, impactos ou histórico. Não utilizar para qualquer destino real.
"""
import hashlib
import ipaddress
import json
import os
import re
import subprocess
import threading
from pathlib import Path

IMAGE = "mcr.microsoft.com/playwright:v1.61.1-noble"
DIGEST = "mcr.microsoft.com/playwright@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48"
PROXY = "apps/web/e2e/s165-isolado/proxy.cjs"


def preparar(root, esperado):
    proxy = (root / PROXY).read_bytes()
    if hashlib.sha256(proxy).hexdigest() != esperado:
        raise RuntimeError("Proxy S170 divergente")
    for caminho, digest in (
        ("apps/web/e2e/capacidades-sso.spec.ts", "c18d4216009a98323014c321c26b7fd72aa4e21fdf35530c6778b48f7a6d71c6"),
        ("apps/web/playwright.s170-isolado.config.ts", "42f93c2fc44d26760a8fca6949754717995f25e566f71644f2f7ce88ca0ea1ab"),
    ):
        if hashlib.sha256((root / caminho).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Teste UI S170 divergente")
    return proxy


def _comando(args, *, data=None, timeout=180, watchdog=None):
    if watchdog is not None and watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S170")
    processo = subprocess.Popen(args, stdin=subprocess.PIPE if data is not None else subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    encerrado = threading.Event()
    def vigiar():
        while not encerrado.wait(.2):
            if watchdog is not None and watchdog.is_set():
                try: processo.kill()
                except ProcessLookupError: pass
                return
    vigia = threading.Thread(target=vigiar, daemon=True)
    vigia.start()
    try:
        saida, _ = processo.communicate(input=data, timeout=timeout)
    except subprocess.TimeoutExpired:
        processo.kill()
        processo.communicate()
        raise RuntimeError("Prazo do bootstrap UI S170 excedido") from None
    finally:
        encerrado.set()
        vigia.join(timeout=2)
    if processo.returncode or (watchdog is not None and watchdog.is_set()):
        raise RuntimeError("Bootstrap UI S170 falhou")
    return saida


def _copiar_arvore(root, relativo, nome, watchdog):
    """Transmite tar sem seguir symlinks; extração como usuário não privilegiado."""
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu cópia UI S170")
    origem = subprocess.Popen(["rtk", "proxy", "tar", "-C", str(root), "-cf", "-", relativo],
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        destino = subprocess.Popen(["rtk", "proxy", "docker", "exec", "-i", nome, "tar", "-xf", "-", "-C", "/tmp/s165-src"],
                                   stdin=origem.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        origem.kill()
        origem.wait()
        raise
    origem.stdout.close()
    encerrado = threading.Event()
    def vigiar():
        while not encerrado.wait(.2):
            if watchdog.is_set():
                for processo in (origem, destino):
                    try: processo.kill()
                    except ProcessLookupError: pass
                return
    vigia = threading.Thread(target=vigiar, daemon=True)
    vigia.start()
    try:
        retorno_destino = destino.wait(timeout=300)
        retorno_origem = origem.wait(timeout=30)
        if retorno_destino or retorno_origem or watchdog.is_set(): raise RuntimeError("Cópia UI S170 falhou")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo de cópia UI S170 excedido") from None
    finally:
        for processo in (origem, destino):
            if processo.poll() is None:
                processo.kill()
                processo.wait()
        encerrado.set()
        vigia.join(timeout=2)


def executar(root, docker, docker_monitor, inspect, ident, rede, nome, anon, credenciais, proxy, watchdog, trava_watchdog, containers_monitorados):
    def comando(args, **kwargs):
        return _comando(args, watchdog=watchdog, **kwargs)
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident or nome != rede + "-s170-browser":
        raise RuntimeError("Identidade UI S170 inválida")
    net = inspect("network", rede)
    if not net.get("Internal") or net.get("Ingress") or net.get("Driver") != "bridge" or net.get("Labels", {}).get("sso.recorte") != ident:
        raise RuntimeError("Rede UI S170 não atestada")
    hosts = []
    for papel in ("auth", "rest"):
        alvo = rede + "-" + papel
        servico = inspect("container", alvo)
        if (servico["Name"] != "/" + alvo or servico["Config"].get("Labels", {}).get("sso.recorte") != ident
            or not servico["State"].get("Running") or servico["HostConfig"].get("Privileged")
            or set(servico["NetworkSettings"]["Networks"]) != {rede}
            or any(servico["NetworkSettings"].get("Ports", {}).values()) or servico.get("Mounts")):
            raise RuntimeError("Destino UI S170 não atestado")
        try:
            ip = ipaddress.IPv4Address(servico["NetworkSettings"]["Networks"][rede]["IPAddress"])
            subredes = [ipaddress.ip_network(x["Subnet"]) for x in net["IPAM"]["Config"] if ":" not in x["Subnet"]]
            if not any(ip in subrede for subrede in subredes): raise ValueError("endereço fora da rede")
        except (KeyError, ValueError): raise RuntimeError("Endereço interno S170 inválido") from None
        hosts.extend(["--add-host", alvo + ":" + str(ip)])
    imagem = json.loads(docker("image", "inspect", IMAGE))[0]
    if DIGEST not in (imagem.get("RepoDigests") or []) or imagem["Config"].get("Volumes"):
        raise RuntimeError("Imagem UI S170 não atestada")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S170")
    # Só empacota HEAD limpo e fontes rastreadas; nunca lê .env nem arquivos ignorados.
    git = ["rtk", "proxy", "git", "-C", str(root)]
    if comando(git + ["status", "--porcelain", "--untracked-files=all"], timeout=30).strip():
        raise RuntimeError("UI S170 exige checkout confirmado e limpo")
    sha = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha) or comando(git + ["rev-parse", "HEAD"], timeout=30).decode().strip() != sha:
        raise RuntimeError("Commit UI S170 divergente do runner")
    rastreados = comando(git + ["ls-files", "-z", "apps/web", "packages"], timeout=30).split(b"\0")
    if any(re.search(rb"(?:^|/)\.env(?:\.|$)|(?:^|/)\.npmrc$", p) for p in rastreados if p):
        raise RuntimeError("Fonte UI S170 contém configuração de ambiente")
    deps = root / "node_modules"
    web_deps = root / "apps/web/node_modules"
    if deps.is_symlink() or (deps / ".pnpm").is_symlink() or not (deps / ".pnpm").is_dir() or web_deps.is_symlink() or not web_deps.is_dir():
        raise RuntimeError("Dependências UI S170 não pertencem ao checkout")
    pacotes = [root / "packages" / nome / "node_modules" for nome in ("ui", "shared", "portal-core")]
    if any(p.is_symlink() or not p.is_dir() for p in pacotes):
        raise RuntimeError("Dependências dos pacotes UI S170 indisponíveis")
    for diretorio in (deps, web_deps, *pacotes):
        for atual, dirs, arquivos in os.walk(diretorio, followlinks=False):
            if watchdog.is_set(): raise RuntimeError("Monitor interrompeu inspeção UI S170")
            for item in dirs + arquivos:
                caminho = Path(atual) / item
                if caminho.is_symlink() and not caminho.resolve().is_relative_to(root.resolve()):
                    raise RuntimeError("Dependência UI S170 aponta fora do checkout")
    arquivo = comando(git + ["archive", "--format=tar", sha, "apps/web", "packages", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"], timeout=90)
    with trava_watchdog:
        if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S170")
        docker("create", "--name", nome, "--network", rede, "--label", "sso.recorte=" + ident,
               "--dns", "127.0.0.1", *hosts, "--user", "pwuser", "--cap-drop", "ALL",
               "--security-opt", "no-new-privileges", IMAGE, "sleep", "infinity")
        c = inspect("container", nome)
        if (c["Image"] != imagem["Id"] or c["Config"].get("Labels", {}).get("sso.recorte") != ident
            or c["HostConfig"].get("NetworkMode") != rede or c["HostConfig"].get("Privileged")
            or c.get("Mounts") or c["HostConfig"].get("PortBindings")
            or c["HostConfig"].get("Dns") != ["127.0.0.1"]
            or "ALL" not in (c["HostConfig"].get("CapDrop") or [])
            or not any(x.startswith("no-new-privileges") for x in (c["HostConfig"].get("SecurityOpt") or []))):
            raise RuntimeError("Container UI S170 fora do clone")
        containers_monitorados[nome] = c["Id"]
        docker_monitor("start", nome)
    c = inspect("container", nome)
    if set(c["NetworkSettings"]["Networks"]) != {rede} or any(c["NetworkSettings"].get("Ports", {}).values()) or c.get("Mounts"):
        raise RuntimeError("Container UI S170 iniciado fora da rede")
    prefixo = ["rtk", "proxy", "docker", "exec"]
    # Endereços de documentação não pertencem a serviços reais; uma conexão aceita é falha.
    prova_rede = """const net=require('node:net');const http=require('node:http');
const id=process.argv[1];
function bloqueado(host,port){return new Promise((resolve,reject)=>{const s=net.connect({host,port});s.setTimeout(2000);s.on('connect',()=>{s.destroy();reject(Error('egress'));});s.on('error',()=>resolve());s.on('timeout',()=>{s.destroy();resolve();});});}
function interno(papel,port,path){return new Promise((resolve,reject)=>{const r=http.get({hostname:`sso-recorte-${id}-${papel}`,port,path,timeout:3000},x=>{x.resume();resolve();});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('tempo')));});}
Promise.all([bloqueado('198.51.100.1',443),bloqueado('2001:db8::1',443),interno('auth',9999,'/health'),interno('rest',3000,'/')]).then(()=>process.stdout.write('ok')).catch(()=>process.exit(1));"""
    if comando(prefixo + [nome, "node", "-e", prova_rede, ident], timeout=10).decode().strip() != "ok":
        raise RuntimeError("Teste de rede UI S170 inconclusivo")
    comando(prefixo + [nome, "mkdir", "-p", "/tmp/s165-src", "/tmp/s165-dist", "/tmp/s165-home"])
    comando(prefixo + ["-i", nome, "tar", "-xf", "-", "-C", "/tmp/s165-src"], data=arquivo)
    _copiar_arvore(root, "node_modules", nome, watchdog)
    _copiar_arvore(root, "apps/web/node_modules", nome, watchdog)
    for pacote in ("ui", "shared", "portal-core"):
        _copiar_arvore(root, "packages/" + pacote + "/node_modules", nome, watchdog)
    comando(prefixo + ["-i", nome, "sh", "-c", "cat > /tmp/s165-proxy.cjs"], data=proxy)
    env = ["--env", "HOME=/tmp/s165-home", "--env", "CI=1", "--env", "VITE_SUPABASE_URL=http://127.0.0.1:5189", "--env", "VITE_SUPABASE_ANON_KEY=" + anon]
    env += ["--env", "VITE_SSO_CLASSIFICAR_RETORNO_ENABLED=true", "--env", "VITE_SSO_CONFERENCIA_COBERTURA_ENABLED=true", "--env", "VITE_SSO_REATESTACAO_COBERTURA_ENABLED=true", "--env", "VITE_SSO_DECISOES_RETORNO_ENABLED=true", "--env", "VITE_SSO_CONDICAO_ESTRUTURAL_RETORNO_ENABLED=true", "--env", "VITE_SSO_CONDICAO_EVIDENCIA_RETORNO_ENABLED=true", "--env", "VITE_SSO_APROVAR_RETORNO_PCM_ENABLED=true"]
    comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/vite", "build", "--outDir", "/tmp/s165-dist", "--emptyOutDir"], timeout=300)
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu build UI S170")
    docker("exec", "-d", "--env", "SSO_RECORTE_ID=" + ident, nome, "node", "/tmp/s165-proxy.cjs")
    env += ["--env", "SSO_RECORTE_ID=" + ident, "--env", "SSO_S170_FIXTURE_OBRIGATORIA=1",
            "--env", "SSO_S170_APP_URL=http://127.0.0.1:5189", "--env", "SSO_S170_SUPABASE_URL=http://127.0.0.1:5189",
            "--env", "SSO_S170_DB_URL=postgresql://" + rede + "-db/postgres", "--env", "SSO_S170_ANON_KEY=" + anon,
            "--env", "SSO_S170_EMAIL=" + credenciais["email"], "--env", "SSO_S170_SENHA=" + credenciais["senha"],
            "--env", "SSO_S170_ADMIN_EMAIL=" + credenciais["adminEmail"], "--env", "SSO_S170_ADMIN_SENHA=" + credenciais["adminSenha"],
            "--env", "SSO_S170_CLIENTE_A=" + credenciais["clienteA"], "--env", "SSO_S170_CLIENTE_B=" + credenciais["clienteB"],
            "--env", "SSO_S170_RETORNO_PATH=/", "--env", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright"]
    saida = comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/playwright", "test", "--config", "playwright.s170-isolado.config.ts", "--reporter=json"], timeout=180)
    try: stats = json.loads(saida)["stats"]
    except (ValueError, KeyError, TypeError): raise RuntimeError("Relatório UI S170 inválido") from None
    if stats.get("expected") != 2 or stats.get("unexpected") != 0 or stats.get("skipped") != 0 or watchdog.is_set():
        raise RuntimeError("Cenário UI S170 não comprovado")
    print("UI S170: jornadas sintéticas de retorno e concessão/revogação concluídas no clone.", flush=True)
