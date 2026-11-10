"""Fixture 1804 fixada para o clone efêmero do ensaio de integração."""
import hashlib
import re
import subprocess

ARQUIVOS = {
    "manual_E01-S165_aprovacao_versao_esperada_1804.sql": "e8aba7f0e47534df63d390f63f77dd897f3fade499c7c57254d32a372ddf852b",
    "manual_E01-S165_nova_data_futura_1702.sql": "57bb6fc8b02a0dd1f102a0a114e8040b5646a9749e4df6e251c74c34f4a0c70a",
    "manual_E01-S165_impacto_calendario_nativo_1704.sql": "4ce7f3d462489e63602262a4ad00c724b6495a97dd9aae59645717b95db5f867",
}
MIGRATION = "supabase/migrations/1804_E01-S165_aprovacao_versao_esperada.sql"
MIGRATION_SHA256 = "dc22888e1da288fcb28dbfead1a71cb637215c9fe7a1d2be967863e1e86bd9ac"
INICIAL = "manual_E01-S165_aprovacao_inicial_1804.sql"
INICIAL_SHA256 = "527f1532bacb378c51625f4b60ff9b55a94bffc457ad8b9824d1032b51151091"


def preparar(root):
    migration = (root / MIGRATION).read_bytes()
    if hashlib.sha256(migration).hexdigest() != MIGRATION_SHA256:
        raise RuntimeError("Hash da migration 1804 divergente")
    conteudos = {}
    for nome, digest in ARQUIVOS.items():
        data = (root / "supabase/tests" / nome).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError("Hash de fixture divergente: " + nome)
        conteudos[nome] = data.decode("utf-8")
    principal, intermediaria, base = (conteudos[nome] for nome in ARQUIVOS)
    for texto, nome in ((principal, "manual_E01-S165_nova_data_futura_1702.sql"), (intermediaria, "manual_E01-S165_impacto_calendario_nativo_1704.sql")):
        if texto.count("\\ir " + nome) != 1:
            raise RuntimeError("Inclusão de fixture divergente")
    if re.search(r"(?im)^\s*(commit|end transaction)\s*;", "\n".join(conteudos.values())):
        raise RuntimeError("Fixture contém confirmação de transação")
    if not re.search(r"(?im)^\s*begin\s*;", principal) or not re.search(r"(?im)^\s*rollback\s*;\s*$", principal):
        raise RuntimeError("Fixture sem transação e rollback explícitos")
    intermediaria = intermediaria.replace("\\ir manual_E01-S165_impacto_calendario_nativo_1704.sql", base)
    completo = principal.replace("\\ir manual_E01-S165_nova_data_futura_1702.sql", intermediaria)
    if re.search(r"(?m)^\s*\\", completo):
        raise RuntimeError("Comando psql inesperado na fixture")
    inicial = (root / "supabase/tests" / INICIAL).read_bytes()
    if hashlib.sha256(inicial).hexdigest() != INICIAL_SHA256:
        raise RuntimeError("Hash da fixture inicial divergente")
    texto_inicial = inicial.decode("utf-8")
    if (not re.search(r"(?im)^\s*begin\s*;", texto_inicial)
        or not re.search(r"(?im)^\s*rollback\s*;\s*$", texto_inicial)
        or re.search(r"(?im)^\s*(commit|end transaction)\s*;|^\s*\\|session_replication_role", texto_inicial)):
        raise RuntimeError("Transação da fixture inicial divergente")
    return migration, completo.encode("utf-8"), inicial


def executar(container, fixtures, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu o ensaio")
    snapshot_sql = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users),'clientes',(select count(*) from pcm.clientes),
      'planos',(select count(*) from pcm.planos_manutencao),'comandos',(select count(*) from pcm.plano_comandos),
      'auditoria',(select count(*) from audit.events),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'gate1804',(select habilitado from pcm.sso_aprovacao_versao_esperada_gate where id))::text"""
    for nome, fixture in (("revisão", fixtures[0]), ("inicial", fixtures[1])):
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu o ensaio")
        antes = query(snapshot_sql)
        try:
            p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
                input=b"\\set VERBOSITY verbose\n" + fixture + b"\n\\echo SSO_ROLLBACK_1804_CONCLUIDO\n", capture_output=True, timeout=180)
        except subprocess.TimeoutExpired:
            raise RuntimeError("Prazo da fixture 1804 " + nome + " excedido") from None
        if p.returncode:
            m = re.search(rb"ERROR:\s+([A-Z0-9]{5}):\s*permission denied for (?:table|function|schema) [a-zA-Z0-9_.]+", p.stderr)
            detalhe = "; motivo " + re.sub(rb"\s+", b" ", m.group(0)).decode() if m else ""
            estado = re.search(rb"ERROR:\s+([A-Z0-9]{5}):", p.stderr)
            contexto = re.search(rb"CONTEXT:\s+PL/pgSQL function ([a-zA-Z0-9_.]+)\(", p.stderr)
            if contexto: detalhe += "; função " + contexto.group(1).decode()
            raise RuntimeError("Fixture 1804 " + nome + " falhou; SQLSTATE " + (estado.group(1).decode() if estado else "não identificado") + detalhe)
        if b"SSO_ROLLBACK_1804_CONCLUIDO" not in p.stdout.splitlines() or query(snapshot_sql) != antes:
            raise RuntimeError("Rollback ou estado de referência não comprovado: " + nome)
        if nome == "revisão":
            print("Fixture de revisão 1804 aprovada; setup com replica não comprova guardas desativadas.", flush=True)
        else:
            print("Fixture de aprovação inicial 1804 aprovada; outbox suprimido no setup sintético.", flush=True)
