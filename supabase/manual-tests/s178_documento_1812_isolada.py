"""Fixture 1812 em clone descartável; não comprova Auth/Storage HTTP."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1812_E01-S178_documento_ativo_mediado.sql"


def preparar(root):
    arquivos = (
        (MIGRATION, "8e91668c8bb67c1ae57bba486ef31423cf9f8b066c1c38191c3fa49fdeae2b76"),
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
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=b"\\set VERBOSITY verbose\n" + fixture + b"\nselect 'SSO_DOCUMENTO_1812_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired: raise RuntimeError("Prazo excedido na fixture 1812") from None
    if p.returncode:
        erro = p.stderr.decode(errors="replace")
        estado = re.search(r"ERROR:\s+([0-9A-Z]{5}):", erro)
        linha = re.search(r"(?m)^psql:<stdin>:(\d+):", erro)
        nomes = ("gate_inicial_invalido", "acl_invalida", "ator_divergente_aceito",
                 "gate_fechado_aceito", "listagem_gate_fechado_aceita", "autorizacao_divergente",
                 "listagem_permitida_divergente", "outro_cliente_autorizado", "listagem_outro_cliente_autorizada")
        classe = next((nome for nome in nomes if re.search(r"ERROR:\s+[0-9A-Z]{5}:\s+" + re.escape(nome) + r"(?:\s|$)", erro)), "não classificada")
        raise RuntimeError("Fixture SQL de documento 1812 falhou; SQLSTATE "
            + (estado.group(1) if estado else "não identificado")
            + "; linha " + (linha.group(1) if linha else "não identificada") + "; classe " + classe)
    if p.stdout.decode(errors="replace").splitlines().count("SSO_DOCUMENTO_1812_OK") != 1:
        raise RuntimeError("Fixture SQL de documento 1812 sem confirmação de rollback")
    if query(snapshot_sql) != antes: raise RuntimeError("Rollback da fixture 1812 não preservou snapshot")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture 1812")
    print("Fixture SQL 1812 concluída com rollback; não prova Auth/Storage HTTP.", flush=True)
