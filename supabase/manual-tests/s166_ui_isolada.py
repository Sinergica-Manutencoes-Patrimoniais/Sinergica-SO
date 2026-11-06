"""Bootstrap UI S166. Só opera dentro do clone já atestado.

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
        raise RuntimeError("Proxy S166 divergente")
    for caminho, digest in (
        ("apps/web/e2e/calendario-contratual.spec.ts", "54b4fa47cafa2fa22f89fda26b0861b551b3b3cd20683a6e62dc8b12d68721d1"),
        ("apps/web/playwright.s166-isolado.config.ts", "797b227714116086ba3ee45ceed84dbb28bb07aa6823633dd72bf3e93a2f5fa0"),
    ):
        if hashlib.sha256((root / caminho).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Teste UI S166 divergente: " + caminho)
    return proxy


def _comando(args, *, data=None, timeout=180, watchdog=None):
    if watchdog is not None and watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S166")
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
        raise RuntimeError("Prazo do bootstrap UI S166 excedido") from None
    finally:
        encerrado.set()
        vigia.join(timeout=2)
    if processo.returncode or (watchdog is not None and watchdog.is_set()):
        etapa = "jornada Playwright" if any("playwright" in str(arg) for arg in args) else "build do app" if any("vite" in str(arg) for arg in args) else "outra etapa"
        detalhe = _resumo_playwright(saida) if etapa == "jornada Playwright" else ""
        raise RuntimeError("Bootstrap UI S166 falhou na etapa " + etapa + ("; " + detalhe if detalhe else ""))
    return saida


def _resumo_playwright(saida):
    """Exibe contagens e localização do teste fixo; nunca erros ou valores."""
    try:
        relatorio = json.loads(saida)
        stats = relatorio.get("stats", {})
        falhas = []
        def visitar(suites):
            for suite in suites or []:
                for spec in suite.get("specs", []):
                    testes = spec.get("tests", [])
                    resultados = [resultado for teste in testes for resultado in teste.get("results", [])
                                  if resultado.get("status") in {"failed", "timedOut", "interrupted"}]
                    if resultados:
                        local = resultados[0].get("error", {}).get("location", {})
                        mensagem = resultados[0].get("error", {}).get("message", "")
                        anotacoes = [anotacao for teste in testes
                                     for anotacao in teste.get("annotations", []) + resultados[0].get("annotations", [])
                                     if anotacao.get("type") in {"s166-etapa", "s166-rpc"}]
                        diagnostico = "; ".join(f"{anotacao.get('type')}={anotacao.get('description', '')}" for anotacao in anotacoes)
                        linhas = [" ".join(linha.split()) for linha in str(mensagem).splitlines()[:3] if linha.strip()]
                        detalhe = " | ".join(re.sub(r"https?://[^\s\"'<>]+", "<url>", re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "<email>", linha)) for linha in linhas)[:240]
                        detalhe = re.sub(r"(?i)(password|senha|token|authorization|anon[_ -]?key)(?:\s*[:=]\s*)\S+", r"\1=<redacted>", detalhe)
                        detalhe = re.sub(r"\b[0-9a-f]{8}-[0-9a-f-]{27,}\b", "<id>", detalhe, flags=re.I)
                        arquivo = str(local.get("file", "")).split("/")[-1]
                        titulo = "".join(c for c in str(spec.get("title", "teste")) if c.isalnum() or c in " _-.")[:100]
                        falhas.append(titulo + (" (" + arquivo + ":" + str(local.get("line", "?")) + ")" if arquivo else "") + (" [" + diagnostico + "]" if diagnostico else "") + (" — " + detalhe if detalhe else ""))
                visitar(suite.get("suites", []))
        visitar(relatorio.get("suites", []))
        return "Playwright expected=" + str(stats.get("expected", "?")) + ", unexpected=" + str(stats.get("unexpected", "?")) + ("; falhas: " + ", ".join(falhas[:5]) if falhas else "")
    except (ValueError, TypeError, AttributeError):
        return "Playwright retornou relatório inválido"


def _copiar_arvore(root, relativo, nome, watchdog):
    """Transmite tar sem seguir symlinks; extração como usuário não privilegiado."""
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu cópia UI S166")
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
        if retorno_destino or retorno_origem or watchdog.is_set(): raise RuntimeError("Cópia UI S166 falhou")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo de cópia UI S166 excedido") from None
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
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident or nome != rede + "-s166-browser":
        raise RuntimeError("Identidade UI S166 inválida")
    net = inspect("network", rede)
    if not net.get("Internal") or net.get("Ingress") or net.get("Driver") != "bridge" or net.get("Labels", {}).get("sso.recorte") != ident:
        raise RuntimeError("Rede UI S166 não atestada")
    hosts = []
    for papel in ("auth", "rest"):
        alvo = rede + "-" + papel
        servico = inspect("container", alvo)
        if (servico["Name"] != "/" + alvo or servico["Config"].get("Labels", {}).get("sso.recorte") != ident
            or not servico["State"].get("Running") or servico["HostConfig"].get("Privileged")
            or set(servico["NetworkSettings"]["Networks"]) != {rede}
            or any(servico["NetworkSettings"].get("Ports", {}).values()) or servico.get("Mounts")):
            raise RuntimeError("Destino UI S166 não atestado")
        try:
            ip = ipaddress.IPv4Address(servico["NetworkSettings"]["Networks"][rede]["IPAddress"])
            subredes = [ipaddress.ip_network(x["Subnet"]) for x in net["IPAM"]["Config"] if ":" not in x["Subnet"]]
            if not any(ip in subrede for subrede in subredes): raise ValueError("endereço fora da rede")
        except (KeyError, ValueError): raise RuntimeError("Endereço interno S166 inválido") from None
        hosts.extend(["--add-host", alvo + ":" + str(ip)])
    imagem = json.loads(docker("image", "inspect", IMAGE))[0]
    if DIGEST not in (imagem.get("RepoDigests") or []) or imagem["Config"].get("Volumes"):
        raise RuntimeError("Imagem UI S166 não atestada")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S166")
    # Só empacota HEAD limpo e fontes rastreadas; nunca lê .env nem arquivos ignorados.
    git = ["rtk", "proxy", "git", "-C", str(root)]
    if comando(git + ["status", "--porcelain", "--untracked-files=all"], timeout=30).strip():
        raise RuntimeError("UI S166 exige checkout confirmado e limpo")
    sha = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", sha) or comando(git + ["rev-parse", "HEAD"], timeout=30).decode().strip() != sha:
        raise RuntimeError("Commit UI S166 divergente do runner")
    rastreados = comando(git + ["ls-files", "-z", "apps/web", "packages"], timeout=30).split(b"\0")
    if any(re.search(rb"(?:^|/)\.env(?:\.|$)|(?:^|/)\.npmrc$", p) for p in rastreados if p):
        raise RuntimeError("Fonte UI S166 contém configuração de ambiente")
    deps = root / "node_modules"
    web_deps = root / "apps/web/node_modules"
    if deps.is_symlink() or (deps / ".pnpm").is_symlink() or not (deps / ".pnpm").is_dir() or web_deps.is_symlink() or not web_deps.is_dir():
        raise RuntimeError("Dependências UI S166 não pertencem ao checkout")
    pacotes = [root / "packages" / nome / "node_modules" for nome in ("ui", "shared", "portal-core")]
    if any(p.is_symlink() or not p.is_dir() for p in pacotes):
        raise RuntimeError("Dependências dos pacotes UI S166 indisponíveis")
    for diretorio in (deps, web_deps, *pacotes):
        for atual, dirs, arquivos in os.walk(diretorio, followlinks=False):
            if watchdog.is_set(): raise RuntimeError("Monitor interrompeu inspeção UI S166")
            for item in dirs + arquivos:
                caminho = Path(atual) / item
                if caminho.is_symlink() and not caminho.resolve().is_relative_to(root.resolve()):
                    raise RuntimeError("Dependência UI S166 aponta fora do checkout")
    arquivo = comando(git + ["archive", "--format=tar", sha, "apps/web", "packages", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"], timeout=90)
    with trava_watchdog:
        if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S166")
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
            raise RuntimeError("Container UI S166 fora do clone")
        containers_monitorados[nome] = c["Id"]
        docker_monitor("start", nome)
    c = inspect("container", nome)
    if set(c["NetworkSettings"]["Networks"]) != {rede} or any(c["NetworkSettings"].get("Ports", {}).values()) or c.get("Mounts"):
        raise RuntimeError("Container UI S166 iniciado fora da rede")
    prefixo = ["rtk", "proxy", "docker", "exec"]
    # Endereços de documentação não pertencem a serviços reais; uma conexão aceita é falha.
    prova_rede = """const net=require('node:net');const http=require('node:http');
