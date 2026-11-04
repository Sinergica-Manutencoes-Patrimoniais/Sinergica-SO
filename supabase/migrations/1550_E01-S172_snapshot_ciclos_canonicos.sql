-- ADR-1406: acrescenta identidade de ciclo, sem alterar fontes ou efetuar ações.
create table pcm.sso_snapshot_ciclos_canonicos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_snapshot_ciclos_canonicos_gate(id,habilitado) values(true,false);
alter table pcm.sso_snapshot_ciclos_canonicos_gate enable row level security;
alter table pcm.sso_snapshot_ciclos_canonicos_gate force row level security;
revoke all on pcm.sso_snapshot_ciclos_canonicos_gate from public,anon,authenticated,service_role;

create function pcm.sso_ciclo_snapshot_capacidade(p_cliente_id uuid,p_preparada_id uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_total bigint;v_ciclo uuid;
begin
 if p_preparada_id is null then return null; end if;
 select count(distinct cv.ciclo_id),min(cv.ciclo_id::text)::uuid into v_total,v_ciclo
 from pcm.sso_ciclo_calendario_versoes cv join pcm.ocorrencias_rotina_preparadas o on o.id=cv.preparada_id
 join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where cv.preparada_id=p_preparada_id;
 if v_total>1 then raise exception 'ciclo_ambiguo' using errcode='23514'; end if;
 return v_ciclo;
end; $$;
revoke all on function pcm.sso_ciclo_snapshot_capacidade(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_snapshot_capacidade_ciclos(p_cliente_id uuid,p_semana_inicio date) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot jsonb;v_array jsonb;v_item jsonb;v_ciclo uuid;v_origem uuid;v_campo text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_snapshot_ciclos_canonicos_gate where id and habilitado for share;
 if not found then raise exception 'snapshot_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_snapshot:=pcm.sso_snapshot_capacidade_referencia(p_cliente_id,p_semana_inicio);
 foreach v_campo in array array['fontesVisita','ocorrenciasSemOs','osSemVisita'] loop
   if jsonb_typeof(v_snapshot->v_campo) is distinct from 'array' or jsonb_array_length(v_snapshot->v_campo)>100 then raise exception 'fonte_invalida' using errcode='23514'; end if;
   v_array:='[]'::jsonb;
   for v_item in select value from jsonb_array_elements(v_snapshot->v_campo) loop
     v_origem:=null;
     if v_campo='fontesVisita' and v_item->>'ocorrencia_preparada_id' is not null then v_origem:=(v_item->>'ocorrencia_preparada_id')::uuid;
     elsif v_campo='ocorrenciasSemOs' and v_item->>'tipo'='calendario' then v_origem:=(v_item->>'ocorrencia_id')::uuid;
     elsif v_campo='osSemVisita' and v_item->>'tipo'='calendario' then v_origem:=(v_item->>'origem_id')::uuid; end if;
     v_ciclo:=pcm.sso_ciclo_snapshot_capacidade(p_cliente_id,v_origem);
     v_array:=v_array||jsonb_build_array(v_item||jsonb_build_object('ciclo_id',v_ciclo));
   end loop;
   v_snapshot:=jsonb_set(v_snapshot,array[v_campo],v_array);
 end loop;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_snapshot||jsonb_build_object('identidadeCicloParcial',true);
end; $$;
revoke all on function pcm.sso_snapshot_capacidade_ciclos(uuid,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_capacidade_ciclos(uuid,date) to authenticated;
