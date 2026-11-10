"""Fixture de políticas 1815 em clone isolado; upload 1811 roda separadamente."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1815_E01-S168_dispatch_invocador_upload.sql"

def preparar(root):
    arquivos = ((MIGRATION, "e90112b7c7aee8407183f34a6895af53d1a0c8defc999813bf9bc922e86a46fe"),
      ("supabase/tests/manual_E01-S168_dispatch_upload_1815.sql", "e8b3794119da2e5a403be7fdcb2b1c55aad862eceb6acc71536584b4de1a8a57"))
    dados = []
    for nome, esperado in arquivos:
        conteudo = (root / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != esperado:
            raise RuntimeError("Hash divergente: " + nome)
        dados.append(conteudo)
    migration, fixture = dados
    include = b"\\ir manual_E01-S168_politica_upload_1811.sql"
    if fixture.count(include) != 1 or b"\\" in fixture.replace(include, b""):
        raise RuntimeError("Inclusão da fixture 1815 inválida")
    fixture = fixture.replace(include, b"")
    if (len(re.findall(rb"(?im)^\s*begin\s*;", fixture)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", fixture)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|session_replication_role", fixture)):
        raise RuntimeError("Transação da fixture 1815 inválida")
    return migration, fixture

def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1815")
    antes = query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass")
    try:
        resultado = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=fixture+b"\nselect 'SSO_POLICIES_1815_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido na fixture 1815") from None
    if resultado.returncode or resultado.stdout.decode(errors="replace").splitlines().count("SSO_POLICIES_1815_OK") != 1:
        raise RuntimeError("Fixture SQL de policies 1815 falhou")
    if watchdog.is_set() or query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass") != antes:
        raise RuntimeError("Rollback da fixture 1815 não comprovado")
    print("Fixture 1815 aprovada com rollback; upload 1811 segue separadamente.", flush=True)
