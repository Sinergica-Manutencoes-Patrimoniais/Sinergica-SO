"""Rascunho do bootstrap UI S176. Só opera dentro do clone já atestado.

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
        raise RuntimeError("Proxy S176 divergente")
    for caminho, digest in (
        ("apps/web/e2e/estrutura-tecnica.spec.ts", "6a3f16a77df192430df11ddd1add2412df39d9ce7dcacd8f4f7b91e7f702ff12"),
        ("apps/web/playwright.s176-isolado.config.ts", "0766d6f4ed9a73321f82df9baf9e0a120482f6b9b58c794911224f59e1104287"),
    ):
        if hashlib.sha256((root / caminho).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Teste UI S176 divergente")
    return proxy


def _comando(args, *, data=None, timeout=180, watchdog=None):
    if watchdog is not None and watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S176")
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
        raise RuntimeError("Prazo do bootstrap UI S176 excedido") from None
    finally:
        encerrado.set()
        vigia.join(timeout=2)
    if processo.returncode or (watchdog is not None and watchdog.is_set()):
        if any("playwright" in str(arg) for arg in args): etapa = "jornada Playwright"
        elif any("vite" in str(arg) for arg in args): etapa = "build do app"
        elif any(str(arg) == "tar" for arg in args): etapa = "cópia do checkout"
        elif any(str(arg) == "node" for arg in args): etapa = "proxy ou teste de rede"
        elif any(str(arg) == "mkdir" for arg in args): etapa = "preparo de diretórios"
        else: etapa = "serviço auxiliar"
        detalhe = _resumo_playwright(saida) if etapa == "jornada Playwright" else ""
        raise RuntimeError("Bootstrap UI S176 falhou na etapa " + etapa + ("; " + detalhe if detalhe else ""))
    return saida


def _resumo_playwright(saida):
    """Exibe apenas contagens e títulos dos testes fixos; nunca erros ou valores."""
    try:
        relatorio = json.loads(saida)
        stats = relatorio.get("stats", {})
        falhas = []
        def visitar(suites):
            for suite in suites or []:
                for spec in suite.get("specs", []):
                    testes = spec.get("tests", [])
                    if any(resultado.get("status") in {"failed", "timedOut", "interrupted"}
                           for teste in testes for resultado in teste.get("results", [])):
                        titulo = str(spec.get("title", "teste sem título"))
                        resultado_falha = next((resultado for teste in testes for resultado in teste.get("results", [])
                                                if resultado.get("status") in {"failed", "timedOut", "interrupted"}), {})
                        local = resultado_falha.get("error", {}).get("location", {})
                        mensagem = resultado_falha.get("error", {}).get("message", "")
                        etapas = []
                        for item in resultado_falha.get("stdout", []):
                            texto = item.get("text", "") if isinstance(item, dict) else str(item)
                            etapas.extend(re.findall(r"S176_ETAPA=([^\r\n]{1,80})", texto))
                        linhas = [" ".join(linha.split()) for linha in str(mensagem).splitlines()[:3] if linha.strip()]
                        detalhe = " | ".join(re.sub(r"https?://[^\s\"'<>]+", "<url>", re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "<email>", linha)) for linha in linhas)[:240]
                        detalhe = re.sub(r"(?i)(password|senha|token|authorization|anon[_ -]?key)(?:\s*[:=]\s*)\S+", r"\1=<redacted>", detalhe)
                        detalhe = re.sub(r"\b[0-9a-f]{8}-[0-9a-f-]{27,}\b", "<id>", detalhe, flags=re.I)
                        arquivo = str(local.get("file", "")).split("/")[-1]
                        linha = local.get("line", "?")
                        falhas.append("".join(c for c in titulo if c.isalnum() or c in " _-.")[:100]
                                      + (" (" + arquivo + ":" + str(linha) + ")" if arquivo else "")
                                      + ("; última etapa: " + etapas[-1] if etapas else "")
                                      + (" — " + detalhe if detalhe else ""))
                visitar(suite.get("suites", []))
        visitar(relatorio.get("suites", []))
        contagens = "expected=" + str(stats.get("expected", "?")) + ", unexpected=" + str(stats.get("unexpected", "?"))
        return "Playwright " + contagens + ("; cenários com falha: " + ", ".join(falhas[:5]) if falhas else "")
    except (ValueError, TypeError, AttributeError):
        return "Playwright retornou relatório inválido"


def _copiar_arvore(root, relativo, nome, watchdog):
    """Transmite tar sem seguir symlinks; extração como usuário não privilegiado."""
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu cópia UI S176")
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
        if retorno_destino or retorno_origem or watchdog.is_set(): raise RuntimeError("Cópia UI S176 falhou")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo de cópia UI S176 excedido") from None
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
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident or nome != rede + "-s176-browser":
        raise RuntimeError("Identidade UI S176 inválida")
    net = inspect("network", rede)
    if not net.get("Internal") or net.get("Ingress") or net.get("Driver") != "bridge" or net.get("Labels", {}).get("sso.recorte") != ident:
        raise RuntimeError("Rede UI S176 não atestada")
    hosts = []
    for papel in ("auth", "rest"):
        alvo = rede + "-" + papel
        servico = inspect("container", alvo)
        if (servico["Name"] != "/" + alvo or servico["Config"].get("Labels", {}).get("sso.recorte") != ident
            or not servico["State"].get("Running") or servico["HostConfig"].get("Privileged")
            or set(servico["NetworkSettings"]["Networks"]) != {rede}
            or any(servico["NetworkSettings"].get("Ports", {}).values()) or servico.get("Mounts")):
            raise RuntimeError("Destino UI S176 não atestado")
        try:
            ip = ipaddress.IPv4Address(servico["NetworkSettings"]["Networks"][rede]["IPAddress"])
            subredes = [ipaddress.ip_network(x["Subnet"]) for x in net["IPAM"]["Config"] if ":" not in x["Subnet"]]
            if not any(ip in subrede for subrede in subredes): raise ValueError("endereço fora da rede")
        except (KeyError, ValueError): raise RuntimeError("Endereço interno S176 inválido") from None
        hosts.extend(["--add-host", alvo + ":" + str(ip)])
    imagem = json.loads(docker("image", "inspect", IMAGE))[0]
    if DIGEST not in (imagem.get("RepoDigests") or []) or imagem["Config"].get("Volumes"):
        raise RuntimeError("Imagem UI S176 não atestada")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S176")
    # Só empacota HEAD limpo e fontes rastreadas; nunca lê .env nem arquivos ignorados.
    git = ["rtk", "proxy", "git", "-C", str(root)]
    if comando(git + ["status", "--porcelain", "--untracked-files=all"], timeout=30).strip():
        raise RuntimeError("UI S176 exige checkout confirmado e limpo")
    sha = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha) or comando(git + ["rev-parse", "HEAD"], timeout=30).decode().strip() != sha:
        raise RuntimeError("Commit UI S176 divergente do runner")
    rastreados = comando(git + ["ls-files", "-z", "apps/web", "packages"], timeout=30).split(b"\0")
    if any(re.search(rb"(?:^|/)\.env(?:\.|$)|(?:^|/)\.npmrc$", p) for p in rastreados if p):
        raise RuntimeError("Fonte UI S176 contém configuração de ambiente")
    deps = root / "node_modules"
    web_deps = root / "apps/web/node_modules"
    if deps.is_symlink() or (deps / ".pnpm").is_symlink() or not (deps / ".pnpm").is_dir() or web_deps.is_symlink() or not web_deps.is_dir():
        raise RuntimeError("Dependências UI S176 não pertencem ao checkout")
    pacotes = [root / "packages" / nome / "node_modules" for nome in ("ui", "shared", "portal-core")]
    if any(p.is_symlink() or not p.is_dir() for p in pacotes):
        raise RuntimeError("Dependências dos pacotes UI S176 indisponíveis")
    for diretorio in (deps, web_deps, *pacotes):
        for atual, dirs, arquivos in os.walk(diretorio, followlinks=False):
            if watchdog.is_set(): raise RuntimeError("Monitor interrompeu inspeção UI S176")
            for item in dirs + arquivos:
                caminho = Path(atual) / item
                if caminho.is_symlink() and not caminho.resolve().is_relative_to(root.resolve()):
                    raise RuntimeError("Dependência UI S176 aponta fora do checkout")
    arquivo = comando(git + ["archive", "--format=tar", sha, "apps/web", "packages", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"], timeout=90)
    with trava_watchdog:
        if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S176")
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
            raise RuntimeError("Container UI S176 fora do clone")
        containers_monitorados[nome] = c["Id"]
        docker_monitor("start", nome)
    c = inspect("container", nome)
    if set(c["NetworkSettings"]["Networks"]) != {rede} or any(c["NetworkSettings"].get("Ports", {}).values()) or c.get("Mounts"):
        raise RuntimeError("Container UI S176 iniciado fora da rede")
    prefixo = ["rtk", "proxy", "docker", "exec"]
    # Endereços de documentação não pertencem a serviços reais; uma conexão aceita é falha.
    prova_rede = """const net=require('node:net');const http=require('node:http');
