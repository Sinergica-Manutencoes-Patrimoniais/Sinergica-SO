-- Clone, BEGIN/ROLLBACK: 1045 simulada somente nesta transação; relógio também simulado.
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
create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado() returns trigger language plpgsql security definer set search_path='' as $$ begin return new;end; $$;
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
-- Ocorrência legada criada antes da vigência, sem reserva operacional ativa.
select pcm.materializar_ocorrencias_preventivas('16610000-0000-0000-0000-000000000930',date_trunc('week',current_date+14)::date+11);
-- Avanço civil apenas no clone e na transação, mantendo todas as demais guardas.
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+1;$b$;begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_fixture_incompativel';end if;execute replace(d,a,b);
end; $$;
do $$ declare l uuid;f jsonb;r jsonb;v text;begin
 select id into strict l from pcm.ocorrencias_preventivas where plano_id='16610000-0000-0000-0000-000000000930' and indice=0;
 begin perform pcm.sso_reserva_rascunho_vigente('16610000-0000-0000-0000-000000000930',0,null,null);raise exception 'legada_sem_conferencia_aceita';exception when check_violation then if sqlerrm<>'efeito_legado_exige_reconciliacao' then raise;end if;end;
 execute 'set local role authenticated';
 f:=pcm.sso_prever_reconciliacao_legada_sso('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',l,'16610000-0000-0000-0000-000000000935')->'foto';
 r:=pcm.sso_reconciliar_legada_sso('16610000-0000-0000-0000-000000000001','17310000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',l,'16610000-0000-0000-0000-000000000935','Conferido',f);
 select estado into strict v from pcm.sso_estados_legadas_inertes('16610000-0000-0000-0000-00000000000a',array[l]);
 if v<>'substituida' then raise exception 'estado_visita_incorreto';end if;
 execute 'reset role';
 begin update pcm.ocorrencias_preventivas set envio_estado='enviando' where id=l;raise exception 'envio_indevido';exception when check_violation then null;end;
end; $$;
do $$ declare r jsonb;begin
 r:=pcm.sso_reserva_rascunho_vigente('16610000-0000-0000-0000-000000000930',0,null,null);
 if r is null or r->>'modo'<>'visita' or r->>'decisao'<>'somente_sso' then raise exception 'reserva_apos_vigencia_divergente: %',r;end if;
end; $$;

rollback;