const id=process.argv[1];
function bloqueado(host,port){return new Promise((resolve,reject)=>{const s=net.connect({host,port});s.setTimeout(2000);s.on('connect',()=>{s.destroy();reject(Error('egress'));});s.on('error',()=>resolve());s.on('timeout',()=>{s.destroy();resolve();});});}
function interno(papel,port,path){return new Promise((resolve,reject)=>{const r=http.get({hostname:`sso-recorte-${id}-${papel}`,port,path,timeout:3000},x=>{x.resume();resolve();});r.on('error',reject);r.on('timeout',()=>r.destroy(Error('tempo')));});}
Promise.all([bloqueado('198.51.100.1',443),bloqueado('2001:db8::1',443),interno('auth',9999,'/health'),interno('rest',3000,'/')]).then(()=>process.stdout.write('ok')).catch(()=>process.exit(1));"""
    if comando(prefixo + [nome, "node", "-e", prova_rede, ident], timeout=10).decode().strip() != "ok":
        raise RuntimeError("Teste de rede UI S166 inconclusivo")
    comando(prefixo + [nome, "mkdir", "-p", "/tmp/s165-src", "/tmp/s165-dist", "/tmp/s165-home"])
    comando(prefixo + ["-i", nome, "tar", "-xf", "-", "-C", "/tmp/s165-src"], data=arquivo)
    _copiar_arvore(root, "node_modules", nome, watchdog)
    _copiar_arvore(root, "apps/web/node_modules", nome, watchdog)
    for pacote in ("ui", "shared", "portal-core"):
        _copiar_arvore(root, "packages/" + pacote + "/node_modules", nome, watchdog)
    comando(prefixo + ["-i", nome, "sh", "-c", "cat > /tmp/s165-proxy.cjs"], data=proxy)
    env = ["--env", "HOME=/tmp/s165-home", "--env", "CI=1", "--env", "VITE_SUPABASE_URL=http://127.0.0.1:5189", "--env", "VITE_SUPABASE_ANON_KEY=" + anon]
    env += ["--env", "VITE_SSO_ALTERAR_DIA_CONTRATUAL_ENABLED=true", "--env", "VITE_SSO_MUDANCA_DIA_ATOMICA_ENABLED=true", "--env", "VITE_SSO_MUDANCA_DIA_V2_UI_ENABLED=true", "--env", "VITE_SSO_MUDANCA_DIA_V2_ENABLED=true"]
    comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/vite", "build", "--outDir", "/tmp/s165-dist", "--emptyOutDir"], timeout=300)
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu build UI S166")
    docker("exec", "-d", "--env", "SSO_RECORTE_ID=" + ident, nome, "node", "/tmp/s165-proxy.cjs")
    env += ["--env", "SSO_RECORTE_ID=" + ident, "--env", "SSO_S166_E2E_ISOLADO=true",
            "--env", "SSO_S166_APP_URL=http://127.0.0.1:5189", "--env", "SSO_S166_SUPABASE_URL=http://127.0.0.1:5189",
            "--env", "S166_SUPABASE_URL=http://127.0.0.1:5189", "--env", "S166_SUPABASE_ANON_KEY=" + anon,
            "--env", "VITE_SUPABASE_URL=http://127.0.0.1:5189", "--env", "SSO_S166_ANON_KEY=" + anon,
            "--env", "SSO_S166_EMAIL_A=" + credenciais["emailA"], "--env", "SSO_S166_EMAIL_B=" + credenciais["emailB"],
            "--env", "SSO_S166_SENHA_A=" + credenciais["senha"], "--env", "SSO_S166_SENHA_B=" + credenciais["senha"],
            "--env", "SSO_S166_CLIENTE_A=" + credenciais["clienteA"], "--env", "SSO_S166_CLIENTE_B=" + credenciais["clienteB"],
            "--env", "SSO_S166_CONTRATO_ID=" + credenciais["contrato"], "--env", "SSO_S166_DIA_NOVO=" + credenciais["diaNovo"],
            "--env", "SSO_S166_VIGENCIA=" + credenciais["vigencia"], "--env", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright"]
    saida = comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/playwright", "test", "--config", "playwright.s166-isolado.config.ts", "--reporter=json"], timeout=360)
    try: stats = json.loads(saida)["stats"]
    except (ValueError, KeyError, TypeError): raise RuntimeError("Relatório UI S166 inválido") from None
    if stats.get("expected") != 2 or stats.get("unexpected") != 0 or stats.get("skipped") != 0 or watchdog.is_set():
        raise RuntimeError("Cenário UI S166 não comprovado")
    print("UI S166: jornada 501 Visitas e acesso negado concluída no clone.", flush=True)
