-- ADR-1514: a comparação apresentada é condição transacional da decisão.
create table pcm.sso_decisao_comparada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_comparada_gate(id,habilitado) values(true,false);
alter table pcm.sso_decisao_comparada_gate enable row level security;
alter table pcm.sso_decisao_comparada_gate force row level security;
revoke all on pcm.sso_decisao_comparada_gate from public,anon,authenticated,service_role;

create table pcm.sso_comparacoes_decisoes_impacto(
 tipo text not null check(tipo in ('calendario','visita')),request_id uuid not null,
 ator_id uuid not null references auth.users(id),cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 preparada_id uuid not null,comparacao jsonb not null,criado_em timestamptz not null default now(),primary key(tipo,request_id)
);
alter table pcm.sso_comparacoes_decisoes_impacto enable row level security;
alter table pcm.sso_comparacoes_decisoes_impacto force row level security;
revoke all on pcm.sso_comparacoes_decisoes_impacto from public,anon,authenticated,service_role;
create trigger sso_comparacao_decisao_imutavel before update or delete on pcm.sso_comparacoes_decisoes_impacto for each row execute function pcm.sso_proteger_conferencia_levantamento();

alter function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) rename to sso_decidir_impacto_sem_comparacao_1657;
revoke all on function pcm.sso_decidir_impacto_sem_comparacao_1657(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;

-- A rota histórica continua utilizável, com gate ativo, somente para repetir o mesmo pedido já persistido.
create function pcm.sso_decidir_impacto_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_existe boolean;v_habilitado boolean;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(case when p_tipo='visita' then 'decisao-impacto-visita:' else 'decisao-impacto:' end||p_request_id::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03';end if;
 select habilitado into v_habilitado from pcm.sso_decisao_comparada_gate where id for share;
 if v_habilitado is distinct from false then
  select exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia d where p_tipo='calendario' and d.request_id=p_request_id union all select 1 from pcm.sso_decisoes_impacto_visita d where p_tipo='visita' and d.request_id=p_request_id) into v_existe;
  if not v_existe then raise exception 'comparacao_obrigatoria' using errcode='23514';end if;
 end if;
 return pcm.sso_decidir_impacto_sem_comparacao_1657(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo,p_tipo);
end; $$;
revoke all on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;

create function pcm.sso_decidir_impacto_comparado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text,p_tipo text,p_comparacao jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_registro pcm.sso_comparacoes_decisoes_impacto%rowtype;v_atual jsonb;v_resultado jsonb;v_habilitado boolean;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_request_id is null or jsonb_typeof(p_comparacao) is distinct from 'object' or pg_column_size(p_comparacao)>65536 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 select habilitado into v_habilitado from pcm.sso_decisao_comparada_gate where id for share;
 if v_habilitado is distinct from true then raise exception 'decisao_comparada_desabilitada' using errcode='55000';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(case when p_tipo='visita' then 'decisao-impacto-visita:' else 'decisao-impacto:' end||p_request_id::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03';end if;
 select * into v_registro from pcm.sso_comparacoes_decisoes_impacto where tipo=p_tipo and request_id=p_request_id;
 if found then
  if v_registro.ator_id is distinct from p_ator_id or v_registro.cliente_id is distinct from p_cliente_id or v_registro.plano_id is distinct from p_plano_id or v_registro.preparada_id is distinct from p_preparada_id or v_registro.comparacao is distinct from p_comparacao then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return pcm.sso_decidir_impacto_sem_comparacao_1657(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo,p_tipo);
 end if;
 -- Uma decisão histórica sem registro comparado nunca ganha fotografia retroativa.
 if exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia d where p_tipo='calendario' and d.request_id=p_request_id
   union all select 1 from pcm.sso_decisoes_impacto_visita d where p_tipo='visita' and d.request_id=p_request_id) then
  raise exception 'decisao_anterior_sem_comparacao' using errcode='23514';
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for update nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 lock table pcm.rotinas_manutencao,pcm.plano_versoes,pcm.ocorrencias_rotina_preparadas,pcm.ocorrencias_visita_preparadas,
  pcm.sso_ciclo_canonico_usos_versao,pcm.sso_ciclo_visita_usos_versao,pcm.sso_continuidades_ciclo_aprovadas,pcm.sso_continuidades_visita_aprovadas in share mode nowait;
 v_atual:=pcm.sso_comparar_rotina_impacto(p_ator_id,p_cliente_id,p_plano_id,p_expected_plano,p_rascunho_id,p_preparada_id,p_tipo);
 if v_atual is distinct from p_comparacao then raise exception 'comparacao_obsoleta' using errcode='40001';end if;
 v_resultado:=pcm.sso_decidir_impacto_sem_comparacao_1657(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo,p_tipo);
 insert into pcm.sso_comparacoes_decisoes_impacto(tipo,request_id,ator_id,cliente_id,plano_id,preparada_id,comparacao)
  values(p_tipo,p_request_id,p_ator_id,p_cliente_id,p_plano_id,p_preparada_id,p_comparacao);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_impacto_comparado(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text,jsonb) to authenticated;
