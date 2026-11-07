-- Executar apenas em clone descartável com migrations até 1649, dentro de BEGIN/ROLLBACK.
-- A fixture comum cria usuário, Plano, ocorrência de calendário e revisão; não há envio Auvo.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
update pcm.sso_diagnostico_revisao_mediado_gate set habilitado=true where id;

set local role authenticated;
do $$ declare p uuid; r jsonb; x jsonb; begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20);
 r:=pcm.sso_decidir_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000093','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','rever escopo','calendario');
 if r->>'decisao' is distinct from 'exige_reconciliacao' then raise exception 'decisao_invalida'; end if;
 x:=pcm.sso_consultar_resolucao_impacto_v2('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario'); if x->>'resolvida' is distinct from 'false' or x->>'resolucaoObsoleta' is distinct from 'false' or x->>'motivo' is not null then raise exception 'estado_ausente_invalido: %',x;end if;
 begin
  perform pcm.sso_resolver_impacto_retirada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000094','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario','retirada incorreta');
  raise exception 'retirada_deveria_ser_recusada';
 exception when check_violation then if sqlerrm <> 'escopo_nao_retirado_ou_indeterminado' then raise;end if;end;
end; $$;
reset role;

-- A deleção e posterior restauração são manipulações de fixture; não simulam fluxo de UI.
create temporary table rotina_rascunho_1646 as select * from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022';
do $$ begin if (select count(*) from rotina_rascunho_1646)<>1 then raise exception 'fixture_rascunho_invalida'; end if; end; $$;
delete from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022';
set local role authenticated;
do $$ declare p uuid;r jsonb;r2 jsonb;a jsonb;x jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20);
 begin perform pcm.sso_resolver_impacto_retirada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000096','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,1,2,'calendario','escopo retirado');raise exception 'revisao_aceita';exception when sqlstate 'P0011' then null;end;
 begin perform pcm.sso_resolver_impacto_retirada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000096','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'calendario','escopo retirado');raise exception 'decisao_aceita';exception when sqlstate 'P0015' then null;end;
 r:=pcm.sso_resolver_impacto_retirada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000095','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario','escopo retirado');
 r2:=pcm.sso_resolver_impacto_retirada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000095','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario','escopo retirado');
 if r is distinct from r2 or r->>'resolucaoRegistrada' is distinct from 'true' or r->>'aprovacaoAutorizada' is distinct from 'false' then raise exception 'resolucao_ou_replay_invalido';end if;
 x:=pcm.sso_consultar_resolucao_impacto_v2('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario'); if x->>'resolvida' is distinct from 'true' or x->>'resolucaoObsoleta' is distinct from 'false' or x->>'motivo' is distinct from 'escopo retirado' then raise exception 'estado_vigente_invalido: %',x;end if;
 a:=pcm.sso_avaliar_impacto_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'calendario');
 if (a->>'exigemReconciliacao')::integer<>0 then raise exception 'retirada_nao_reconhecida: %',a;end if;
end; $$;
reset role;
insert into pcm.rotinas_manutencao select * from rotina_rascunho_1646;
set local role authenticated;
do $$ declare a jsonb;p uuid;x jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20);
 x:=pcm.sso_consultar_resolucao_impacto_v2('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,2,'calendario'); if x->>'resolvida' is distinct from 'false' or x->>'resolucaoObsoleta' is distinct from 'true' or x->>'motivo' is not null then raise exception 'estado_obsoleto_invalido: %',x;end if;
 a:=pcm.sso_avaliar_impacto_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'calendario');
 if (a->>'exigemReconciliacao')::integer<>1 then raise exception 'retorno_do_escopo_deveria_exigir_reconciliacao: %',a;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_alterada';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
 if (select count(*) from pcm.sso_resolucoes_impacto_revisao where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'resolucao_duplicada';end if;
end; $$;
