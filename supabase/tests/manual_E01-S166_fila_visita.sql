-- Executar após migrations até 1647, em transação de banco sintético; reverter.
\ir manual_E01-S166_fila_visita_fixture.sql
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
update pcm.sso_fila_visita_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');
 b:=pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');
 if a is distinct from b or a->>'estado'<>'aguardando' or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'inclusao_ou_replay_divergente: %',a;end if;
 if (select count(*) from pcm.sso_consultar_fila_visita('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161') where estado='aguardando')<>1 then raise exception 'fila_nao_consultavel';end if;
 begin perform pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'outro motivo');raise exception 'conflito_aceito';exception when unique_violation then null;end;
 b:=pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000192','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','cancelar',1,'cancelada na fila');
 if b->>'estado'<>'cancelado' then raise exception 'cancelamento_divergente';end if;
 begin perform pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000193','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'nova tentativa');raise exception 'cancelada_reincluida';exception when unique_violation then null;end;
end; $$;
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ begin begin perform pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');raise exception 'replay_revogado_aceito';exception when insufficient_privilege then null;end;end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_alterar_fila_visita(uuid,uuid,uuid,uuid,text,integer,text)','execute') then raise exception 'acl_anon_indevida';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
