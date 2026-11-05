-- Clone descartável, BEGIN/ROLLBACK. Função da guarda 1045 substituída somente nesta transação.
-- Não prova segurança integral nem autoriza homologação; demais validadores permanecem ativos.
\ir manual_E01-S165_visita_futura_1703_setup.sql
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
