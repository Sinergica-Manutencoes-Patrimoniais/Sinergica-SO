"""Limpeza adicional da execução S165 identificada por marcador exclusivo.

Não substitui o finally do harness. Perda do runner ou daemon indisponível ainda
exigem descarte do ambiente pelo provedor; nunca remove recursos não identificados.
"""
import json
import os
import re
import subprocess
from pathlib import Path


def docker(*args):
    try:
        p = subprocess.run(["rtk", "proxy", "docker", *args], capture_output=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Limpeza S165: Docker indisponível") from None
    if p.returncode: raise RuntimeError("Limpeza S165: comando Docker recusado")
    return p.stdout.decode().strip()


def main():
    run_id, tentativa, temp = os.environ.get("GITHUB_RUN_ID", ""), os.environ.get("GITHUB_RUN_ATTEMPT", ""), os.environ.get("RUNNER_TEMP", "")
    if os.environ.get("GITHUB_ACTIONS") != "true" or not run_id.isdigit() or not tentativa.isdigit() or not os.path.isabs(temp):
        raise RuntimeError("Limpeza S165: contexto inválido")
    marcador = Path(temp) / ("s165-recorte-" + run_id + "-" + tentativa)
    if not marcador.exists():
        print("Limpeza S165: marcador não criado; nenhum clone registrado.")
        return
    if marcador.is_symlink() or not marcador.is_file(): raise RuntimeError("Limpeza S165: marcador inválido")
    ident = marcador.read_text().strip()
    if not re.fullmatch(r"[0-9a-f]{12}", ident): raise RuntimeError("Limpeza S165: identidade inválida")
    rede = "sso-recorte-" + ident
    nomes = {rede + "-" + x for x in ("db", "auth", "rest", "storage", "gateway", "edge", "s165-browser", "foto-ativo", "foto-grupo", "foto-equipamento")}
    ids = docker("ps", "-a", "--filter", "label=sso.recorte=" + ident, "--format", "{{.ID}}").splitlines()
    for container_id in ids:
        c = json.loads(docker("inspect", "--type", "container", container_id))[0]
        if (not c["Id"].startswith(container_id) or c["Name"].lstrip("/") not in nomes
            or c["Config"].get("Labels", {}).get("sso.recorte") != ident or c.get("Mounts")):
            raise RuntimeError("Limpeza S165: contêiner não atestado")
        docker("rm", "-f", c["Id"])
    redes = docker("network", "ls", "--format", "{{.Name}}").splitlines()
    if rede in redes:
        n = json.loads(docker("inspect", "--type", "network", rede))[0]
        if not n.get("Internal") or n.get("Labels", {}).get("sso.recorte") != ident or n.get("Containers"):
            raise RuntimeError("Limpeza S165: rede não atestada ou ocupada")
        docker("network", "rm", n["Id"])
    marcador.unlink()
    print("Limpeza S165: recursos identificados removidos ou ausentes.")


if __name__ == "__main__":
    main()
