"""Fixture SQL de upload apenas em clone descartável; não testa Storage HTTP."""
import hashlib
import re
import subprocess

MIGRATION = "supabase/migrations/1811_E01-S168_permissao_politica_upload.sql"

# Somente identificadores estáticos conhecidos; nunca reproduzir valores ou mensagem SQL.
TABELAS_DIAGNOSTICO = frozenset({
    "users", "usuarios", "clientes", "sso_concessoes", "areas", "locais",
    "equipamento_categorias", "grupos_quantitativos", "questionarios", "tipos_tarefa",
    "sistemas", "planos_preventivos", "ocorrencias_preventivas", "planos_manutencao",
    "plano_versoes", "rotinas_manutencao", "ocorrencias_rotina_preparadas",
    "ciclos_rotina_identidades", "ocorrencias_rotina_vinculos", "ordens_servico",
    "retorno_os_preparado", "respostas_os_preparadas", "objects", "buckets",
    "sso_conferencias_cobertura_retorno", "sso_reatestacoes_cobertura_retorno",
    "sso_condicoes_estruturais_retorno", "sso_condicoes_evidencia_retorno",
    "sso_token_aprovacao_retorno", "decisoes_validacao_os", "sso_revisoes_validacao_os",
    "sso_atestacoes_pcm_retorno", "events", "auvo_sync_outbox",
})
COLUNAS_DIAGNOSTICO = frozenset({
    "id", "instance_id", "aud", "role", "email", "encrypted_password", "created_at", "updated_at",
    "user_id", "papel", "nome", "ativo", "cliente_id", "client_id", "created_by", "updated_by",
    "usuario_id", "acao", "area_id", "local_id", "categoria_id", "quantidade", "sistema_id",
    "questionario_id", "tipo_tarefa_id", "primeira_data", "intervalo_unidade", "intervalo_n",
    "plano_id", "indice", "vencimento", "chave_externa", "numero", "estado", "snapshot",
    "versao_id", "rotina_id", "rotina_logica_id", "alvo_tipo", "alvo_id", "modo", "ciclo",
    "vencimento_original", "tolerancia_antes", "tolerancia_depois", "ocorrencia_preparada_id",
    "ciclo_id", "ocorrencia_legada_id", "titulo", "categoria", "status", "prioridade", "origem",
    "ocorrencia_preventiva_id", "os_id", "chave_evento", "retorno_id", "chave_pergunta", "resultado",
    "obrigatoria", "request_id", "revisao_evidencias", "perguntas", "justificativa", "payload",
    "ator_id", "evidencia_id", "conferencia_anterior_id", "conferencia_nova_id", "revisao_decisao", "reatestacao_id",
    "diagnostico", "condicao_estrutural_id", "decisoes_resposta", "txid", "decisao", "motivo",
    "actor_id", "decisao_id", "revisao", "condicao_evidencia_id", "bucket_id", "name", "owner_id",
    "raw_app_meta_data", "raw_user_meta_data", "perguntas", "objeto_id", "version", "metadata",
})


def classificar_not_null(erro):
    m = re.search(r'null value in column "([a-z_][a-z_0-9]*)" of relation "([a-z_][a-z_0-9]*)"', erro)
    if not m:
        return "tabela/coluna não identificadas"
    coluna, tabela = m.groups()
    return ((tabela if tabela in TABELAS_DIAGNOSTICO else "tabela não classificada") + "/"
            + (coluna if coluna in COLUNAS_DIAGNOSTICO else "coluna não classificada"))


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
            input=b"\\set VERBOSITY verbose\nset search_path=public,extensions;\n" + fixture + b"\nselect 'SSO_UPLOAD_1811_OK';\n", capture_output=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo excedido na fixture 1811") from None
    if resultado.returncode:
        erro = resultado.stderr.decode(errors="replace")
        estado = re.search(r"ERROR:\s+([0-9A-Z]{5}):", erro)
        linha = re.search(r"(?m)^psql:<stdin>:(\d+):", erro)
        raise RuntimeError("Fixture SQL de upload 1811 falhou; SQLSTATE "
            + (estado.group(1) if estado else "não identificado")
            + "; linha expandida " + (linha.group(1) if linha else "não identificada")
            + ("; NOT NULL " + classificar_not_null(erro) if estado and estado.group(1) == "23502" else ""))
    if resultado.stdout.decode(errors="replace").splitlines().count("SSO_UPLOAD_1811_OK") != 1:
        raise RuntimeError("Fixture SQL de upload 1811 sem confirmação de rollback")
    if query(snapshot_sql) != antes:
        raise RuntimeError("Rollback da fixture 1811 não preservou snapshot")
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu fixture 1811")
    print("Fixture SQL 1811 concluída com rollback; não prova Storage HTTP.", flush=True)
