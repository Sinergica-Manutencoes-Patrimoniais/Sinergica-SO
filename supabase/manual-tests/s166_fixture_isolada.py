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
    return modulo.preparar(root, "894fb4c9ef50fdddf4aeec2f108a7699e887cda7eef149a6f4d146b512242827")


def executar(sql, query, inspect, ident, network, containers, fixture, watchdog):
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or network != "sso-recorte-" + ident:
        raise RuntimeError("Identidade do clone S166 inválida")
    spec = importlib.util.spec_from_file_location("s166_fixture_sintetica", ROOT / FIXTURE)
    if spec is None or spec.loader is None:
        raise RuntimeError("Fixture S166 indisponível")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo.executar(sql, query, inspect, ident, network, containers, fixture, watchdog)
