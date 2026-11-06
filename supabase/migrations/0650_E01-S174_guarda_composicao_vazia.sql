-- ADR-0424: guarda opt-in sem alterar vínculos históricos.
create table pcm.sso_guarda_composicao_vazia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_guarda_composicao_vazia_gate(id,habilitado) values(true,false);
alter table pcm.sso_guarda_composicao_vazia_gate enable row level security;alter table pcm.sso_guarda_composicao_vazia_gate force row level security;
revoke all on pcm.sso_guarda_composicao_vazia_gate from public,anon,authenticated,service_role;
create function pcm.sso_guardar_composicao_nao_vazia() returns trigger language plpgsql security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if not coalesce((select habilitado from pcm.sso_guarda_composicao_vazia_gate where id),false) then return new; end if;
  select c.cliente_id into v_cliente from pcm.sso_backlog_composicoes c where c.id=new.composicao_id for update;
  if v_cliente is null or v_cliente is distinct from new.cliente_id or not exists(select 1 from pcm.sso_backlog_pendencias b where b.composicao_id=new.composicao_id) then raise exception 'composicao_vazia_ou_invalida' using errcode='23514'; end if;
  if tg_table_name='sso_backlog_parcelas' then
    if not exists(select 1 from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id and p.cliente_id=v_cliente where b.composicao_id=new.composicao_id and b.pendencia_id=new.pendencia_id) then raise exception 'pendencia_fora_composicao' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_composicao_nao_vazia() from public,anon,authenticated,service_role;
create trigger sso_guardar_composicao_nao_vazia before insert on pcm.sso_backlog_chamado_vinculos for each row execute function pcm.sso_guardar_composicao_nao_vazia();
create trigger sso_guardar_composicao_nao_vazia before insert on pcm.sso_backlog_parcelas for each row execute function pcm.sso_guardar_composicao_nao_vazia();
