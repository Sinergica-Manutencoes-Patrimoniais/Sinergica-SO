"""Cinco fixtures fixadas, apenas para banco descartável do candidato de integração."""
import hashlib
import re
import subprocess

FIXTURES = (
    ("E01-S170_autorizacao_modulos_1790_1795.test.sql", "5d8a18272491f15d1e5e00382959c1e9581b9a4a9a171500a6130d38d372b26c", 12),
    ("E01-S176_vinculos_cliente_final.test.sql", "fd36e462437d579c9f79ff2c31eec3858f98c7d50a3151985cf232c636a9abb6", 10),
    ("E01-S165_plano_manutencao.test.sql", "afb0fd5978775d6808142fcbffcfa0ddf0bf6c716d38d7fcf74eab6c1a74046a", 183),
    ("E01-S166_versoes_recorrencia_tolerancia.test.sql", "0dfa9949c5cb91e3820808ac9c5b9d1c51b8944590289eeb4fe8512b85ffe4d4", 7),
    ("E01-S166_mudanca_dia_v2_contract.test.sql", "c8602260b2028201249663bd42ebebe3a6e6034f7c2e9d35f02e5af7155072eb", 38),
)


def preparar(root):
    arquivos = []
    for nome, digest, total in FIXTURES:
        dados = (root / "supabase/tests" / nome).read_bytes()
        if hashlib.sha256(dados).hexdigest() != digest:
            raise RuntimeError("Fixture alterada: " + nome)
        arquivos.append((nome, dados, total))
    return arquivos


def executar(container, arquivos, sql, query, watchdog):
    if query("select exists(select 1 from pg_available_extensions where name='pgtap')") != "t":
        raise RuntimeError("Extensão pgTAP indisponível no banco descartável")
    sql(b"create extension if not exists pgtap with schema extensions;", "pgTAP no clone")
    if query("select exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgtap' and n.nspname='extensions')") != "t":
        raise RuntimeError("Extensão pgTAP fora do schema esperado")
    contagem = "select (select count(*) from auth.users)::text || ',' || (select count(*) from pcm.clientes)::text || ',' || (select count(*) from vault.secrets)::text"
    baseline_oficial = """select count(*)=6 and count(distinct c.sigla)=6 and coalesce(bool_and(
        o.entity='equipamento_categorias' and o.op='create' and o.status='pending'
        and o.attempts=0 and o.last_error is null and o.sent_at is null and c.deleted_at is null
        and (c.nome,c.sigla) in (('Elétrica','ELE'),('Hidráulica','HID'),('Transporte Vertical','TRV'),
          ('Climatização','CLI'),('Segurança','SEG'),('PCI (Prevenção e Combate a Incêndio)','PCI'))),false)
        from pcm.auvo_sync_outbox o left join pcm.equipamento_categorias c on c.id=o.row_id"""
    snapshot_sql = "select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb)::text from pcm.auvo_sync_outbox o"

    def verificar_limpeza(contexto):
        valor = query(contagem)
        if not re.fullmatch(r"\d+,\d+,\d+", valor):
            raise RuntimeError("Contagens de limpeza inválidas: " + contexto)
        usuarios, clientes, vault = valor.split(",")
        if any(numero != "0" for numero in (usuarios, clientes, vault)):
            raise RuntimeError(f"Banco não está limpo {contexto}: usuários={usuarios}, clientes={clientes}, vault={vault}")

    verificar_limpeza("antes das fixtures")
    if query(baseline_oficial) != "t":
        raise RuntimeError("Fila inicial diverge das seis categorias oficiais")
    snapshot = query(snapshot_sql)
    for nome, dados, total in arquivos:
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu o ensaio")
        try:
            resultado = subprocess.run(
                ["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
                input=b"set search_path=public,extensions;\n" + dados, capture_output=True, timeout=180,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Prazo excedido na fixture " + nome) from None
        if resultado.returncode:
            stderr = resultado.stderr.decode(errors="replace")
            erro = re.search(r"ERROR:\s*(?:([0-9A-Z]{5}):\s*)?([^\r\n]+)", stderr)
            if erro:
                detalhe = re.sub(r"\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b", "<uuid>", erro.group(2), flags=re.I)
                codigo = erro.group(1) or "desconhecido"
                raise RuntimeError(f"Erro SQL na fixture {nome}; SQLSTATE {codigo}: {detalhe[:160]}")
            raise RuntimeError("Erro SQL na fixture " + nome + "; diagnóstico não reconhecido")
        linhas = resultado.stdout.decode(errors="replace").splitlines()
        planos = [linha for linha in linhas if re.fullmatch(r"1\.\.\d+", linha)]
        testes = [linha for linha in linhas if re.match(r"^(?:not )?ok\b", linha)]
        if planos != [f"1..{total}"] or len(testes) != total:
            raise RuntimeError("Plano ou contagem TAP divergente: " + nome)
        for numero, linha in enumerate(testes, 1):
            if not re.match(rf"^ok {numero}(?:\s|$)", linha) or re.search(r"#\s*(?:SKIP|TODO)\b", linha, re.I):
                descricao = linha.partition(" - ")[2][:120] if " - " in linha else ""
                diagnosticos = [re.sub(r"\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b", "<uuid>", linha_diag.strip(), flags=re.I)[:180]
                    for linha_diag in linhas
                    if re.match(r"#\s*(?:Failed test|caught|wanted|got|expected|match|does not match)", linha_diag, re.I)][:4]
                detalhes = ([descricao] if descricao else []) + diagnosticos
                sufixo = " (" + "; ".join(detalhes) + ")" if detalhes else ""
                raise RuntimeError("Resultado TAP inválido, falhou ou foi omitido: " + nome + " caso " + str(numero) + sufixo)
        if any(linha.startswith("#") or linha.startswith("Bail out!") for linha in linhas):
            raise RuntimeError("Diagnóstico TAP não aceito: " + nome)
        verificar_limpeza("após fixture " + nome)
        if query(snapshot_sql) != snapshot:
            raise RuntimeError("Fila alterada após fixture: " + nome)
        print("Fixture aprovada:", nome, "asserts:", total, flush=True)
