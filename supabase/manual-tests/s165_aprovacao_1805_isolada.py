"""Fixture fixada da guarda 1805, exclusivamente para clone descartável."""
import hashlib
import re
import subprocess

NOME = "manual_E01-S165_gate_aprovacao_versao_1805.sql"
SHA256 = "e95a0b18f870b42835f8cfe981f4d5d28990a5502c4f33b8ab8eacb04947a31e"


def preparar(root):
    data = (root / "supabase/tests" / NOME).read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError("Hash da fixture 1805 divergente")
    texto = data.decode("utf-8")
    if (not re.search(r"(?im)^\s*begin\s*;", texto)
        or len(re.findall(r"(?im)^\s*rollback\s*;", texto)) != 1
        or re.search(r"(?im)^\s*(commit|end transaction)\s*;|session_replication_role", texto)
        or texto.count("\\gset") != 1 or re.search(r"\\(?!gset\b)", texto)):
        raise RuntimeError("Transação ou metacomandos inesperados na fixture 1805")
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
      'tokens',(select count(*) from pcm.sso_aprovacao_versao_tokens))::text"""
    antes = query(snapshot)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
            input=b"\\set VERBOSITY verbose\n" + fixture + b"\n\\echo SSO_ROLLBACK_1805_CONCLUIDO\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da fixture 1805 excedido") from None
    if p.returncode:
        estado = re.search(rb"ERROR:\s+([A-Z0-9]{5}):", p.stderr)
        motivo = re.search(rb"ERROR:\s+[A-Z0-9]{5}:\s*([a-z0-9_]+)", p.stderr)
        contexto = re.search(rb"CONTEXT:\s+PL/pgSQL function ([a-zA-Z0-9_.]+)\(", p.stderr)
        detalhe = "; motivo " + motivo.group(1).decode() if motivo else ""
        if contexto: detalhe += "; função " + contexto.group(1).decode()
        raise RuntimeError("Fixture 1805 falhou; SQLSTATE " + (estado.group(1).decode() if estado else "não identificado") + detalhe)
    if b"SSO_ROLLBACK_1805_CONCLUIDO" not in p.stdout.splitlines() or query(snapshot) != antes:
        raise RuntimeError("Rollback ou estado de referência da fixture 1805 não comprovado")
    print("Fixture 1805 aprovada em clone; outbox suprimido no setup, sem prova de concorrência ou pós-commit.", flush=True)
