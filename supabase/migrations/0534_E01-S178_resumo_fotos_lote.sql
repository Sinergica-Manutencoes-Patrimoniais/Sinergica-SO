-- ADR-0308: leitura informativa, sem afetar aprovação do lote.
create table pcm.sso_resumo_fotos_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_resumo_fotos_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_resumo_fotos_lote_gate enable row level security;
alter table pcm.sso_resumo_fotos_lote_gate force row level security;
revoke all on pcm.sso_resumo_fotos_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_resumo_fotos_lote(p_lote_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_total bigint;v_pendentes bigint;v_aceitas bigint;v_rejeitadas bigint;
begin
  if not coalesce((select habilitado from pcm.sso_resumo_fotos_lote_gate where id),false) then raise exception 'resumo_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select count(*),count(*) filter(where d.decisao is null),count(*) filter(where d.decisao='aceita'),count(*) filter(where d.decisao='rejeitada') into v_total,v_pendentes,v_aceitas,v_rejeitadas
    from pcm.sso_fotos_levantamento f left join lateral (select x.decisao from pcm.sso_decisoes_foto_levantamento x where x.foto_id=f.id order by x.revisao desc limit 1) d on true
    where f.lote_id=p_lote_id and f.cliente_id=v_cliente;
  return jsonb_build_object('loteId',p_lote_id,'total',v_total,'semDecisao',v_pendentes,'aceitas',v_aceitas,'rejeitadas',v_rejeitadas);
end;
$$;
revoke all on function pcm.sso_resumo_fotos_lote(uuid) from public,anon,authenticated,service_role;
