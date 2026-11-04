-- ADR-1019: assinatura de conteúdo observável, não atestado de fonte oficial.
create table pcm.sso_fotografia_feriados_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_fotografia_feriados_gate(id,habilitado) values(true,false);
alter table pcm.sso_fotografia_feriados_gate enable row level security;
alter table pcm.sso_fotografia_feriados_gate force row level security;
revoke all on pcm.sso_fotografia_feriados_gate from public,anon,authenticated,service_role;

create function pcm.sso_fotografia_feriados(p_ator_id uuid,p_cliente_id uuid,p_contrato_id uuid,p_inicio date,p_fim date,p_apos uuid,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_todos jsonb; v_pagina jsonb; v_total integer; v_assinatura text;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_inicio is null or p_fim is null or not pg_catalog.isfinite(p_inicio) or not pg_catalog.isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366 or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_fotografia_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'fotografia_feriados_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.feriado_declarado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'feriados_bloqueados' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_contrato_id is not null and not exists(select 1 from comercial.contratos c where c.id=p_contrato_id and c.cliente_id=p_cliente_id) then raise exception 'contrato_invalido' using errcode='23514'; end if;
  select count(*)::integer,coalesce(jsonb_agg(pg_catalog.jsonb_build_object('id',t.id,'contrato_id',t.contrato_id,'data',t.data,'fonte',t.fonte,'motivo',t.motivo,'ativo',t.ativo,'revisao',t.revisao) order by t.id),'[]'::jsonb)
    into v_total,v_todos from (select f.id,f.contrato_id,f.data,f.fonte,f.motivo,f.ativo,f.revisao from pcm.feriados_declarados f
      where f.cliente_id=p_cliente_id and f.data between p_inicio and p_fim and (f.contrato_id is null or f.contrato_id=p_contrato_id) order by f.id limit 2001) t;
  if v_total>2000 then raise exception 'fotografia_excede_limite' using errcode='54000'; end if;
  v_assinatura:=pg_catalog.md5(v_todos::text);
  select coalesce(jsonb_agg(t.value order by (t.value->>'id')::uuid),'[]'::jsonb) into v_pagina
    from (select e.value from jsonb_array_elements(v_todos) e where p_apos is null or (e.value->>'id')::uuid>p_apos order by (e.value->>'id')::uuid limit p_limite) t;
  return pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'contratoId',p_contrato_id,'inicio',p_inicio,'fim',p_fim,'total',v_total,'assinatura',v_assinatura,'itens',v_pagina);
end;
$$;
revoke all on function pcm.sso_fotografia_feriados(uuid,uuid,uuid,date,date,uuid,integer) from public,anon,authenticated,service_role;
