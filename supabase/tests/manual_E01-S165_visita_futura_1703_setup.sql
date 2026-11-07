-- Clone com BEGIN/ROLLBACK. Somente preparação sintética: datas ajustadas via replica.
-- Nenhuma aprovação, OS, envio ou alteração de banco real é feita aqui.
\ir manual_E01-S165_impacto_visita_fila_1705.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
set local session_replication_role=replica;
update pcm.visitas set inicio_em=((date_trunc('week',current_date+14)::date+4)::text||' 11:00+00')::timestamptz,fim_em=((date_trunc('week',current_date+14)::date+4)::text||' 13:00+00')::timestamptz where id='16610000-0000-0000-0000-000000000081';
update pcm.visita_origem_contratual set semana_origem=date_trunc('week',current_date+14)::date where visita_id='16610000-0000-0000-0000-000000000081';
update pcm.ocorrencias_visita_preparadas set semana_origem=date_trunc('week',current_date+14)::date,vencimento_original=date_trunc('week',current_date+14)::date+4 where id='16610000-0000-0000-0000-000000000161';
update pcm.sso_ciclos_visita_canonicos set semana_origem=date_trunc('week',current_date+14)::date where id=(select ciclo_id from pcm.sso_ciclo_visita_versoes where preparada_id='16610000-0000-0000-0000-000000000161');
update pcm.visitas set inicio_em=((date_trunc('week',current_date+14)::date+11)::text||' 11:00+00')::timestamptz,fim_em=((date_trunc('week',current_date+14)::date+11)::text||' 13:00+00')::timestamptz where id='16610000-0000-0000-0000-000000000083';
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por) values ('16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000051','16610000-0000-0000-0000-000000000061','16610000-0000-0000-0000-000000000071',date_trunc('week',current_date+14)::date+7,'16610000-0000-0000-0000-000000000001');
set local session_replication_role=origin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select pcm.sso_transicionar_revisao_plano('16610000-0000-0000-0000-000000000240',2,'16610000-0000-0000-0000-000000000121','submeter');
do $$ declare f jsonb;r jsonb;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3,'16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161','visita');
 r:=pcm.sso_escolher_nova_visita('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000231','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181','16610000-0000-0000-0000-000000000161',3,1,'16610000-0000-0000-0000-000000000083',date_trunc('week',current_date+14)::date+11,'calendário de campo','escolha futura',f);
 if r->>'substituicaoAplicada'<>'false' then raise exception 'escolha_divergente';end if;
end; $$;
reset role;