const id=process.argv[1];
function bloqueado(host,port){return new Promise((resolve,reject)=>{const s=net.connect({host,port});s.setTimeout(2000);s.on('connect',()=>{s.destroy();reject(Error('egress'));});s.on('error',()=>resolve());s.on('timeout',()=>{s.destroy();resolve();});});}
function interno(papel,port,path){return new Promise((resolve,reject)=>{const r=http.get({hostname:`sso-recorte-${id}-${papel}`,port,path,timeout:3000},x=>{x.resume();resolve();});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('tempo')));});}
Promise.all([bloqueado('198.51.100.1',443),bloqueado('2001:db8::1',443),interno('auth',9999,'/health'),interno('rest',3000,'/')]).then(()=>process.stdout.write('ok')).catch(()=>process.exit(1));"""
    if comando(prefixo + [nome, "node", "-e", prova_rede, ident], timeout=10).decode().strip() != "ok":
        raise RuntimeError("Teste de rede UI S176 inconclusivo")
    comando(prefixo + [nome, "mkdir", "-p", "/tmp/s165-src", "/tmp/s165-dist", "/tmp/s165-home"])
    comando(prefixo + ["-i", nome, "tar", "-xf", "-", "-C", "/tmp/s165-src"], data=arquivo)
    _copiar_arvore(root, "node_modules", nome, watchdog)
    _copiar_arvore(root, "apps/web/node_modules", nome, watchdog)
    for pacote in ("ui", "shared", "portal-core"):
        _copiar_arvore(root, "packages/" + pacote + "/node_modules", nome, watchdog)
    comando(prefixo + ["-i", nome, "sh", "-c", "cat > /tmp/s165-proxy.cjs"], data=proxy)
    env = ["--env", "HOME=/tmp/s165-home", "--env", "CI=1", "--env", "VITE_SUPABASE_URL=http://127.0.0.1:5189", "--env", "VITE_SUPABASE_ANON_KEY=" + anon,
           "--env", "VITE_SSO_SISTEMAS_DISTRIBUIDOS_ENABLED=true", "--env", "VITE_SSO_PLANOS_POR_ALVO_ENABLED=true"]
    comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/vite", "build", "--outDir", "/tmp/s165-dist", "--emptyOutDir"], timeout=300)
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu build UI S176")
    docker("exec", "-d", "--env", "SSO_RECORTE_ID=" + ident, nome, "node", "/tmp/s165-proxy.cjs")
    prova = json.dumps({"id": ident, "rede": rede, "app": "http://127.0.0.1:5189", "api": "http://127.0.0.1:5189"}).encode()
    comando(prefixo + ["-i", nome, "sh", "-c", "umask 077; cat > /tmp/s176-attestation.json"], data=prova)
    env += ["--env", "SSO_RECORTE_ID=" + ident, "--env", "SSO_S176_E2E_ISOLADO=true",
            "--env", "SSO_S176_ATTESTATION=/tmp/s176-attestation.json", "--env", "SSO_S176_APP_URL=http://127.0.0.1:5189",
            "--env", "SSO_S176_SUPABASE_URL=http://127.0.0.1:5189", "--env", "SSO_S176_EMAIL=" + credenciais["email"],
            "--env", "SSO_S176_SENHA=" + credenciais["senha"], "--env", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright"]
    saida = comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/playwright", "test", "--config", "playwright.s176-isolado.config.ts", "--reporter=json"], timeout=180)
    try: stats = json.loads(saida)["stats"]
    except (ValueError, KeyError, TypeError): raise RuntimeError("Relatório UI S176 inválido") from None
    if stats.get("expected") != 1 or stats.get("unexpected") != 0 or stats.get("skipped") != 0 or watchdog.is_set():
        raise RuntimeError("Cenário UI S176 não comprovado")
    print("UI S176: jornada sintética de estrutura no clone.", flush=True)
