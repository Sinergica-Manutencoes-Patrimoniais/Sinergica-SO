-- Executar em transação com migrations até 1650, em banco sintético; reverter.
\ir manual_E01-S166_fila_visita_fixture.sql
update pcm.sso_fila_visita_gate set habilitado=true where id;
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16610000-0000-0000-0000-000000000001','chamado.os.criar','16610000-0000-0000-0000-00000000000a');
set local role authenticated;
select pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000191','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','incluir',0,'fonte conferida');
do $$ begin
 if (select situacao_atual from pcm.sso_consultar_fila_visita_v2('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161')) is distinct from 'conferida' then raise exception 'fonte_elegivel_nao_conferida';end if;
 if (select situacao_atual from pcm.sso_listar_fila_visita_cronologica_v2('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',null,null,null,null,null,20)) is distinct from 'conferida' then raise exception 'lista_elegivel_divergente';end if;
end; $$;
reset role;
update pcm.ocorrencias_preventivas set envio_estado='falha' where id=(select ocorrencia_legada_id from pcm.sso_vinculos_visita_legado where ocorrencia_visita_id='16610000-0000-0000-0000-000000000161');
set local role authenticated;
do $$ begin
 if (select situacao_atual from pcm.sso_consultar_fila_visita_v2('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161')) is distinct from 'verificacao' then raise exception 'fonte_mudada_nao_detectada';end if;
 if (select situacao_atual from pcm.sso_listar_fila_visita_cronologica_v2('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',null,null,null,null,null,20)) is distinct from 'verificacao' then raise exception 'lista_fonte_mudada_nao_detectada';end if;
 begin perform pcm.sso_criar_chamado_ciclo_visita('16610000-0000-0000-0000-000000000192','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161');raise exception 'chamado_com_fonte_alterada_aceito';exception when check_violation then if sqlerrm<>'fila_visita_fonte_alterada' then raise;end if;end;
end; $$;
select pcm.sso_alterar_fila_visita('16610000-0000-0000-0000-000000000193','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','cancelar',1,'não enviar');
do $$ begin
 if (select situacao_atual from pcm.sso_consultar_fila_visita_v2('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161')) is distinct from 'cancelada' then raise exception 'cancelamento_nao_apresentado';end if;
 begin perform pcm.sso_criar_chamado_ciclo_visita('16610000-0000-0000-0000-000000000194','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161');raise exception 'chamado_cancelado_aceito';exception when check_violation then if sqlerrm<>'fila_visita_nao_aguardando' then raise;end if;end;
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_consultar_fila_visita_v2(uuid,uuid,uuid)','execute') or has_function_privilege('anon','pcm.sso_listar_fila_visita_cronologica_v2(uuid,uuid,text,date,date,date,uuid,integer)','execute') then raise exception 'acl_anon_indevida';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;
