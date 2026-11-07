-- Clone descartável com migrations até 1717. Toda escrita revertida; não chama Auvo.
-- Data civil simulada somente dentro desta transação para a Visita histórica sintética.
begin;
\ir manual_E01-S165_impacto_visita_mediado.sql
reset role;
-- A fixture base inicia revisão e deixa o Plano em rascunho. A ponte exige Plano
-- aprovado; restaurar somente o estado sintético no clone, sem simular aprovação.
set local session_replication_role=replica;
update pcm.planos_manutencao set estado='aprovado' where id='16610000-0000-0000-0000-000000000121';
set local session_replication_role=origin;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
update pcm.sso_materializar_visita_legado_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
create or replace function pcm.sso_data_civil_versao_geracao(p_plano_id uuid,p_versao_id uuid)
returns date language sql stable security definer set search_path='' as $$ select date '2026-10-01' $$;
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values
 ('17140000-0000-4000-8000-000000000096','Tipo sintético',171400096,'16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values
 ('17140000-0000-4000-8000-000000000097','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000141','17140000-0000-4000-8000-000000000096','Legado sintético','2026-10-09','semanas',1,'ativo','16610000-0000-0000-0000-000000000001');
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- A base alterou o PMOC após a primeira classificação. Reclassificar pela API
-- real para a versão vigente, sem desativar a guarda de PMOC.
create temporary table sso_foto_pmoc_visita_fixture as select pcm.sso_foto_inventario_pmoc('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000152') foto;
grant select on sso_foto_pmoc_visita_fixture to authenticated;
set local role authenticated;
select pcm.sso_classificar_pmoc_ciclo('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000151','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123',2,'2026-10-09','16610000-0000-0000-0000-000000000152',1,(select foto from sso_foto_pmoc_visita_fixture),'Conferência sintética','Agendamento distinto','nao_relacionado');
select pcm.sso_declarar_relacao_legada_mediada('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000098','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'declarar','Relação explícita');

do $$ declare f jsonb; v jsonb; r jsonb; r2 jsonb; begin
 v:=pcm.sso_consultar_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161');
 f:=v->'fotoAtual';
 if f is null or v->>'dataLegado'<>'2026-10-09' or v->>'registrada'<>'false' then raise exception 'previa_incorreta: %',v;end if;
 begin
  perform pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000010','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','somente_sso',2,0,true,'Foto divergente',f||'{"intervalo":99}'::jsonb);
  raise exception 'foto_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'fotografia_obsoleta' then raise;end if; end;
 begin
  perform pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000099','17140000-0000-4000-8000-000000000011','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','somente_sso',2,0,true,'Ator divergente',f);
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform pcm.sso_consultar_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161');
  raise exception 'cliente_divergente_aceito';
 exception when insufficient_privilege then null; end;
 r:=pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','somente_sso',2,0,true,'PCM escolheu SSO',f);
 r2:=pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','somente_sso',2,0,true,'PCM escolheu SSO',f);
 if r->>'reservaId' is distinct from r2->>'reservaId' then raise exception 'replay_divergente';end if;
 r:=pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000002','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','somente_legado',2,1,true,'PCM escolheu legado',f);
end; $$;
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
set local role authenticated;
do $$ begin
 begin perform pcm.sso_consultar_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161');raise exception 'revogacao_ignorada';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16610000-0000-0000-0000-000000000001' and acao='visita.confirmar';
do $$ begin
 begin perform pcm.sso_conferir_execucao_sso_reservada('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','visita');raise exception 'execucao_sso_aceita';
 exception when check_violation then if sqlerrm<>'ciclo_reservado_ao_legado' then raise;end if; end;
end; $$;
set local role authenticated;
select pcm.sso_materializar_visita_legada_mediada('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000005','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000161','17140000-0000-4000-8000-000000000097','17140000-0000-4000-8000-000000000098','Ponte intencional');
do $$ declare f jsonb;r jsonb; begin
 f:=pcm.sso_consultar_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161')->'fotoAtual';
 r:=pcm.sso_decidir_reserva_ciclo_legado('16610000-0000-0000-0000-000000000001','17140000-0000-4000-8000-000000000003','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','17140000-0000-4000-8000-000000000097',0,'visita','16610000-0000-0000-0000-000000000161','integrar_ponte',2,2,true,'Ponte específica',f);
 if r->>'revisao'<>'3' then raise exception 'revisao_incorreta';end if;
end; $$;
reset role;
select pcm.sso_conferir_execucao_sso_reservada('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000161','visita');
do $$ begin
 if not exists(select 1 from pcm.sso_vinculos_visita_legado where ocorrencia_visita_id='16610000-0000-0000-0000-000000000161') then raise exception 'ponte_ausente';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16610000-0000-0000-0000-00000000000a') then raise exception 'os_criada';end if;
end; $$;
rollback;
