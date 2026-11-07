"""Fixture sintética S166 V2 para clone efêmero do runner isolado.

Não inicializa serviços, não lê credenciais locais e não envia dados ao Auvo.
O chamador deve atestar rede/containers e descartar o clone ao terminar.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from pathlib import Path


SOURCE = "supabase/tests/E01-S166_mudanca_dia_v2_contract.test.sql"

USER_A = "16670000-0000-4000-8000-000000000001"
USER_B = "16670000-0000-4000-8000-000000000002"
CLIENT_A_ID = "16670000-0000-4000-8000-000000000010"
CLIENT_B_ID = "16670000-0000-4000-8000-000000000011"
STAGE_OPEN = "16670000-0000-4000-8000-000000000020"
STAGE_WON = "16670000-0000-4000-8000-000000000021"
OPPORTUNITY_ID = "16670000-0000-4000-8000-000000000030"
PROPOSAL_ID = "16670000-0000-4000-8000-000000000040"
SERIES_ID = "16670000-0000-4000-8000-000000000050"
RULE_ID = "16670000-0000-4000-8000-000000000051"
RULE_REQUEST_ID = "16670000-0000-4000-8000-000000000111"

EMAIL_A = "s166-v2-admin@example.test"
EMAIL_B = "s166-v2-negado@example.test"
CLIENT_A_NAME = "Cliente fixture S166 V2"
CLIENT_B_NAME = "Cliente sem concessão S166 V2"


def preparar(root: Path, esperado_sha256: str) -> dict[str, str]:
    """Confere a fixture pgTAP de referência e prepara apenas valores sintéticos."""
    raiz = Path(root).resolve()
    fonte = (raiz / SOURCE).resolve()
    try:
        fonte.relative_to(raiz)
        conteudo = fonte.read_bytes()
    except (OSError, ValueError):
        raise RuntimeError("Fonte da fixture pgTAP S166 indisponível") from None

    if not re.fullmatch(r"[0-9a-f]{64}", esperado_sha256):
        raise RuntimeError("Hash da fixture pgTAP S166 inválido")
    digest = hashlib.sha256(conteudo).hexdigest()
    if digest != esperado_sha256:
        raise RuntimeError("Fonte pgTAP S166 divergente")

    # A fixture operacional deve permanecer alinhada ao caso pgTAP de 501 visitas,
    # geradas pelo produtor canônico e dentro do orçamento V2 de 600 itens.
    marcadores = (
        b"Fixture transacional S166 V2",
        b"for i in 1..501 loop",
        b"pcm.sso_gerar_visita_ou_suprimir(",
        b"max_itens=600,max_bytes=1048576,ttl_seconds=3600",
    )
    if any(marcador not in conteudo for marcador in marcadores):
        raise RuntimeError("Contrato sintético S166 V2 divergente da fixture pgTAP")

    return {
        "source_sha256": digest,
        "senha": secrets.token_hex(32),
        "emailA": EMAIL_A,
        "emailB": EMAIL_B,
        "clienteA": CLIENT_A_NAME,
        "clienteB": CLIENT_B_NAME,
        "serie_id": SERIES_ID,
        "regra_id": RULE_ID,
    }


def executar(sql, query, inspect, ident: str, network: str, containers: dict[str, str], fixture: dict[str, str], watchdog):
    """Cria dois usuários e 501 Visitas exclusivamente no clone já atestado."""
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or network != "sso-recorte-" + ident:
        raise RuntimeError("Identidade do clone S166 inválida")
    nomes = {"db": network + "-db", "auth": network + "-auth", "rest": network + "-rest"}
    if not isinstance(containers, dict) or containers != nomes:
        raise RuntimeError("Serviços S166 incompletos ou fora do clone")
    if fixture.get("source_sha256") != hashlib.sha256((Path(__file__).resolve().parents[4] / SOURCE).read_bytes()).hexdigest():
        raise RuntimeError("Fixture S166 não corresponde à fonte validada")
    senha = fixture.get("senha", "")
    if not re.fullmatch(r"[0-9a-f]{64}", senha):
        raise RuntimeError("Credencial sintética S166 inválida")

    def atestar() -> bool:
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu fixture S166")
        try:
            net = inspect("network", network)
        except Exception:
            raise RuntimeError("Rede do clone S166 indisponível") from None
        if (net.get("Name") != network or net.get("Driver") != "bridge" or net.get("Internal") is not True
                or net.get("Ingress") is True or net.get("Labels", {}).get("sso.recorte") != ident):
            raise RuntimeError("Rede S166 não é interna ou não pertence ao clone")
        for papel, nome in nomes.items():
            try:
                c = inspect("container", nome)
            except Exception:
                raise RuntimeError("Serviço do clone S166 indisponível") from None
            if (c.get("Name") != "/" + nome or c.get("Config", {}).get("Labels", {}).get("sso.recorte") != ident
                    or not c.get("State", {}).get("Running") or c.get("HostConfig", {}).get("Privileged")
                    or c.get("HostConfig", {}).get("NetworkMode") != network or c.get("Mounts")
                    or set(c.get("NetworkSettings", {}).get("Networks", {})) != {network}
                    or any(c.get("NetworkSettings", {}).get("Ports", {}).values())):
                raise RuntimeError("Serviço S166 não está isolado no clone")
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu fixture S166")
        return True

    atestar()
    if query("select current_database()='postgres' and current_user='postgres'").strip() != "t":
        raise RuntimeError("Fixture S166 exige conexão administrativa no banco descartável")
    if query("select current_setting('cron.launch_active_jobs',true)").strip() != "off":
        raise RuntimeError("Cron não está desligado no clone S166")
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0").strip() != "t":
        raise RuntimeError("Clone S166 não está vazio")

    # IDs e ações espelham a fixture pgTAP atual. Datas são calculadas no banco do
    # clone para que a Visita inicial e a vigência de alteração permaneçam futuras.
    setup = f"""
