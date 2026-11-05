"""Fixture com COMMIT: somente chamada pelo harness que descarta o clone inteiro."""
import hashlib
import re
import subprocess

NOME = "E01-S165_gate_1805_pos_commit.sql"
SHA256 = "e0fbb94845b55757025a9716f886e3b4d89b77ff86048324e7ed9829dc9c3b12"


def preparar(root):
    data = (root / "supabase/manual-tests" / NOME).read_bytes()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise RuntimeError("Hash da fixture pós-commit divergente")
    texto = data.decode("utf-8")
    if (len(re.findall(r"(?im)^\s*commit\s*;", texto)) != 1
        or len(re.findall(r"(?im)^\s*rollback\s*;", texto)) != 1
        or texto.count("\\gset") != 1 or re.search(r"\\(?!gset\b)", texto)
        or "session_replication_role" in texto.lower()):
        raise RuntimeError("Estrutura da fixture pós-commit divergente")
    return data


def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu o ensaio")
    fila = "select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb)::text from pcm.auvo_sync_outbox o"
    antes_fila = query(fila)
    antes = query("select (select count(*) from auth.users)::text || ',' || (select count(*) from pcm.clientes)::text || ',' || (select count(*) from pcm.planos_manutencao)::text")
    if not re.fullmatch(r"\d+,\d+,\d+", antes):
        raise RuntimeError("Referência inicial de contagens inválida")
    usuarios, clientes, planos = map(int, antes.split(","))
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
            input=b"\\set VERBOSITY verbose\n" + fixture + b"\n\\echo SSO_POS_COMMIT_1805_CONCLUIDO\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da fixture pós-commit 1805 excedido") from None
    if p.returncode:
        m = re.search(rb"ERROR:\s+([A-Z0-9]{5}):", p.stderr)
        raise RuntimeError("Fixture pós-commit 1805 falhou; SQLSTATE " + (m.group(1).decode() if m else "não identificado"))
    depois = query("select (select count(*) from auth.users)::text || ',' || (select count(*) from pcm.clientes)::text || ',' || (select count(*) from pcm.planos_manutencao)::text")
    if (b"SSO_POS_COMMIT_1805_CONCLUIDO" not in p.stdout.splitlines()
        or depois != f"{usuarios + 1},{clientes + 1},{planos + 2}"
        or query(fila) != antes_fila
        or query("select count(*)=0 from pcm.sso_aprovacao_versao_tokens") != "t"):
        raise RuntimeError("Efeitos ou verificação pós-commit divergentes")
    print("Fixture 1805 pós-commit aprovada em clone; dados sintéticos persistem até descarte, outbox suprimido.", flush=True)
