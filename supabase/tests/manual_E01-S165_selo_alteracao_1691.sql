-- Clone descartável, BEGIN/ROLLBACK; token em tabela temporária, não testa aprovação real.
-- Trigger incondicional 1045 da tabela oficial permanece intacto.
\ir manual_E01-S165_escolha_alteracao_1691.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
create temporary table token_alteracao_1691 (txid bigint,plano_id uuid,versao_anterior_id uuid,vigencia_inicio date);
create trigger selo_1691 after insert on token_alteracao_1691 for each row execute function pcm.sso_selar_alteracoes_ciclo_aprovadas();
insert into token_alteracao_1691 values(txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date);
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 if not exists(select 1 from pcm.sso_versoes_operacionais_ciclo where tipo='calendario' and preparada_id=p and versao_id='16630000-1111-4000-8000-000000000022' and decisao_request_id='16630000-1111-4000-8000-000000000591') then raise exception 'selo_ausente';end if;
 if (select versao_id from pcm.ocorrencias_rotina_preparadas where id=p) is distinct from '16630000-1111-4000-8000-000000000021'::uuid then raise exception 'origem_alterada';end if;
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date);raise exception '1045_nao_bloqueou';exception when check_violation then if sqlerrm<>'aprovacao_bloqueada_impacto_e_fuso_nao_comprovados' then raise;end if;end;
end; $$;
