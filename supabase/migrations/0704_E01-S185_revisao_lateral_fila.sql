-- ADR-0478: contador lateral; gate desligado, nenhuma alteração de dados da outbox.
create table pcm.reconciliacao_revisao_fila_gate(id boolean primary key default true check(id),habilitado boolean not null default false,epoca uuid not null default gen_random_uuid());
insert into pcm.reconciliacao_revisao_fila_gate(id,habilitado) values(true,false);
alter table pcm.reconciliacao_revisao_fila_gate enable row level security;
alter table pcm.reconciliacao_revisao_fila_gate force row level security;
revoke all on pcm.reconciliacao_revisao_fila_gate from public,anon,authenticated,service_role;
create function pcm.sso_renovar_epoca_fila() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.habilitado is distinct from old.habilitado then new.epoca:=gen_random_uuid(); end if; return new; end $$;
revoke all on function pcm.sso_renovar_epoca_fila() from public,anon,authenticated,service_role;
create trigger sso_epoca_revisao_fila before update on pcm.reconciliacao_revisao_fila_gate for each row execute function pcm.sso_renovar_epoca_fila();
create table pcm.reconciliacao_revisoes_fila(outbox_id uuid primary key,revisao bigint not null check(revisao>0));
alter table pcm.reconciliacao_revisoes_fila enable row level security;
alter table pcm.reconciliacao_revisoes_fila force row level security;
revoke all on pcm.reconciliacao_revisoes_fila from public,anon,authenticated,service_role;
create function pcm.sso_contar_revisao_fila() returns trigger language plpgsql security definer set search_path='' as $$
declare id_fila uuid;
begin
  if not coalesce((select habilitado from pcm.reconciliacao_revisao_fila_gate where id),false) then if tg_op='DELETE' then return old; end if; return new; end if;
  if tg_op='UPDATE' and new is not distinct from old then return new; end if;
  if tg_op='DELETE' then id_fila:=old.id; else id_fila:=new.id; end if;
  insert into pcm.reconciliacao_revisoes_fila(outbox_id,revisao) values(id_fila,1)
    on conflict(outbox_id) do update set revisao=pcm.reconciliacao_revisoes_fila.revisao+1;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function pcm.sso_contar_revisao_fila() from public,anon,authenticated,service_role;
create trigger sso_revisao_fila after insert or update or delete on pcm.auvo_sync_outbox for each row execute function pcm.sso_contar_revisao_fila();

create function pcm.sso_previa_revisao_fila(p_cliente_id uuid,p_outbox_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q pcm.auvo_sync_outbox%rowtype; g pcm.reconciliacao_revisao_fila_gate%rowtype; rev bigint;
begin
  select * into g from pcm.reconciliacao_revisao_fila_gate where id;
  if not coalesce(g.habilitado,false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into q from pcm.auvo_sync_outbox where id=p_outbox_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pcm.sso_revalidar_previa_fila(p_cliente_id,p_outbox_id,q.status,q.attempts);
  select coalesce((select revisao from pcm.reconciliacao_revisoes_fila where outbox_id=q.id),0) into rev;
  return jsonb_build_object('outboxId',q.id,'epoca',g.epoca,'revisao',rev::text,'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_previa_revisao_fila(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_revalidar_revisao_fila(p_cliente_id uuid,p_outbox_id uuid,p_epoca uuid,p_revisao text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare atual jsonb;
begin
  if p_epoca is null or p_revisao is null or p_revisao !~ '^(0|[1-9][0-9]{0,18})$' then raise exception 'previa_invalida' using errcode='22023'; end if;
  atual:=pcm.sso_previa_revisao_fila(p_cliente_id,p_outbox_id);
  return jsonb_build_object('outboxId',p_outbox_id,'equivalente',atual->>'epoca'=p_epoca::text and atual->>'revisao'=p_revisao,
    'situacaoRemota','desconhecida','autorizaRetry',false);
end $$;
revoke all on function pcm.sso_revalidar_revisao_fila(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
