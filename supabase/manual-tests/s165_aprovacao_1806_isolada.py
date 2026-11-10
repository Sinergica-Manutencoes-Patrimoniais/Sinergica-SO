"""Fixture fixada da guarda 1806, exclusivamente para clone descartável."""
import hashlib
import re
import subprocess

NOME = "manual_E01-S165_gate_token_1806.sql"
SHA256 = "d320bc515ccb03ea5c3ba580b8381127774bb15a4683badcfe84f6d80802e9ad"


def preparar(root):
    data = (root / "supabase/tests" / NOME).read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError("Hash da fixture 1806 divergente")
    texto = data.decode("utf-8")
    if (not re.search(r"(?im)^\s*begin\s*;", texto)
        or len(re.findall(r"(?im)^\s*rollback\s*;", texto)) != 1
        or re.search(r"(?im)^\s*(commit|end transaction)\s*;|session_replication_role", texto)
        or texto.count("\\gset") != 1 or re.search(r"\\(?!gset\b)", texto)):
        raise RuntimeError("Transação ou metacomandos inesperados na fixture 1806")
    return data


def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu o ensaio")
    snapshot = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users),'clientes',(select count(*) from pcm.clientes),
      'planos',(select count(*) from pcm.planos_manutencao),'comandos',(select count(*) from pcm.plano_comandos),
      'auditoria',(select count(*) from audit.events),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'gate1804',(select habilitado from pcm.sso_aprovacao_versao_esperada_gate where id),
      'gate1805',(select habilitado from pcm.sso_exigir_versao_aprovacao_gate where id),
      'tokens',(select count(*) from pcm.sso_aprovacao_versao_tokens),
      'trigger_teste',(select count(*) from pg_catalog.pg_trigger where tgname='sso_1806_observar_token'))::text"""
    antes = query(snapshot)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
            input=b"\\set VERBOSITY verbose\n" + fixture + b"\n\\echo SSO_ROLLBACK_1806_CONCLUIDO\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da fixture 1806 excedido") from None
    if p.returncode:
        m = re.search(rb"ERROR:\s+([A-Z0-9]{5}):", p.stderr)
        raise RuntimeError("Fixture 1806 falhou; SQLSTATE " + (m.group(1).decode() if m else "não identificado"))
    if b"SSO_ROLLBACK_1806_CONCLUIDO" not in p.stdout.splitlines() or query(snapshot) != antes:
        raise RuntimeError("Rollback ou estado de referência da fixture 1806 não comprovado")
    print("Fixture 1806 aprovada em clone; outbox suprimido no setup, sem prova de concorrência ou pós-commit.", flush=True)
