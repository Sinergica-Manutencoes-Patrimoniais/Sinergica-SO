"""Fixture de políticas 1816 em clone isolado; upload 1812 roda separadamente."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1816_E01-S178_qualificar_gates_documentos.sql"

def preparar(root):
    arquivos = ((MIGRATION, "a1d27a58ee28035ea86d1d9c672da7f491c26c7a31e1754eafbe2efc827016a8"),
      ("supabase/tests/manual_E01-S178_gates_documentos_1816.sql", "5a967e5455c374aebacd2e826a0de8c7ce8cd15d18b384c5f6d491966973cedb"))
    dados = []
    for nome, esperado in arquivos:
        conteudo = (root / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != esperado:
            raise RuntimeError("Hash divergente: " + nome)
        dados.append(conteudo)
    migration, fixture = dados
    include = b"\\ir manual_E01-S178_documento_mediado_1812.sql"
    if fixture.count(include) != 1 or b"\\" in fixture.replace(include, b""):
        raise RuntimeError("Inclusão da fixture 1816 inválida")
    fixture = fixture.replace(include, b"")
    if (len(re.findall(rb"(?im)^\s*begin\s*;", fixture)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", fixture)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|session_replication_role", fixture)):
        raise RuntimeError("Transação da fixture 1816 inválida")
    return migration, fixture

def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1816")
    antes = query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass")
    try:
        resultado = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=fixture+b"\nselect 'SSO_POLICIES_1816_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido na fixture 1816") from None
    if resultado.returncode or resultado.stdout.decode(errors="replace").splitlines().count("SSO_POLICIES_1816_OK") != 1:
        raise RuntimeError("Fixture SQL de policies 1816 falhou")
    if watchdog.is_set() or query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass") != antes:
        raise RuntimeError("Rollback da fixture 1816 não comprovado")
    print("Fixture 1816 aprovada com rollback; upload 1812 segue separadamente.", flush=True)
