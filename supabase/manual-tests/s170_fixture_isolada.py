"""Prepara a fixture S170 somente em serviços descartáveis atestados.

O chamador continua responsável pelo watchdog e descarte de todos os recursos.
Este módulo não inicia serviços, navegador ou conexões externas.
"""
import hashlib
import importlib.util
import re

FIXTURE = "apps/web/e2e/s170-isolado/fixture.py"


def preparar(root, sha256):
    caminho = root / FIXTURE
    if hashlib.sha256(caminho.read_bytes()).hexdigest() != sha256:
        raise RuntimeError("Fixture S170 divergente")
    spec = importlib.util.spec_from_file_location("s170_fixture_sintetica", caminho)
    if spec is None or spec.loader is None:
        raise RuntimeError("Fixture S170 indisponível")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def executar(root, sql, query, inspect, ident, rede, containers, fixture, watchdog):
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident:
        raise RuntimeError("Identidade do clone S170 inválida")
    if set(containers) != {"db", "auth", "rest"}:
        raise RuntimeError("Serviços S170 incompletos")

    def atestar():
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu fixture S170")
        net = inspect("network", rede)
        if (not net.get("Internal") or net.get("Ingress") or net.get("Driver") != "bridge"
                or net.get("Labels", {}).get("sso.recorte") != ident):
            raise RuntimeError("Rede S170 não atestada")
        for papel, nome in containers.items():
            if nome != rede + "-" + papel:
                raise RuntimeError("Nome de serviço S170 divergente")
            c = inspect("container", nome)
            if (c["Name"] != "/" + nome or c["Config"].get("Labels", {}).get("sso.recorte") != ident
                    or not c["State"].get("Running") or c["HostConfig"].get("Privileged")
                    or c["HostConfig"].get("NetworkMode") != rede or c.get("Mounts")
                    or set(c["NetworkSettings"]["Networks"]) != {rede}
                    or any(c["NetworkSettings"].get("Ports", {}).values())):
                raise RuntimeError("Serviço S170 fora do clone")
        return True

    credenciais = fixture.preparar(root, sql, query, watchdog, atestar)
    if atestar() is not True:
        raise RuntimeError("Isolamento S170 não confirmado")
    return credenciais
