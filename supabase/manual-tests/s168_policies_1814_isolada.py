"""Fixture de políticas 1814 em clone isolado; upload 1811 roda separadamente."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1814_E01-S168_isolar_policies_upload_retorno.sql"

def preparar(root):
    arquivos = ((MIGRATION, "06d852001872143fd1f12b6f7f25d8280fd77c25387dd42e2980e60518fe48bf"),
      ("supabase/tests/manual_E01-S168_policies_upload_1814.sql", "b6e09d7ce2b34341e24f77680fbe169c38434d4721961eed08c9903e6b1bda7c"))
    dados = []
    for nome, esperado in arquivos:
        conteudo = (root / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != esperado:
            raise RuntimeError("Hash divergente: " + nome)
        dados.append(conteudo)
    migration, fixture = dados
    include = b"\\ir manual_E01-S168_politica_upload_1811.sql"
    if fixture.count(include) != 1 or b"\\" in fixture.replace(include, b""):
        raise RuntimeError("Inclusão da fixture 1814 inválida")
    fixture = fixture.replace(include, b"")
    if (len(re.findall(rb"(?im)^\s*begin\s*;", fixture)) != 1
        or len(re.findall(rb"(?im)^\s*rollback\s*;", fixture)) != 1
        or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|session_replication_role", fixture)):
        raise RuntimeError("Transação da fixture 1814 inválida")
    return migration, fixture

def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1814")
    antes = query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass")
    try:
        resultado = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], input=fixture+b"\nselect 'SSO_POLICIES_1814_OK';\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido na fixture 1814") from None
    if resultado.returncode or resultado.stdout.decode(errors="replace").splitlines().count("SSO_POLICIES_1814_OK") != 1:
        raise RuntimeError("Fixture SQL de policies 1814 falhou")
    if watchdog.is_set() or query("select count(*) from pg_catalog.pg_policy where polrelid='storage.objects'::regclass") != antes:
        raise RuntimeError("Rollback da fixture 1814 não comprovado")
    print("Fixture 1814 aprovada com rollback; upload 1811 segue separadamente.", flush=True)
