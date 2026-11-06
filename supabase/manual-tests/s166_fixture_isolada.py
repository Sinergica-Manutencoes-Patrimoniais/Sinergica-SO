"""Adapter do bootstrap S166: só aplica fixture em clone já atestado pelo recorte."""
import hashlib
import importlib.util
import re
from pathlib import Path

FIXTURE = "apps/web/e2e/s166-isolado/fixture.py"
ROOT = Path(__file__).resolve().parents[2]


def preparar(root, sha256):
    caminho = root / FIXTURE
    if hashlib.sha256(caminho.read_bytes()).hexdigest() != sha256:
        raise RuntimeError("Fixture/driver S166 divergente")
    spec = importlib.util.spec_from_file_location("s166_fixture_sintetica", caminho)
    if spec is None or spec.loader is None:
        raise RuntimeError("Fixture S166 indisponível")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.preparar(root, "38cf454adc889f1a7ec92288338f98a5000d1d0069bc0698958ff7525266aba5")


def executar(sql, query, inspect, ident, network, containers, fixture, watchdog):
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or network != "sso-recorte-" + ident:
        raise RuntimeError("Identidade do clone S166 inválida")
    spec = importlib.util.spec_from_file_location("s166_fixture_sintetica", ROOT / FIXTURE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Fixture S166 indisponível")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.executar(sql, query, inspect, ident, network, containers, fixture, watchdog)
