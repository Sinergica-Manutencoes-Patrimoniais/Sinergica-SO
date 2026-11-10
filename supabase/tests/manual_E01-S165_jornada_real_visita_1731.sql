-- 1045 real; dados e relógio sintéticos; clone descartável e rollback.
-- Clone, BEGIN/ROLLBACK: 1045 real; relógio simulado somente após aprovação.
-- Não comprova aprovação operacional, fontes externas ou concorrência.
begin;
\ir manual_E01-S165_visita_rascunho_1723.sql

reset role;
update pcm.aprovacao_revisao_gate set habilitado=true where id;
update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado) values ('16610000-0000-0000-0000-000000000704','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',1,'UTC','fixture','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
set local role authenticated;
select pcm.sso_classificar_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000705','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000152',3,0,'nao_relacionado','documento','obrigação distinta',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3,null,20)));
reset role;
-- 1045 real, sem troca temporária. Gate de continuidade desligado deve bloquear.
update pcm.sso_continuidade_revisao_gate set habilitado=false where id;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17310000-0000-0000-0000-000000000011',3,'16610000-0000-0000-0000-000000000121',current_date+1);raise exception 'gate_desligado_aceito';exception when sqlstate '55000' then null;end;
end $$;
reset role;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17310000-0000-0000-0000-000000000012',3,'16610000-0000-0000-0000-000000000121',current_date+1);raise exception 'gate_1731_desligado_aceito';exception when sqlstate '55000' then if sqlerrm<>'protocolo_1731_desabilitado' then raise;end if;end;
end $$;
reset role;
update pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id;
-- Permissão revogada e trigger obrigatório desabilitado recusam aprovação.
update config.sso_concessoes set ativa=false where usuario_id='16610000-0000-0000-0000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17310000-0000-0000-0000-000000000013',3,'16610000-0000-0000-0000-000000000121',current_date+1);raise exception 'permissao_revogada_aceita';exception when insufficient_privilege then null;end;
end $$;
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='plano.gerir';
alter table pcm.aprovacao_revisao_tokens disable trigger sso_exigir_comparacao_questionario_aprovacao;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','17310000-0000-0000-0000-000000000014',3,'16610000-0000-0000-0000-000000000121',current_date+1);raise exception 'validador_desabilitado_aceito';exception when sqlstate '55000' then if sqlerrm<>'validadores_revisao_indisponiveis' then raise;end if;end;
end $$;
reset role;
alter table pcm.aprovacao_revisao_tokens enable trigger sso_exigir_comparacao_questionario_aprovacao;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000706',3,'16610000-0000-0000-0000-000000000121',current_date+1);
 b:=pcm.sso_aprovar_revisao_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000706',3,'16610000-0000-0000-0000-000000000121',current_date+1);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'aprovacao_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_substituicoes_visita_aprovadas where escolha_request_id='16610000-0000-0000-0000-000000000231' and versao_id='16610000-0000-0000-0000-000000000181') then raise exception 'selo_ausente';end if;
end; $$;

reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id='16610000-0000-0000-0000-000000000935' and modo='visita') then raise exception 'selo_visita_ausente';end if;
 if pcm.sso_reserva_rascunho_vigente('16610000-0000-0000-0000-000000000930',0,null,null) is not null then raise exception 'reserva_antes_vigencia_ativa';end if;
end; $$;
-- Avanço civil apenas no clone e na transação, mantendo todas as demais guardas.
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+1;$b$;begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_fixture_incompativel';end if;execute replace(d,a,b);
end; $$;
do $$ declare r jsonb;begin
 r:=pcm.sso_reserva_rascunho_vigente('16610000-0000-0000-0000-000000000930',0,null,null);
 if r is null or r->>'modo'<>'visita' or r->>'decisao'<>'somente_sso' then raise exception 'reserva_apos_vigencia_divergente: %',r;end if;
end; $$;

create temporary table fixture1705_revisao as select p.revisao,e.rotina_id from pcm.planos_manutencao p join pcm.sso_escolhas_nova_data_visita e on e.plano_id=p.id where e.request_id='16610000-0000-0000-0000-000000000231' and p.id='16610000-0000-0000-0000-000000000121';
grant select on fixture1705_revisao to authenticated;
set local role authenticated;
do $$ declare r jsonb;rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1705_revisao;
 begin
  perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
  raise exception 'geracao_com_fila_antiga_aceita';
 exception when check_violation then if sqlerrm<>'origem_antiga_exige_reconciliacao' then raise;end if;end;
end; $$;
do $$ declare a jsonb;b jsonb;g jsonb;g2 jsonb;rev integer;rot uuid;begin
 select revisao,rotina_id into rev,rot from fixture1705_revisao;
 a:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000262','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 b:=pcm.sso_aplicar_retiradas_fila('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000262','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',50,null,null);
 if a is distinct from b or (a->>'canceladas')::integer<>1 or a->>'osAlteradas'<>'false' then raise exception 'retirada_replay_divergente: %',a;end if;
 g:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
 g2:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000260','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000261','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',rot,'16610000-0000-0000-0000-000000000083',rev,'fonte campo');
 if g is distinct from g2 or g->>'osCriada'<>'false' or g->>'tarefaAuvoCriada'<>'false' then raise exception 'geracao_replay_divergente: %',g;end if;
end; $$;
reset role;
do $$ begin
 if (select estado from pcm.sso_fila_visita where preparada_id='16610000-0000-0000-0000-000000000161')<>'cancelado' then raise exception 'fila_antiga_nao_retirada';end if;
 if (select count(*) from pcm.sso_substituicoes_visita_materializadas where escolha_request_id='16610000-0000-0000-0000-000000000231' and preparada_antiga_id='16610000-0000-0000-0000-000000000161' and preparada_nova_id='16610000-0000-0000-0000-000000000261')<>1 then raise exception 'associacao_ausente_ou_duplicada';end if;
 if (select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121')<>2 then raise exception 'historico_ou_nova_duplicada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

rollback;
