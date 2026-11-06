"""Fixture 1817 isolada; não comprova concorrência ou proposta sem oportunidade."""
import hashlib
import re
import subprocess

FIXTURE = "supabase/tests/manual_E01-S184_criacao_contrato_1817.sql"
SHA256 = "6e4839fa4e228b5e9dea8cfc3cd44cb26370501b8de75b62d623c4d5a23d5ef1"

def preparar(root):
    dados = (root / FIXTURE).read_bytes()
    if hashlib.sha256(dados).hexdigest() != SHA256: raise RuntimeError("Fixture 1817 divergente")
    if (len(re.findall(rb"(?im)^\s*begin\s*;", dados)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", dados)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|^\s*\\|session_replication_role", dados)):
        raise RuntimeError("Transação da fixture 1817 inválida")
    return dados

def executar(container, fixture, query, watchdog):
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1817")
    snapshot = "select (select count(*) from auth.users)::text||','||(select count(*) from pcm.clientes)::text||','||(select count(*) from comercial.propostas)::text||','||(select count(*) from comercial.contratos)::text||','||(select count(*) from vault.secrets)::text"
    fila = "select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb)::text from pcm.auvo_sync_outbox o"
    antes, fila_antes = query(snapshot), query(fila)
    try:
        p = subprocess.run(["rtk","proxy","docker","exec","-i",container,"psql","-X","-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-qAt"],input=b"\\set VERBOSITY verbose\nset search_path=public,extensions;\n"+fixture+b"\nselect 'SSO_CRIACAO_1817_OK';\n",capture_output=True,timeout=180)
    except subprocess.TimeoutExpired: raise RuntimeError("Prazo fixture 1817 excedido") from None
    if p.returncode:
        erro=p.stderr.decode(errors="replace"); estado=re.search(r"ERROR:\s+([0-9A-Z]{5}):",erro)
        raise RuntimeError("Fixture 1817 falhou; SQLSTATE "+(estado.group(1) if estado else "não identificado"))
    if p.stdout.decode(errors="replace").splitlines().count("SSO_CRIACAO_1817_OK") != 1 or query(snapshot)!=antes or query(fila)!=fila_antes or watchdog.is_set():
        raise RuntimeError("Rollback da fixture 1817 não comprovado")
    print("Fixture 1817 aprovada com rollback; concorrência e proposta sem oportunidade não comprovadas.",flush=True)
