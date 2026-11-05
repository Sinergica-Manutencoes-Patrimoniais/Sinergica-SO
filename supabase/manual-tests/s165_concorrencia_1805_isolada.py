"""Ensaios destrutivos somente no clone atestado e descartado pelo harness.

Chamador deve garantir watchdog, rede interna sem saída, cron desligado e limpeza integral.
Não executa por conta própria; não use contra bancos existentes.
"""
import json
import re
import subprocess
from pathlib import Path

from s176_runner_concorrencia import Sessao

IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.141"
ACTOR = "18050010-0000-4000-8000-000000000001"
CLIENTE = "18050010-0000-4000-8000-00000000000a"
SISTEMA = "18050010-0000-4000-8000-000000000051"
CLAIMS = '{"sub":"' + ACTOR + '","role":"authenticated","user_role":"superadmin"}'


def docker(*args):
    p = subprocess.run(["rtk", "proxy", "docker", *args], capture_output=True, timeout=15)
    if p.returncode:
        raise RuntimeError("Inspeção de isolamento indisponível")
    return p.stdout.decode()


def atestar(container):
    if not re.fullmatch(r"sso-recorte-[0-9a-f]{12}-db", container):
        raise RuntimeError("Nome do clone incompatível")
    ident = container.removeprefix("sso-recorte-").removesuffix("-db")
    rede = "sso-recorte-" + ident
    c = json.loads(docker("inspect", "--type", "container", container))[0]
    n = json.loads(docker("inspect", "--type", "network", rede))[0]
    if (c["Name"] != "/" + container or c["Config"]["Image"] != IMAGE
        or c["Config"].get("Labels", {}).get("sso.recorte") != ident
        or c["HostConfig"].get("Privileged") or c["HostConfig"].get("NetworkMode") != rede
        or c["HostConfig"].get("PortBindings") or c["Mounts"]
        or set(c["NetworkSettings"]["Networks"]) != {rede}
        or any(c["NetworkSettings"].get("Ports", {}).values())
        or n["Name"] != rede or not n.get("Internal") or n.get("Labels", {}).get("sso.recorte") != ident):
        raise RuntimeError("Identidade ou rede do clone divergente")
    # O nome aleatório, rótulos e inspeção não substituem a limpeza do chamador.


