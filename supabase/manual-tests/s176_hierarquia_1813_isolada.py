"""Fixture 1813 em clone descartável; não comprova Auth/Storage HTTP."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1813_E01-S176_hierarquia_grupos_mediada.sql"


def preparar(root):
    arquivos = (
        (MIGRATION, "9462878dffd0b19266edcafc83ced3e875ec21183987b73cb0feb96c76d0e4dc"),
        ("supabase/tests/manual_E01-S176_hierarquia_mediada_1813.sql", "4664c402193636ef5c8b85ebcc51a4a965b9b1ba6e0721e553d48ad180ca4299"),
    )
    dados = []
    for nome, esperado in arquivos:
        conteudo = (root / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != esperado: raise RuntimeError("Hash divergente: " + nome)
        dados.append(conteudo)
    migration, fixture = dados
    if (b"\\" in fixture or len(re.findall(rb"(?im)^\s*begin\s*;", fixture)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", fixture)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|session_replication_role", fixture)):
        raise RuntimeError("Transação da fixture 1813 inválida")
    return migration, fixture


def executar(container, fixture, query, watchdog):
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1813")
    snapshot_sql = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users), 'clientes',(select count(*) from pcm.clientes),
      'objetos',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from storage.objects o),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'vault',(select count(*) from vault.secrets),
      'gate_mediado',(select habilitado from pcm.sso_hierarquia_grupos_mediada_gate where id),
      'gate_hierarquia',(select habilitado from pcm.sso_hierarquia_grupos_gate where id))::text"""
    antes = query(snapshot_sql)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=fixture + b"\nselect 'SSO_HIERARQUIA_1813_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired: raise RuntimeError("Prazo excedido na fixture 1813") from None
    if p.returncode or p.stdout.decode(errors="replace").splitlines().count("SSO_HIERARQUIA_1813_OK") != 1:
        raise RuntimeError("Fixture SQL de hierarquia 1813 falhou")
    if query(snapshot_sql) != antes: raise RuntimeError("Rollback da fixture 1813 não preservou snapshot")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1813")
    print("Fixture SQL 1813 concluída com rollback; não prova Auth/Storage HTTP.", flush=True)
