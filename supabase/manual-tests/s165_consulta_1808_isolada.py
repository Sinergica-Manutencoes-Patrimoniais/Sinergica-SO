"""Fixture 1808 fixada, executada apenas em clone descartável."""
import hashlib
import re
import subprocess

NOME = "manual_E01-S165_revisao_contratos_mediada_1807.sql"
SHA256 = "762e4e1e4cf5bac38a43846a97e8a4498d49f6f5df14ec17e9c23469afbd2e8d"


def preparar(root):
    import s165_revisao_1807_isolada
    base = s165_revisao_1807_isolada.preparar(root)
    extra = (root / "supabase/tests/manual_E01-S165_consulta_recibo_1808_extra.sql").read_bytes()
    if hashlib.sha256(extra).hexdigest() != "b09e1d29802c0143a03a187b414cef84d44fb567eb3468b6f988d7035da20195":
        raise RuntimeError("Hash da fixture 1808 divergente")
    texto = extra.decode("utf-8")
    if (re.search(r"(?im)^\s*(begin|commit|rollback|end transaction)\s*;|session_replication_role|\\", texto)
        or not base.endswith(b"reset role;\nrollback;\n")):
        raise RuntimeError("Transação ou metacomandos inesperados na fixture 1808")
    return base[:-len(b"rollback;\n")] + extra + b"\nrollback;\n"


def executar(container, fixture, query, watchdog):
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu o ensaio")
    snapshot = """select jsonb_build_object(
      'usuarios',(select count(*) from auth.users),'clientes',(select count(*) from pcm.clientes),
      'sistemas',(select count(*) from pcm.sistemas),'planos',(select count(*) from pcm.planos_manutencao),
      'versoes',(select count(*) from pcm.plano_versoes),'rotinas',(select count(*) from pcm.rotinas_manutencao),
      'comandos',(select count(*) from pcm.plano_comandos),'auditoria',(select count(*) from audit.events),
      'contratos',(select count(*) from pcm.sso_revisoes_plano_contratos),
      'evidencias',(select count(*) from pcm.sso_revisoes_plano_evidencias),
      'exigencias',(select count(*) from pcm.sso_revisoes_plano_exigencias),
      'propostas',(select count(*) from pcm.sso_propostas_exigencia_revisao),
      'fila',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]'::jsonb) from pcm.auvo_sync_outbox o),
      'gate1807',(select habilitado from pcm.sso_inicio_revisao_contratos_mediado_gate where id),
      'gatecontratos',(select habilitado from pcm.sso_revisao_contrato_gate where id),
      'gatepergunta',(select habilitado from pcm.sso_contrato_pergunta_gate where id),
      'gateevidencia',(select habilitado from pcm.sso_revisao_evidencia_gate where id),
      'gatecontratoevidencia',(select habilitado from pcm.sso_contrato_evidencia_gate where id),
      'gateexigencia',(select habilitado from pcm.sso_revisao_exigencias_gate where id),
      'gatelegal',(select habilitado from pcm.sso_exigencia_legal_gate where id),
      'gateemrevisao',(select habilitado from pcm.sso_contratos_em_revisao_gate where id),
      'gate1804',(select habilitado from pcm.sso_aprovacao_versao_esperada_gate where id),
      'gate1805',(select habilitado from pcm.sso_exigir_versao_aprovacao_gate where id))::text"""
    antes = query(snapshot)
    try:
        p = subprocess.run(["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"],
            input=b"\\set VERBOSITY verbose\n" + fixture + b"\n\\echo SSO_ROLLBACK_1808_CONCLUIDO\n", capture_output=True, timeout=180)
    except subprocess.TimeoutExpired:
        raise RuntimeError("Prazo da fixture 1808 excedido") from None
    if p.returncode:
        m = re.search(rb"ERROR:\s+([A-Z0-9]{5}):", p.stderr)
        raise RuntimeError("Fixture 1808 falhou; SQLSTATE " + (m.group(1).decode() if m else "não identificado"))
    if b"SSO_ROLLBACK_1808_CONCLUIDO" not in p.stdout.splitlines() or query(snapshot) != antes:
        raise RuntimeError("Rollback ou estado de referência da fixture 1807 não comprovado")
    print("Fixture 1808 aprovada em clone; anti-loop Auvo no setup, sem prova de concorrência ou integração externa.", flush=True)
