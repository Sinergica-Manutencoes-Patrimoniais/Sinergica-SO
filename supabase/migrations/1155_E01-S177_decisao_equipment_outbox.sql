-- ADR-1002: diagnóstico interno para futura decisão do outbox; gate fechado.
create table pcm.sso_decisao_equipment_outbox_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_decisao_equipment_outbox_gate(id,habilitado) values(true,false);
alter table pcm.sso_decisao_equipment_outbox_gate enable row level security;
alter table pcm.sso_decisao_equipment_outbox_gate force row level security;
revoke all on pcm.sso_decisao_equipment_outbox_gate from public,anon,authenticated,service_role;

create function pcm.sso_decidir_equipment_outbox(p_componente_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v_e pcm.equipamentos%rowtype; v_m pcm.sso_categoria_componente%rowtype; v_p pcm.sso_politica_equipment_categoria%rowtype; v_ativa boolean; v_decisao text; v_vinculo boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_componente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform 1 from pcm.sso_decisao_equipment_outbox_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'decisao_equipment_desabilitada' using errcode='55000'; end if;
  select * into v_e from pcm.equipamentos where id=p_componente_id;
  if not found then raise exception 'componente_indisponivel' using errcode='23514'; end if;
  v_vinculo:=v_e.auvo_id is not null or v_e.auvo_equipment_id is not null;
  select * into v_m from pcm.sso_categoria_componente where componente_id=p_componente_id;
  select exists(select 1 from pcm.equipamento_categorias c where c.id=v_m.categoria_id and c.deleted_at is null) into v_ativa;
  select * into v_p from pcm.sso_politica_equipment_categoria where categoria_id=v_m.categoria_id;
  if v_e.client_id is null or v_m.componente_id is null or v_m.cliente_id is distinct from v_e.client_id
    or v_m.texto_observado is distinct from v_e.categoria or not v_ativa or v_p.categoria_id is null then
    v_decisao:='indeterminada';
  elsif v_p.equipamento_controlado then v_decisao:='equipment';
  else v_decisao:='somente_sso'; end if;
  return pg_catalog.jsonb_build_object('componenteId',p_componente_id,'representacao',v_decisao,'vinculoExistente',v_vinculo,'mapeamentoRevision',v_m.revisao,'politicaRevision',v_p.revisao);
end;
$$;
revoke all on function pcm.sso_decidir_equipment_outbox(uuid) from public,anon,authenticated,service_role;
