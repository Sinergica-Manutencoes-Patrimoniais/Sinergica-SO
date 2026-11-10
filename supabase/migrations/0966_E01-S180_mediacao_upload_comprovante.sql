-- ADR-0751. Gate fechado; habilitação depende de validação completa do Storage.
create table pcm.sso_upload_comprovante_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_upload_comprovante_gate(id, habilitado) values(true, false);
alter table pcm.sso_upload_comprovante_gate enable row level security;
alter table pcm.sso_upload_comprovante_gate force row level security;
revoke all on pcm.sso_upload_comprovante_gate from public, anon, authenticated, service_role;

-- A política INSERT existente chama esta função: concede-se somente esta
-- autorização booleana, nunca leitura direta do bucket ou mutação da despesa.
create or replace function pcm.sso_autorizar_upload_comprovante(p_nome text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_partes text[]; v_cliente uuid; v_despesa uuid; v_gate boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then return false; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then return false; end if;
  select g.habilitado into v_gate from pcm.sso_upload_comprovante_gate g where g.id for share;
  if not coalesce(v_gate, false) or auth.uid() is null or p_nome is null then return false; end if;
  v_partes := string_to_array(p_nome, '/');
  if pg_catalog.array_length(v_partes,1) is distinct from 3
    or v_partes[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_partes[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or v_partes[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_cliente := v_partes[1]::uuid; v_despesa := v_partes[2]::uuid;
  perform 1 from pcm.despesas_visita d where d.id = v_despesa and d.cliente_id = v_cliente
    and d.status = 'ativa' for share;
  if not found then return false; end if;
  return config.sso_autorizar_acao('despesa_visita.gerir', v_cliente) is true;
end $$;
revoke all on function pcm.sso_autorizar_upload_comprovante(text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_autorizar_upload_comprovante(text) to authenticated;

create function pcm.sso_resolver_upload_comprovante_autorizado(p_nome text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_id uuid;
begin
  if pcm.sso_autorizar_upload_comprovante(p_nome) is not true then
    raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select o.id into v_id from storage.objects o join storage.buckets b on b.id = o.bucket_id
    where o.bucket_id = 'sso-despesas-visita' and b.public is false and o.name = p_nome
      and o.owner_id = auth.uid()::text;
  if v_id is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  return v_id;
end $$;
revoke all on function pcm.sso_resolver_upload_comprovante_autorizado(text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_resolver_upload_comprovante_autorizado(text) to authenticated;