set local search_path=public,extensions;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
values
 ('{USER_A}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{EMAIL_A}',crypt('{senha}',gen_salt('bf')),'{{}}','{{}}',now(),now(),now()),
 ('{USER_B}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{EMAIL_B}',crypt('{senha}',gen_salt('bf')),'{{}}','{{}}',now(),now(),now());
update auth.users set is_sso_user=false,confirmation_token='',recovery_token='',email_change='',email_change_token_new=''
 where id in ('{USER_A}','{USER_B}');
select config.provisionar_usuario('{USER_A}','superadmin','Administrador sintético S166 V2');
select config.provisionar_usuario('{USER_B}','colaborador','Operador sem concessão S166 V2');
insert into config.usuario_modulos(user_id,modulo,nivel)
values ('{USER_B}','pcm','escrita');

set local role authenticated;
set local request.jwt.claims='{{"sub":"{USER_A}","role":"authenticated","user_role":"superadmin"}}';
insert into pcm.clientes(id,nome,ativo,created_by)
values ('{CLIENT_A_ID}','{CLIENT_A_NAME}',true,'{USER_A}'),
       ('{CLIENT_B_ID}','{CLIENT_B_NAME}',true,'{USER_A}');
select config.sso_definir_concessao('16670000-0000-4000-8000-000000000101',0,'{USER_A}',null,'plano.gerir','{CLIENT_A_ID}',true,'Fixture descartável S166 V2');
select config.sso_definir_concessao('16670000-0000-4000-8000-000000000102',0,'{USER_A}',null,'visita.confirmar','{CLIENT_A_ID}',true,'Fixture descartável S166 V2');
reset role;
insert into config.usuario_cliente(user_id,cliente_id,created_by)
values ('{USER_B}','{CLIENT_B_ID}','{USER_A}');

set local role authenticated;
set local request.jwt.claims='{{"sub":"{USER_A}","role":"authenticated","user_role":"superadmin"}}';
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo)
values ('{STAGE_OPEN}','Etapa aberta fixture S166',990,'#111111','aberta'),
       ('{STAGE_WON}','Etapa ganha fixture S166',991,'#00aa00','ganha');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo)
