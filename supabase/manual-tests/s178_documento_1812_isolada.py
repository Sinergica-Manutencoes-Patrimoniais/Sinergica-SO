"""Fixture 1812 em clone descartável; não comprova Auth/Storage HTTP."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1812_E01-S178_documento_ativo_mediado.sql"


def preparar(root):
    arquivos = (
        (MIGRATION, "a355ce37ac6a8537ec9e03a6414b1efa31778751f2df150f3755e44c61de023d"),
        ("supabase/tests/manual_E01-S178_documento_mediado_1812.sql", "2eb51f7cd15cd7725d3a1b5fb5f463aeeef4f3e0b2ed357e1d9b78b697fa8025"),
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
        raise RuntimeError("Transação da fixture 1812 inválida")
    return migration, fixture


def executar(container, fixture, query, watchdog):
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1812")
    snapshot_sql = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users), 'clientes',(select count(*) from pcm.clientes),
      'objetos',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from storage.objects o),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'vault',(select count(*) from vault.secrets),
      'gate_mediado',(select habilitado from pcm.sso_documento_ativo_mediado_gate where id),
      'gate_ativo',(select habilitado from pcm.sso_documento_staging_ativo_gate where id),
      'gate_documentos',(select habilitado from pcm.sso_documentos_levantamento_gate where id))::text"""
    antes = query(snapshot_sql)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=fixture + b"\nselect 'SSO_DOCUMENTO_1812_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired: raise RuntimeError("Prazo excedido na fixture 1812") from None
    if p.returncode or p.stdout.decode(errors="replace").splitlines().count("SSO_DOCUMENTO_1812_OK") != 1:
        raise RuntimeError("Fixture SQL de documento 1812 falhou")
    if query(snapshot_sql) != antes: raise RuntimeError("Rollback da fixture 1812 não preservou snapshot")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1812")
    print("Fixture SQL 1812 concluída com rollback; não prova Auth/Storage HTTP.", flush=True)
