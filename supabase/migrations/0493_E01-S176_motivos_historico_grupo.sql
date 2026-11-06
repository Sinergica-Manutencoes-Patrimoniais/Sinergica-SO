-- ADR-0267: projeção mínima de eventos de auditoria, desligada e sem concessão.
create table pcm.sso_motivos_historico_grupo_gate (id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_motivos_historico_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_motivos_historico_grupo_gate enable row level security;
alter table pcm.sso_motivos_historico_grupo_gate force row level security;
revoke all on pcm.sso_motivos_historico_grupo_gate from public,anon,authenticated,service_role;

create function pcm.sso_motivos_historico_grupo(p_grupo_id uuid,p_eventos uuid[])
returns table(evento_id uuid,operacao text,motivo text)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_motivos_historico_grupo_gate where id),false) then raise exception 'historico_motivos_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_grupo_id is null or p_eventos is null or cardinality(p_eventos)>100 or array_position(p_eventos,null) is not null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select g.cliente_id into v_cliente from pcm.grupos_quantitativos g where g.id=p_grupo_id;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'historico_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select e.id,e.payload->>'operacao',e.payload->>'motivo' from audit.events e
    where e.entity='grupos_quantitativos' and e.entity_id=p_grupo_id and e.id=any(p_eventos) and e.action='grupo.atualizado'
      and e.payload->>'operacao' in ('movimentacao','reclassificacao') and jsonb_typeof(e.payload->'motivo')='string';
end;
$$;
revoke all on function pcm.sso_motivos_historico_grupo(uuid,uuid[]) from public,anon,authenticated,service_role;
