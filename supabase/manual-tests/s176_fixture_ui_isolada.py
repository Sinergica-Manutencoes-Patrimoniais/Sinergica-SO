"""Identidade e categoria sintéticas; apenas em clone atestado pelo chamador."""
import re
import secrets


def executar(sql, query, inspect, ident, rede, containers, watchdog):
    if not re.fullmatch(r"[0-9a-f]{12}", ident) or rede != "sso-recorte-" + ident:
        raise RuntimeError("Identidade S176 inválida")
    if set(containers) != {"db", "auth", "rest"}:
        raise RuntimeError("Serviços S176 incompletos")
    rede_info = inspect("network", rede)
    if (not rede_info.get("Internal") or rede_info.get("Ingress") or rede_info.get("Driver") != "bridge"
            or rede_info.get("Labels", {}).get("sso.recorte") != ident):
        raise RuntimeError("Rede S176 não atestada")
    for papel, nome in containers.items():
        if nome != rede + "-" + papel:
            raise RuntimeError("Nome S176 divergente")
        c = inspect("container", nome)
        if (c["Name"] != "/" + nome or c["Config"].get("Labels", {}).get("sso.recorte") != ident
                or not c["State"].get("Running") or c["HostConfig"].get("Privileged")
                or c["HostConfig"].get("NetworkMode") != rede or c.get("Mounts")
                or set(c["NetworkSettings"]["Networks"]) != {rede}
                or any(c["NetworkSettings"].get("Ports", {}).values())):
            raise RuntimeError("Serviço S176 fora do clone")
    if watchdog.is_set() or query("select current_setting('cron.launch_active_jobs',true)").strip() != "off":
        raise RuntimeError("Monitor ou cron S176 inválido")
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0").strip() != "t":
        raise RuntimeError("Clone S176 não está vazio")
    senha = secrets.token_hex(32)
    dados = f"""
set local search_path=public,extensions;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('17691000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s176-ui@example.test',crypt('{senha}',gen_salt('bf')),now(),'{{}}','{{}}',now(),now());
update auth.users set confirmation_token='',recovery_token='',email_change='',email_change_token_new=''
 where id='17691000-0000-4000-8000-000000000001';
select config.provisionar_usuario('17691000-0000-4000-8000-000000000001','superadmin','Operador sintético S176');
insert into config.sso_concessoes(usuario_id,acao,cliente_id,ativa,revisao) values
 ('17691000-0000-4000-8000-000000000001','cadastro.ler',null,true,1),
 ('17691000-0000-4000-8000-000000000001','cadastro.gerir',null,true,1),
 ('17691000-0000-4000-8000-000000000001','plano.gerir',null,true,1);
insert into pcm.equipamento_categorias(id,nome) values ('17691000-0000-4000-8000-000000000002','Categoria sintética S176');
update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;
update pcm.sso_planos_por_alvo_gate set habilitado=true where id;
"""
    sql(dados.encode(), "fixture UI S176 sintética")
    if watchdog.is_set() or query("select count(*) from config.usuarios where user_id='17691000-0000-4000-8000-000000000001' and ativo and papel='superadmin'").strip() != "1":
        raise RuntimeError("Identidade sintética S176 não comprovada")
    if query("select count(*) from config.sso_concessoes where usuario_id='17691000-0000-4000-8000-000000000001' and ativa and acao in ('cadastro.ler','cadastro.gerir','plano.gerir')").strip() != "3":
        raise RuntimeError("Capacidades sintéticas S176 não comprovadas")
    return {"email": "s176-ui@example.test", "senha": senha}