values ('{OPPORTUNITY_ID}','{CLIENT_A_ID}','{STAGE_OPEN}','Oportunidade fixture S166 V2');
insert into comercial.propostas(id,oportunidade_id,tipo,status,preco_centavos)
values ('{PROPOSAL_ID}','{OPPORTUNITY_ID}','simples','aceita',0);
select comercial.fn_criar_contrato('{PROPOSAL_ID}');
select comercial.fn_ativar_contrato((select id from comercial.contratos where proposta_id='{PROPOSAL_ID}'));
select pcm.sso_criar_regra_contratual(
 '{RULE_REQUEST_ID}',0,'{SERIES_ID}','{RULE_ID}',
 (select id from comercial.contratos where proposta_id='{PROPOSAL_ID}'),
 date_trunc('week',current_date::timestamp)::date+14,2,1,'12:00',60,0,'America/Sao_Paulo',
 date_trunc('week',current_date::timestamp)::date+14,null);

reset role;
update pcm.sso_acesso_geracao_visita_gate set habilitado=true where id;
update pcm.sso_gerar_visita_contratual_gate set habilitado=true where id;
update pcm.sso_geracao_ou_supressao_gate set habilitado=true where id;
update pcm.sso_geracao_com_supressao_gate set habilitado=true where id;
update pcm.sso_supressao_semana_gate set habilitado=true where id;
update pcm.sso_coordenacao_feriados_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
update pcm.sso_origem_contratual_unica_gate set habilitado=true where id;
update pcm.sso_mudanca_dia_v2_gate set max_itens=600,max_bytes=1048576,ttl_seconds=3600 where id;
update pcm.sso_mudanca_dia_v2_gate set habilitado=true where id;

set local role authenticated;
set local request.jwt.claims='{{"sub":"{USER_A}","role":"authenticated","user_role":"superadmin"}}';
do $$
declare v_anchor date:=date_trunc('week',current_date::timestamp)::date+14;v_week date;v_start timestamptz;v_id uuid;
begin
 for i in 1..501 loop
   v_week:=v_anchor+(7*(i+2));
   v_start:=(v_week+1+time '12:00') at time zone 'America/Sao_Paulo';
   v_id:=('16670000-0000-4000-8000-'||lpad(to_hex(i+2000),12,'0'))::uuid;
   perform pcm.sso_gerar_visita_ou_suprimir(
     '{USER_A}',
     ('16670000-0000-4000-8000-'||lpad(to_hex(i+4000),12,'0'))::uuid,
     '{CLIENT_A_ID}','{SERIES_ID}','{RULE_ID}',v_week,v_id,v_start,null,
     'Fixture sintética de 501 Visitas S166 V2; sem integração Auvo');
 end loop;
end $$;
"""
    atestar()
    sql(setup.encode("utf-8"), "fixture sintética S166 V2")
    atestar()

    confirmacao = query(
        "select (select count(*) from auth.users)=2 and "
        "(select count(*) from pcm.clientes where id in ('" + CLIENT_A_ID + "','" + CLIENT_B_ID + "'))=2 and "
        "(select count(*) from pcm.visita_origem_contratual where serie_id='" + SERIES_ID + "')=501 and "
        "(select count(*) from pcm.sso_mudanca_dia_v2_gate where habilitado and max_itens=600 and max_bytes=1048576 and ttl_seconds=3600)=1"
    ).strip()
    if confirmacao != "t":
        raise RuntimeError("Fixture S166 V2 não confirmou os dados sintéticos esperados")

    contrato = query("select id::text from comercial.contratos where proposta_id='" + PROPOSAL_ID + "'").strip()
    vigencia = query("select (date_trunc('week',current_date::timestamp)::date+35)::text").strip()
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", contrato) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", vigencia):
        raise RuntimeError("Contrato ou vigência da fixture S166 inválidos")
    atestar()
    return {
        "emailA": EMAIL_A,
        "emailB": EMAIL_B,
        "senha": senha,
        "clienteA": CLIENT_A_NAME,
        "clienteB": CLIENT_B_NAME,
        "contrato": contrato,
        "diaNovo": "3",
        "vigencia": vigencia,
    }
