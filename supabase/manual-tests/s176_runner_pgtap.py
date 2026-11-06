"""Quatro fixtures fixadas, apenas para banco descartável do candidato de integração."""
import hashlib
import re
import subprocess

FIXTURES = (
    ("E01-S170_autorizacao_modulos_1790_1795.test.sql", "bc2e6d5bbc80ea92ddc8cf00664283772bae00eec75c291f622806cc5abc2ad2", 12),
    ("E01-S176_vinculos_cliente_final.test.sql", "fd36e462437d579c9f79ff2c31eec3858f98c7d50a3151985cf232c636a9abb6", 10),
    ("E01-S165_plano_manutencao.test.sql", "55c9a39e6f87eaaa64e0689df608392df231afc5d0dac6f55925461851ca5235", 180),
    ("E01-S166_versoes_recorrencia_tolerancia.test.sql", "0dfa9949c5cb91e3820808ac9c5b9d1c51b8944590289eeb4fe8512b85ffe4d4", 7),
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
        entrada = dados
        if nome == "comercial_contratos_rls.test.sql":
            # Checkpoints fixos por linha, sem reproduzir SQL ou parâmetros.
            linhas_sql = dados.splitlines(keepends=True)
            entrada = b"".join((f"\\echo SSO_CHECKPOINT_{i}\n".encode() if re.match(rb"^(?:select |insert |update |set local |reset role|rollback;)", linha, re.I) else b"") + linha for i, linha in enumerate(linhas_sql, 1))
        try:
            resultado = subprocess.run(
                ["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
                input=b"\\set VERBOSITY verbose\nset search_path=public,extensions;\n" + entrada, capture_output=True, timeout=180,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Prazo excedido na fixture " + nome) from None
        if resultado.returncode:
            erro = resultado.stderr.decode(errors="replace")
            estado = re.search(r"ERROR:\s+([0-9A-Z]{5}):", erro)
            linha = re.search(r"(?m)^psql:<stdin>:(\d+):", erro)
            codigo = estado.group(1) if estado else "não identificado"
            categorias = {"23502": "campo obrigatório", "23503": "referência", "23505": "duplicidade", "23514": "regra de integridade", "42501": "permissão", "42702": "coluna ambígua", "42703": "coluna ausente", "42883": "função ausente", "42P01": "relação ausente", "P0001": "exceção SQL"}
            categoria = categorias.get(codigo, "não classificada")
            if codigo == "P0002":
                if re.search(r"(?i)proposta [^\r\n]* não encontrada", erro): categoria = "proposta não encontrada"
                elif re.search(r"(?i)contrato [^\r\n]* não encontrado", erro): categoria = "contrato não encontrado"
            checkpoints = re.findall(r"(?m)^SSO_CHECKPOINT_(\d+)$", resultado.stdout.decode(errors="replace"))
            checkpoint = checkpoints[-1] if checkpoints else "nenhum"
            pontos = re.findall(r"(?m)^(?:not )?ok\s+(\d+)\b", resultado.stdout.decode(errors="replace"))
            ultimo = pontos[-1] if pontos else "nenhum"
            funcoes = ("fn_criar_contrato", "fn_ativar_contrato", "fn_encerrar_contrato", "fn_criar_plano_faturamento")
            funcao = next((f for f in funcoes if re.search(r"(?i)PL/pgSQL function (?:comercial|financeiro)\." + re.escape(f) + r"\(", erro)), "não classificada")
            raise RuntimeError("Erro SQL na fixture " + nome + "; SQLSTATE " + codigo
                + "; linha " + (linha.group(1) if linha else "não identificada") + "; categoria " + categoria
                + "; último TAP " + ultimo + "; função " + funcao + "; checkpoint " + checkpoint)
        linhas = resultado.stdout.decode(errors="replace").splitlines()
        planos = [linha for linha in linhas if re.fullmatch(r"1\.\.\d+", linha)]
        testes = [linha for linha in linhas if re.match(r"^(?:not )?ok\b", linha)]
        if planos != [f"1..{total}"] or len(testes) != total:
            raise RuntimeError("Plano ou contagem TAP divergente: " + nome)
        for numero, linha in enumerate(testes, 1):
            if not re.match(rf"^ok {numero}(?:\s|$)", linha) or re.search(r"#\s*(?:SKIP|TODO)\b", linha, re.I):
                raise RuntimeError("Resultado TAP inválido, falhou ou foi omitido: " + nome + " caso " + str(numero))
        if any(linha.startswith("#") or linha.startswith("Bail out!") for linha in linhas):
            raise RuntimeError("Diagnóstico TAP não aceito: " + nome)
        verificar_limpeza("após fixture " + nome)
        if query(snapshot_sql) != snapshot:
            raise RuntimeError("Fila alterada após fixture: " + nome)
        print("Fixture aprovada:", nome, "asserts:", total, flush=True)
