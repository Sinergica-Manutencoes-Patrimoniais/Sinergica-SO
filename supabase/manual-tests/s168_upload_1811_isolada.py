"""Fixture SQL de upload apenas em clone descartável; não testa Storage HTTP."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1811_E01-S168_permissao_politica_upload.sql"


def preparar(root):
    arquivos = (
        (MIGRATION, "7cbbd0afcbbdc741f3bc2873e3bc61fd10ced07bb0ec98cc342c8e529a80c02e"),
        ("supabase/tests/manual_E01-S168_politica_upload_1811.sql", "542a4585a1398c904206f2825fa356f6bd98a02b7893011d5968150784f40e02"),
        ("supabase/tests/E01-S168_finalizacao_fixture_real.sql", "24b1b1873bf26b55e9f83993a24fa0ae438e9414baf96a0be91549e8f34d9ec9"),
    )
    dados = []
    for nome, esperado in arquivos:
        conteudo = (root / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != esperado:
            raise RuntimeError("Hash divergente: " + nome)
        dados.append(conteudo)
    migration, fixture, setup = dados
    include = b"\\ir E01-S168_finalizacao_fixture_real.sql"
    if fixture.count(include) != 1 or b"\\" in fixture.replace(include, b"") or b"\\" in setup:
        raise RuntimeError("Inclusão da fixture 1811 inválida")
    combinado = fixture.replace(include, setup)
    if (len(re.findall(rb"(?im)^\s*begin\s*;", combinado)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", combinado)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|session_replication_role", combinado)):
        raise RuntimeError("Transação da fixture 1811 inválida")
    return migration, combinado


def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1811")
    snapshot_sql = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users), 'clientes',(select count(*) from pcm.clientes),
      'objetos',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from storage.objects o),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'gate_validacao',(select habilitado from pcm.validacao_os_gate where id),
      'gate_upload',(select habilitado from pcm.sso_upload_evidencia_resposta_gate where id))::text"""
    antes = query(snapshot_sql)
    try:
        resultado = subprocess.run(
            ["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
            input=b"set search_path=public,extensions;\n" + fixture + b"\nselect 'SSO_UPLOAD_1811_OK';\n", capture_output=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido na fixture 1811") from None
    if resultado.returncode or resultado.stdout.decode(errors="replace").splitlines().count("SSO_UPLOAD_1811_OK") != 1:
        raise RuntimeError("Fixture SQL de upload 1811 falhou")
    if query(snapshot_sql) != antes:
        raise RuntimeError("Rollback da fixture 1811 não preservou snapshot")
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1811")
    print("Fixture SQL 1811 concluída com rollback; não prova Storage HTTP.", flush=True)