def executar(container, watchdog):
    atestar(container)
    if watchdog.is_set():
        raise RuntimeError("Monitor interrompeu o ensaio")
    a = Sessao(container)
    b = None
    try:
        b = Sessao(container)
        a.comando("""do $$ begin
          if exists(select 1 from auth.users) or exists(select 1 from pcm.clientes)
             or exists(select 1 from pcm.planos_manutencao) or exists(select 1 from pcm.plano_comandos)
          then raise exception 'clone_nao_vazio'; end if;
          if current_setting('cron.launch_active_jobs',true) is distinct from 'off' then
            raise exception 'cron_nao_desligado'; end if;
        end $$;""")
        a.comando("begin;")
        a.comando("set local app.auvo_sync_write='true';")
        a.comando("""insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
          values ('18050010-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concorrencia-1805@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());""")
        a.comando("insert into config.usuarios(user_id,papel,nome,ativo) values ('"+ACTOR+"','superadmin','Concorrência sintética',true);")
        a.comando("insert into pcm.clientes(id,nome,ativo,created_by) values ('"+CLIENTE+"','Cliente sintético',true,'"+ACTOR+"');")
        a.comando("insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('"+ACTOR+"','plano.gerir','"+CLIENTE+"');")
        a.comando("insert into pcm.sistemas(id,cliente_id,nome) values ('"+SISTEMA+"','"+CLIENTE+"','Sistema sintético');")
        a.comando("update pcm.sso_aprovacao_versao_esperada_gate set habilitado=true where id;")
        a.comando("update pcm.sso_exigir_versao_aprovacao_gate set habilitado=true where id;")
        a.comando("set local role authenticated;")
        a.comando("set local request.jwt.claims='"+CLAIMS+"';")
        for i in range(1, 5):
            plano = f"18050000-0000-4000-8000-{i:012d}"
            rotina = f"18050001-0000-4000-8000-{i:012d}"
            r1 = f"18050002-0000-4000-8000-{i:012d}"
            r2 = f"18050003-0000-4000-8000-{i:012d}"
            r3 = f"18050004-0000-4000-8000-{i:012d}"
            a.comando(f"select pcm.sso_salvar_plano_rascunho('{r1}',0,'{plano}','{CLIENTE}','Plano sintético {i}');")
            a.comando(f"select pcm.sso_adicionar_rotina_rascunho_v2('{r2}',1,'{plano}','{rotina}','Rotina mensal','sistema','{SISTEMA}','calendario',1,'meses',current_date,30,0,0,'Inspecionar',null,'total');")
            a.comando(f"select pcm.sso_transicionar_revisao_plano('{r3}',2,'{plano}','submeter');")
        a.comando("reset role;")
        a.comando("create table public.sso_1805_versoes_fixture as select plano_id,id as versao_id from pcm.plano_versoes where plano_id::text like '18050000-0000-4000-8000-%' and estado='rascunho';")
        a.comando("do $$ begin if (select count(*) from public.sso_1805_versoes_fixture)<>4 then raise exception 'versoes_fixture_invalidas'; end if; end $$;")
        a.comando("commit;")

        def iniciar(s):
            s.comando("begin;")
            s.comando("set local lock_timeout='2s';")
            s.comando("set local app.auvo_sync_write='true';")
            s.comando("set local role authenticated;")
            s.comando("set local request.jwt.claims='"+CLAIMS+"';")

        def aprovar(i):
            plano = f"18050000-0000-4000-8000-{i:012d}"
            pedido = f"18050005-0000-4000-8000-{i:012d}"
            # Função mediada recebe versão capturada antes das corridas, não consulta versão atual.
            return ("select pcm.sso_aprovar_versao_esperada('"+ACTOR+"','"+CLIENTE+"','"+pedido+"',3,'"+plano+"',"
                    "(select versao_id from public.sso_1805_versoes_fixture where plano_id='"+plano+"'),current_date,false);")

        def devolver(i):
            return f"select pcm.sso_transicionar_revisao_plano('18050006-0000-4000-8000-{i:012d}',3,'18050000-0000-4000-8000-{i:012d}','devolver');"

        # Leitura controlada dessa tabela sintética por authenticated; sem dados de outros clientes.
        a.comando("grant select on public.sso_1805_versoes_fixture to authenticated;")
        iniciar(a); a.comando(devolver(1)); iniciar(b); b.comando(aprovar(1), ("55P03",)); b.comando("rollback;")
        a.comando("commit;"); iniciar(b); b.comando(aprovar(1), ("P0011",)); b.comando("rollback;")
        iniciar(a); a.comando(aprovar(2)); iniciar(b); b.comando(devolver(2), ("55P03",)); b.comando("rollback;")
        a.comando("commit;"); iniciar(b); b.comando(devolver(2), ("40001", "P0011")); b.comando("rollback;")

        def concessao(ativa, revisao, sufixo):
            valor = "true" if ativa else "false"
            return (f"select config.sso_definir_concessao('18050007-0000-4000-8000-{sufixo:012d}',{revisao},"
                    f"'{ACTOR}',null,'plano.gerir','{CLIENTE}',{valor},'Ensaio sintético');")

        iniciar(a); a.comando(concessao(False, 0, 1)); iniciar(b); b.comando(aprovar(3), ("55P03",)); b.comando("rollback;")
        a.comando("commit;"); iniciar(b); b.comando(aprovar(3), ("42501",)); b.comando("rollback;")
        iniciar(a); a.comando(concessao(True, 1, 2)); a.comando("commit;")
        iniciar(a); a.comando(aprovar(4)); iniciar(b); b.comando(concessao(False, 2, 3), ("55P03",)); b.comando("rollback;")
        a.comando("commit;"); iniciar(b); b.comando(concessao(False, 2, 3)); b.comando("commit;")
        iniciar(a); a.comando(aprovar(4), ("42501",)); a.comando("rollback;")
        a.comando("""do $$ begin
          if exists(select 1 from pcm.plano_comandos where request_id in
            ('18050005-0000-4000-8000-000000000001','18050005-0000-4000-8000-000000000003'))
          or (select count(*) from pcm.plano_comandos where request_id in
            ('18050005-0000-4000-8000-000000000002','18050005-0000-4000-8000-000000000004'))<>2
          or exists(select 1 from pcm.sso_aprovacao_versao_tokens)
          then raise exception 'resultado_ou_token_divergente'; end if;
        end $$;""")
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu o ensaio")
        print("Concorrência 1805: revisão e revogação em ambas ordens; clone exige descarte.", flush=True)
    finally:
        if b is not None:
            b.fechar()
        a.fechar()
