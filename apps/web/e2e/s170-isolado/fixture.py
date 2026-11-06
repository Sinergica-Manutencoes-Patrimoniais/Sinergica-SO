"""Fixture S170: chamada somente pelo bootstrap que atesta clone isolado.

Este módulo não abre conexões, portas nem serviços. O bootstrap deve atestar rede
interna/loopback, Auth e banco descartáveis, e destruir o clone inclusive em erro.
A senha gerada fica apenas na memória do processo e do Auth sintético.
"""
import hashlib
import secrets
from pathlib import Path

ATOR = "16891000-0000-4000-8000-000000000001"
CLIENTE_A = "16891000-0000-4000-8000-000000000002"
CLIENTE_B = "17020000-0000-4000-8000-00000000000b"
RETORNO = "16891000-0000-4000-8000-000000000018"
EMAIL = "s168-fechamento@example.test"
ORIGEM_SHA = "429cccd18ec2b47d4b8819550df72223d9a1281cb08db1fa6a32b7dee2f72d40"


def preparar(root: Path, sql, query, watchdog, atestar):
    """Cria fixture via callbacks do bootstrap; não autentica nem testa interface."""
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu fixture S170")
    if atestar() is not True: raise RuntimeError("Isolamento do bootstrap não comprovado")
    if query("select current_setting('cron.launch_active_jobs',true)").strip() != "off":
        raise RuntimeError("Cron não está desligado")
    if query("select (select count(*) from auth.users)=0 and (select count(*) from pcm.clientes)=0 and (select count(*) from vault.secrets)=0").strip() != "t":
        raise RuntimeError("Clone não está vazio")
    origem = (root / "supabase/tests/manual_E01-S168_origem_http_sintetica.sql").read_bytes()
    if hashlib.sha256(origem).hexdigest() != ORIGEM_SHA: raise RuntimeError("Origem S168 divergente")
    senha = secrets.token_hex(32)
    # Todos os interpolados são constantes internas ou hexadecimal gerado aqui.
    setup = f"""
update auth.users set encrypted_password=crypt('{senha}',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='' where id='{ATOR}';
update config.usuarios set papel='colaborador' where user_id='{ATOR}';
insert into config.usuario_modulos(user_id,modulo,nivel) values('{ATOR}','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values('{CLIENTE_B}','Cliente B sintético',true,'{ATOR}');
insert into config.usuario_cliente(user_id,cliente_id) values('{ATOR}','{CLIENTE_A}');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('{ATOR}','plano.gerir','{CLIENTE_A}');
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_validacao_resposta_gate set habilitado=true where id;
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.sso_conferencia_cobertura_retorno_gate set habilitado=true where id;
update pcm.sso_condicao_retorno_gate set habilitado=true where id;
update pcm.sso_condicao_evidencia_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
update pcm.sso_pendencias_gate set habilitado=true where id;
update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;
update pcm.sso_mediacao_decisao_retorno_gate set habilitado=true where id;
update pcm.sso_classificacao_retorno_mediada_gate set leitura=true,escrita=true where id;
update pcm.clientes set auvo_id=168910001 where id='{CLIENTE_A}';
update pcm.ordens_servico set auvo_task_id=168910002 where id='16891000-0000-4000-8000-000000000017';
insert into pcm.origem_campo_inbox(id,integracao,task_id,chave_evento,cliente_externo_id,payload) values ('16891000-0000-4000-8000-000000000035','auvo',168910002,'origem-s170-sintetica','168910001','{{}}');
insert into pcm.origem_campo_resolucoes(id,envelope_id,cliente_id,os_id,resultado) values ('16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000035','{CLIENTE_A}','16891000-0000-4000-8000-000000000017','os_identificada');
insert into pcm.retorno_campo_classificacoes(envelope_id,resolucao_id,retorno_id,request_id,ator_id,payload) values ('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','{RETORNO}','16891000-0000-4000-8000-000000000037','{ATOR}','{{}}');
"""
    # sql é a função do bootstrap, que aplica uma transação e nunca ecoa SQL/senha.
    sql(b"set local search_path=public,extensions;\n" + origem + setup.encode(), "fixture S170 sintética")
    if watchdog.is_set() or atestar() is not True: raise RuntimeError("Isolamento da fixture S170 não confirmado")
    if query("select count(*) from config.usuarios u join config.usuario_modulos m on m.user_id=u.user_id where u.user_id='"+ATOR+"' and u.ativo and u.papel='colaborador' and m.modulo='pcm' and m.nivel='escrita'").strip() != "1":
        raise RuntimeError("Perfil S170 sintético divergente")
    if query("select count(*) from config.sso_concessoes where usuario_id='"+ATOR+"' and ativa and ((acao='plano.gerir' and cliente_id='"+CLIENTE_A+"') or (acao='execucao.validar' and cliente_id='"+CLIENTE_A+"'))").strip() != "2":
        raise RuntimeError("Concessões S170 sintéticas divergentes")
    if query("select count(*) from config.sso_concessoes where usuario_id='"+ATOR+"' and ativa and cliente_id='"+CLIENTE_B+"'").strip() != "0":
        raise RuntimeError("Cliente B sintético possui concessão inesperada")
    return {"email": EMAIL, "senha": senha, "ator": ATOR, "clienteA": CLIENTE_A, "clienteB": CLIENTE_B, "retorno": RETORNO}
