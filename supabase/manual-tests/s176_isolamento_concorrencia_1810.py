"""Ensaio sintético para clone descartável; chamador deve destruir o banco inteiro."""
from s176_runner_concorrencia import Sessao

ATOR = "18110000-0000-4000-8000-000000000001"
CLIENTE = "18110000-0000-4000-8000-000000000002"
SISTEMA = "18110000-0000-4000-8000-000000000003"
CLAIMS = '{"sub":"' + ATOR + '","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"leitura"}}'
LEITURA = "select pcm.sso_listar_composicao_estrutura_176('" + ATOR + "','" + CLIENTE + "','sistemas',null,null,false,0);"
LEITURA_UM = "do $$ begin if jsonb_array_length(pcm.sso_listar_composicao_estrutura_176('" + ATOR + "','" + CLIENTE + "','sistemas',null,null,false,0)) <> 1 then raise exception 'quantidade_divergente'; end if; end $$;"
REVOGAR = "update config.sso_concessoes set ativa=false where usuario_id='" + ATOR + "' and cliente_id='" + CLIENTE + "' and acao='cadastro.ler';"


def executar(container, watchdog):
    """Nenhum retry ou limpeza parcial: sucesso ou falha exigem descarte do clone."""
    a = Sessao(container)
    b = None
    try:
        b = Sessao(container)
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu ensaio 1810")
        a.comando("""do $$ begin
          if exists(select 1 from auth.users where id='""" + ATOR + """')
             or exists(select 1 from pcm.clientes where id='""" + CLIENTE + """')
             or exists(select 1 from pcm.sistemas where id='""" + SISTEMA + """')
             or (select habilitado from config.sso_estrutura_cliente_leitura_gate where id) is distinct from false
          then raise exception 'clone_ou_gate_invalido'; end if; end $$;""")
        a.comando("begin;")
        a.comando("set local app.auvo_sync_write='true';")
        a.comando("""insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
          values ('""" + ATOR + """','00000000-0000-0000-0000-000000000000','authenticated','authenticated','concorrencia-1810@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());""")
        a.comando("insert into config.usuarios(user_id,papel,nome,ativo) values ('" + ATOR + "','colaborador','Ator sintético',true);")
        a.comando("insert into config.usuario_modulos(user_id,modulo,nivel) values ('" + ATOR + "','pcm','leitura');")
        a.comando("insert into pcm.clientes(id,nome,ativo,created_by) values ('" + CLIENTE + "','Cliente sintético',true,'" + ATOR + "');")
        a.comando("insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('" + ATOR + "','cadastro.ler','" + CLIENTE + "');")
        a.comando("insert into pcm.sistemas(id,cliente_id,nome) values ('" + SISTEMA + "','" + CLIENTE + "','Sistema sintético');")
        a.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;")
        a.comando("commit;")

        def autenticada(sessao):
            sessao.comando("begin;")
            sessao.comando("set local role authenticated;")
            sessao.comando("set local request.jwt.claims = '" + CLAIMS + "';")

        def conferir_monitor():
            if watchdog.is_set():
                raise RuntimeError("Monitor interrompeu ensaio 1810")

        # Gate primeiro: leitura NOWAIT falha; após commit gate fechado é negado.
        a.comando("begin;")
        a.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;")
        autenticada(b)
        b.comando(LEITURA, ("55P03",))
        b.comando("rollback;")
        a.comando("commit;")
        autenticada(b)
        b.comando(LEITURA, ("55000",))
        b.comando("rollback;")
        a.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;")
        conferir_monitor()

        # Leitura primeiro: UPDATE do gate aguarda até lock_timeout.
        autenticada(a)
        a.comando(LEITURA_UM)
        b.comando("begin;")
        b.comando("set local lock_timeout='2s';")
        b.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;", ("55P03",))
        b.comando("rollback;")
        a.comando("commit;")
        b.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;")
        autenticada(a)
        a.comando(LEITURA, ("55000",))
        a.comando("rollback;")
        b.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=true where id;")
        conferir_monitor()

        # Revogação primeiro: trava de autorização recusa leitura concorrente.
        a.comando("begin;")
        a.comando(REVOGAR)
        autenticada(b)
        b.comando(LEITURA, ("55P03",))
        b.comando("rollback;")
        a.comando("commit;")
        autenticada(b)
        b.comando(LEITURA, ("42501",))
        b.comando("rollback;")
        a.comando("update config.sso_concessoes set ativa=true where usuario_id='" + ATOR + "' and cliente_id='" + CLIENTE + "' and acao='cadastro.ler';")
        conferir_monitor()

        # Leitura primeiro: trigger de autorização recusa UPDATE concorrente.
        autenticada(a)
        a.comando(LEITURA_UM)
        b.comando("begin;")
        b.comando(REVOGAR, ("55P03",))
        b.comando("rollback;")
        a.comando("commit;")
        b.comando(REVOGAR)
        autenticada(a)
        a.comando(LEITURA, ("42501",))
        a.comando("rollback;")
        b.comando("""do $$ begin
          if (select count(*) from pcm.sistemas where id='""" + SISTEMA + """' and cliente_id='""" + CLIENTE + """') <> 1
             or (select count(*) from config.sso_concessoes where usuario_id='""" + ATOR + """' and cliente_id='""" + CLIENTE + """' and acao='cadastro.ler' and not ativa) <> 1
          then raise exception 'invariante_divergente'; end if; end $$;""")
        b.comando("update config.sso_estrutura_cliente_leitura_gate set habilitado=false where id;")
        b.comando("do $$ begin if (select habilitado from config.sso_estrutura_cliente_leitura_gate where id) is distinct from false then raise exception 'gate_nao_fechado'; end if; end $$;")
        print("Concorrência 1810: quatro ordens verificadas; clone deve ser descartado.", flush=True)
    finally:
        try:
            if b is not None:
                b.fechar()
        finally:
            a.fechar()
