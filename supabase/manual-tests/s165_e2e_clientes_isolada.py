"""Prepara SOMENTE usuários e Clientes para o E2E S165 num clone já atestado.

Não cria servidor, navegador ou rede, não executa Playwright e não limpa o clone.
O chamador deve garantir isolamento e destruição do clone também em caso de erro.
"""
import hashlib
import re
import secrets

FIXTURE = "supabase/tests/manual_E01-S165_e2e_clientes_sinteticos.sql"
SHA256 = "20a8201306731bc8b7f54fc606303b7a034e502b7cf2cff042c841fd8d76595b"
ATOR = "16591000-0000-4000-8000-000000000001"
CLIENTE_A = "16591000-0000-4000-8000-00000000000a"
CLIENTE_B = "16591000-0000-4000-8000-00000000000b"


def preparar(root):
    dados = (root / FIXTURE).read_bytes()
    if hashlib.sha256(dados).hexdigest() != SHA256:
        raise RuntimeError("Fixture S165 divergente")
    return dados


def executar(sql, query, inspect, identificador, rede, containers, fixture, watchdog):
    """Exige recursos atestados; segredo sintético passa somente por stdin."""
    if not re.fullmatch(r"[0-9a-f]{12}", identificador) or rede != "sso-recorte-" + identificador:
        raise RuntimeError("Identidade do clone S165 inválida")
    net = inspect("network", rede)
    if not net.get("Internal") or net.get("Ingress") or net.get("Labels", {}).get("sso.recorte") != identificador:
        raise RuntimeError("Rede S165 não atestada")
    if set(containers) != {"db", "auth", "rest"}:
        raise RuntimeError("Serviços S165 incompletos")
    for papel, nome in containers.items():
        if nome != rede + "-" + papel:
            raise RuntimeError("Nome de serviço S165 divergente")
        c = inspect("container", nome)
        if (c["Name"] != "/" + nome or c["Config"].get("Labels", {}).get("sso.recorte") != identificador
            or not c["State"].get("Running") or c["HostConfig"].get("Privileged")
            or c["HostConfig"].get("NetworkMode") != rede or c.get("Mounts")
            or set(c["NetworkSettings"]["Networks"]) != {rede}
            or any(c["NetworkSettings"].get("Ports", {}).values())):
            raise RuntimeError("Serviço S165 fora do clone")
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture S165")
    if query("select current_setting('cron.launch_active_jobs',true)") != "off":
        raise RuntimeError("Cron não está desabilitado")
    if query("select count(*) from auth.users where id='" + ATOR + "'") != "0":
        raise RuntimeError("Ator sintético S165 já existe")
    senha = secrets.token_hex(24)
    cabecalho = "\\set s165_senha '" + senha + "'\nset local app.sso_ensaio_descartavel='s165';\nset local search_path=public,extensions;\n"
    sql(cabecalho.encode() + fixture, "fixture clientes S165")
    if watchdog.is_set() or query("select count(*) from pcm.clientes where id in ('" + CLIENTE_A + "','" + CLIENTE_B + "')") != "2":
        raise RuntimeError("Preparação S165 não comprovada")
    return {"email": "s165-e2e-sintetico@example.test", "senha": senha,
            "clienteA": "Cliente sintético S165 A", "clienteB": "Cliente sintético S165 B"}
