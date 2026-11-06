"""Rascunho do bootstrap UI S165. Só opera dentro do clone já atestado.

O chamador é responsável por watchdog, remoção do contêiner e rede. Ainda não
prepara revisão, impactos ou histórico. Não utilizar para qualquer destino real.
"""
import hashlib
import ipaddress
import json
import os
import re
import subprocess
from pathlib import Path

IMAGE = "mcr.microsoft.com/playwright:v1.61.1-noble"
DIGEST = "mcr.microsoft.com/playwright@sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48"
PROXY = "apps/web/e2e/s165-isolado/proxy.cjs"


def preparar(root, esperado):
    proxy = (root / PROXY).read_bytes()
    if hashlib.sha256(proxy).hexdigest() != esperado:
        raise RuntimeError("Proxy S165 divergente")
    for caminho, digest in (
        ("apps/web/e2e/plano-manutencao.spec.ts", "9e2844418e7415dec2a99d108ee96fe619ace9667a2dc150d20f35a1952f8746"),
        ("apps/web/playwright.s165-isolado.config.ts", "1fc8a28a50339108f75f1891dd1a10afef055567301546a1d6c7ab18f147eef3"),
    ):
        if hashlib.sha256((root / caminho).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Teste UI S165 divergente")
    return proxy


def _comando(args, *, data=None, timeout=180):
    try:
        p = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo do bootstrap UI S165 excedido") from None
    if p.returncode:
        raise RuntimeError("Bootstrap UI S165 falhou")
    return p.stdout


def executar(root, docker, inspect, ident, rede, nome, anon, credenciais, proxy, watchdog):
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident or nome != rede + "-s165-browser":
        raise RuntimeError("Identidade UI S165 inválida")
    net = inspect("network", rede)
    if not net.get("Internal") or net.get("Ingress") or net.get("Driver") != "bridge" or net.get("Labels", {}).get("sso.recorte") != ident:
        raise RuntimeError("Rede UI S165 não atestada")
    hosts = []
    for papel in ("auth", "rest"):
        alvo = rede + "-" + papel
        servico = inspect("container", alvo)
        if (servico["Name"] != "/" + alvo or servico["Config"].get("Labels", {}).get("sso.recorte") != ident
            or not servico["State"].get("Running") or servico["HostConfig"].get("Privileged")
            or set(servico["NetworkSettings"]["Networks"]) != {rede}
            or any(servico["NetworkSettings"].get("Ports", {}).values()) or servico.get("Mounts")):
            raise RuntimeError("Destino UI S165 não atestado")
        try:
            ip = ipaddress.IPv4Address(servico["NetworkSettings"]["Networks"][rede]["IPAddress"])
            subredes = [ipaddress.ip_network(x["Subnet"]) for x in net["IPAM"]["Config"] if ":" not in x["Subnet"]]
            if not any(ip in subrede for subrede in subredes): raise ValueError("endereço fora da rede")
        except (KeyError, ValueError): raise RuntimeError("Endereço interno S165 inválido") from None
        hosts.extend(["--add-host", alvo + ":" + str(ip)])
    imagem = json.loads(docker("image", "inspect", IMAGE))[0]
    if DIGEST not in (imagem.get("RepoDigests") or []) or imagem["Config"].get("Volumes"):
        raise RuntimeError("Imagem UI S165 não atestada")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu UI S165")
    # Só empacota HEAD limpo e fontes rastreadas; nunca lê .env nem arquivos ignorados.
    git = ["rtk", "proxy", "git", "-C", str(root)]
    if _comando(git + ["status", "--porcelain", "--untracked-files=all"], timeout=30).strip():
        raise RuntimeError("UI S165 exige checkout confirmado e limpo")
    rastreados = _comando(git + ["ls-files", "-z", "apps/web", "packages"], timeout=30).split(b"\0")
    if any(re.search(rb"(?:^|/)\.env(?:\.|$)|(?:^|/)\.npmrc$", p) for p in rastreados if p):
        raise RuntimeError("Fonte UI S165 contém configuração de ambiente")
    deps = root / "node_modules"
    web_deps = root / "apps/web/node_modules"
    if deps.is_symlink() or (deps / ".pnpm").is_symlink() or not (deps / ".pnpm").is_dir() or web_deps.is_symlink() or not web_deps.is_dir():
        raise RuntimeError("Dependências UI S165 não pertencem ao checkout")
    for diretorio in (deps, web_deps):
        for atual, dirs, arquivos in os.walk(diretorio, followlinks=False):
            for item in dirs + arquivos:
                caminho = Path(atual) / item
                if caminho.is_symlink() and not caminho.resolve().is_relative_to(root.resolve()):
                    raise RuntimeError("Dependência UI S165 aponta fora do checkout")
    arquivo = _comando(git + ["archive", "--format=tar", "HEAD", "apps/web", "packages", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"], timeout=90)
    docker("create", "--name", nome, "--network", rede, "--label", "sso.recorte=" + ident,
           "--dns", "127.0.0.1", *hosts, "--user", "pwuser", "--cap-drop", "ALL",
           "--security-opt", "no-new-privileges", IMAGE, "sleep", "infinity")
    c = inspect("container", nome)
    if (c["Image"] != imagem["Id"] or c["Config"].get("Labels", {}).get("sso.recorte") != ident
        or c["HostConfig"].get("NetworkMode") != rede or c["HostConfig"].get("Privileged")
        or c.get("Mounts") or c["HostConfig"].get("PortBindings")):
        raise RuntimeError("Container UI S165 fora do clone")
    docker("start", nome)
    c = inspect("container", nome)
    if set(c["NetworkSettings"]["Networks"]) != {rede} or any(c["NetworkSettings"].get("Ports", {}).values()) or c.get("Mounts"):
        raise RuntimeError("Container UI S165 iniciado fora da rede")
    prefixo = ["rtk", "proxy", "docker", "exec"]
    _comando(prefixo + [nome, "mkdir", "-p", "/tmp/s165-src", "/tmp/s165-dist", "/tmp/s165-home"])
    _comando(prefixo + ["-i", nome, "tar", "-xf", "-", "-C", "/tmp/s165-src"], data=arquivo)
    _comando(["rtk", "proxy", "docker", "cp", str(deps), nome + ":/tmp/s165-src/node_modules"], timeout=300)
    _comando(["rtk", "proxy", "docker", "cp", str(web_deps), nome + ":/tmp/s165-src/apps/web/node_modules"], timeout=120)
    _comando(prefixo + ["--user", "root", nome, "chown", "-R", "pwuser:pwuser", "/tmp/s165-src"], timeout=180)
    _comando(prefixo + ["-i", nome, "sh", "-c", "cat > /tmp/s165-proxy.cjs"], data=proxy)
    env = ["--env", "HOME=/tmp/s165-home", "--env", "CI=1", "--env", "VITE_SUPABASE_URL=http://127.0.0.1:5189", "--env", "VITE_SUPABASE_ANON_KEY=" + anon]
    _comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/vite", "build", "--outDir", "/tmp/s165-dist", "--emptyOutDir"], timeout=300)
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu build UI S165")
    docker("exec", "-d", "--env", "SSO_RECORTE_ID=" + ident, nome, "node", "/tmp/s165-proxy.cjs")
    env += ["--env", "S165_E2E_BASE_URL=http://127.0.0.1:5189", "--env", "S165_E2E_SUPABASE_URL=http://127.0.0.1:5189",
            "--env", "S165_E2E_EMAIL=" + credenciais["email"], "--env", "S165_E2E_SENHA=" + credenciais["senha"],
            "--env", "S165_E2E_CLIENTE_A=" + credenciais["clienteA"], "--env", "S165_E2E_CLIENTE_B=" + credenciais["clienteB"],
            "--env", "PLAYWRIGHT_BROWSERS_PATH=/ms-playwright"]
    saida = _comando(prefixo + env + ["--workdir", "/tmp/s165-src/apps/web", nome, "./node_modules/.bin/playwright", "test", "--config", "playwright.s165-isolado.config.ts", "--grep", "cria rascunho no Cliente A", "--reporter=json"], timeout=180)
    try: stats = json.loads(saida)["stats"]
    except (ValueError, KeyError, TypeError): raise RuntimeError("Relatório UI S165 inválido") from None
    if stats.get("expected") != 1 or stats.get("unexpected") != 0 or stats.get("skipped") != 0 or watchdog.is_set():
        raise RuntimeError("Cenário UI S165 não comprovado")
    print("UI S165 parcial: rascunho e troca de Cliente; revisão e histórico não executados.", flush=True)
