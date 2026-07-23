-- 0143_E09-S03-S08_portal_operacao.sql — Sinérgica SO
-- Leitura isolada e superfícies append-only de Assessment, Chamados, OS, documentos,
-- cronograma, notificações e satisfação.

-- Assessment e documentos SPDA.
drop policy if exists "inspecoes_select" on pcm.inspecoes;
create policy "inspecoes_select" on pcm.inspecoes for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );

drop policy if exists "inspecao_itens_select" on pcm.inspecao_itens;
create policy "inspecao_itens_select" on pcm.inspecao_itens for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );

drop policy if exists "laudos_spda_select" on pcm.laudos_spda;
create policy "laudos_spda_select" on pcm.laudos_spda for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );

drop policy if exists "laudo_spda_pontos_select" on pcm.laudo_spda_pontos;
create policy "laudo_spda_pontos_select" on pcm.laudo_spda_pontos for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and exists (
      select 1 from pcm.laudos_spda l
       where l.id = laudo_id
         and l.client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    ))
  );

-- Chamados: cliente cria apenas para o cliente do claim e acompanha interações públicas.
drop policy if exists "chamados_select" on pcm.chamados;
create policy "chamados_select" on pcm.chamados for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );

drop policy if exists "chamados_insert" on pcm.chamados;
create policy "chamados_insert" on pcm.chamados for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
      and origem = 'cliente_portal'
      and created_by = auth.uid()
    )
  );

drop policy if exists "chamados_eventos_select" on pcm.chamados_eventos;
create policy "chamados_eventos_select" on pcm.chamados_eventos for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and exists (
      select 1 from pcm.chamados c
       where c.id = chamado_id
         and c.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    ))
  );

drop policy if exists "chamados_eventos_insert" on pcm.chamados_eventos;
create policy "chamados_eventos_insert" on pcm.chamados_eventos for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    or (
      auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and tipo = 'criado'
      and created_by = auth.uid()
      and exists (
        select 1 from pcm.chamados c
         where c.id = chamado_id
           and c.cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
      )
    )
  );

create table pcm.chamados_interacoes (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references pcm.chamados (id) on delete cascade,
  cliente_id uuid not null references pcm.clientes (id),
  mensagem text,
  anexo_path text,
  autor_tipo text not null check (autor_tipo in ('cliente', 'interno')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users,
  check (nullif(btrim(mensagem), '') is not null or anexo_path is not null)
);
create index idx_chamados_interacoes_chamado on pcm.chamados_interacoes (chamado_id, created_at);
alter table pcm.chamados_interacoes enable row level security;
alter table pcm.chamados_interacoes force row level security;
grant select, insert on pcm.chamados_interacoes to authenticated;
grant select, insert, update, delete on pcm.chamados_interacoes to service_role;
create policy "chamados_interacoes_select" on pcm.chamados_interacoes for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );
create policy "chamados_interacoes_insert" on pcm.chamados_interacoes for insert to authenticated
  with check (
    (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
      and autor_tipo = 'cliente' and created_by = auth.uid()
      and exists (select 1 from pcm.chamados c where c.id = chamado_id and c.cliente_id = cliente_id))
  );

-- Notas de OS: append-only, sem policies UPDATE/DELETE.
create table pcm.os_notas (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null references pcm.ordens_servico (id) on delete cascade,
  cliente_id uuid not null references pcm.clientes (id),
  mensagem text,
  anexo_path text,
  autor_tipo text not null check (autor_tipo in ('cliente', 'interno')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users,
  check (nullif(btrim(mensagem), '') is not null or anexo_path is not null)
);
create index idx_os_notas_os on pcm.os_notas (ordem_servico_id, created_at);
alter table pcm.os_notas enable row level security;
alter table pcm.os_notas force row level security;
grant select, insert on pcm.os_notas to authenticated;
grant select, insert, update, delete on pcm.os_notas to service_role;
create policy "os_notas_select" on pcm.os_notas for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid)
  );
create policy "os_notas_insert" on pcm.os_notas for insert to authenticated
  with check (
    (auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
      and autor_tipo = 'cliente' and created_by = auth.uid()
      and exists (select 1 from pcm.ordens_servico os where os.id = ordem_servico_id and os.client_id = cliente_id))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('os-anexos', 'os-anexos', false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('portal-chamados-anexos', 'portal-chamados-anexos', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy "portal_os_anexos_select" on storage.objects for select to authenticated
  using (bucket_id = 'os-anexos' and (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and (storage.foldername(name))[1] = auth.jwt() ->> 'cliente_id')
  ));
create policy "portal_os_anexos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'os-anexos' and (
    auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    or auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and (storage.foldername(name))[1] = auth.jwt() ->> 'cliente_id')
  ));
create policy "portal_chamados_anexos_select" on storage.objects for select to authenticated
  using (bucket_id = 'portal-chamados-anexos' and (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and (storage.foldername(name))[1] = auth.jwt() ->> 'cliente_id')
  ));
create policy "portal_chamados_anexos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-chamados-anexos' and (
    auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
    or auth.jwt() ->> 'user_role' = 'superadmin'
    or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and (storage.foldername(name))[1] = auth.jwt() ->> 'cliente_id')
  ));

create policy "portal_inspecoes_midia_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'inspecoes-midia'
    and auth.jwt() ->> 'user_role' = 'cliente-sindico'
    and exists (
      select 1
      from pcm.inspecao_itens i
      cross join lateral jsonb_array_elements(i.midias) midia
      where midia ->> 'path' = name
        and i.client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    )
  );

create policy "portal_pmoc_laudos_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'pmoc-laudos'
    and auth.jwt() ->> 'user_role' = 'cliente-sindico'
    and exists (
      select 1
      from pcm.pmoc_records r
      join pcm.pmoc_properties p on p.id = r.property_id
      where r.pdf_url = name
        and p.client_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
    )
  );

-- PMOC: cadeia property(client_id) protege contrato, cronograma e registro.
drop policy if exists "pmoc_properties_select" on pcm.pmoc_properties;
create policy "pmoc_properties_select" on pcm.pmoc_properties for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and client_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);
drop policy if exists "pmoc_contracts_select" on pcm.pmoc_contracts;
create policy "pmoc_contracts_select" on pcm.pmoc_contracts for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and exists (
    select 1 from pcm.pmoc_properties p where p.id = property_id and p.client_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid))
);
drop policy if exists "pmoc_schedules_select" on pcm.pmoc_schedules;
create policy "pmoc_schedules_select" on pcm.pmoc_schedules for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and exists (
    select 1 from pcm.pmoc_properties p where p.id = property_id and p.client_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid))
);
drop policy if exists "pmoc_records_select" on pcm.pmoc_records;
create policy "pmoc_records_select" on pcm.pmoc_records for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and exists (
    select 1 from pcm.pmoc_properties p where p.id = property_id and p.client_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid))
);

create table pcm.portal_notificacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes (id),
  tipo text not null check (tipo in ('chamado','os','laudo','satisfacao','geral')),
  titulo text not null,
  mensagem text not null,
  referencia_tipo text,
  referencia_id uuid,
  lida_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_portal_notificacoes_cliente on pcm.portal_notificacoes (cliente_id, created_at desc);
alter table pcm.portal_notificacoes enable row level security;
alter table pcm.portal_notificacoes force row level security;
grant select on pcm.portal_notificacoes to authenticated;
grant select, insert, update, delete on pcm.portal_notificacoes to service_role;
create policy "portal_notificacoes_select" on pcm.portal_notificacoes for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);

create or replace function pcm.fn_portal_notificar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id uuid;
  v_titulo text;
  v_mensagem text;
  v_tipo text;
  v_referencia_id uuid;
begin
  if tg_table_name = 'chamados_eventos' then
    if new.tipo = 'criado' then return new; end if;
    select c.cliente_id, c.id into v_cliente_id, v_referencia_id
      from pcm.chamados c where c.id = new.chamado_id;
    v_tipo := 'chamado';
    v_titulo := 'Chamado atualizado';
    v_mensagem := 'Seu chamado recebeu uma atualização: ' || replace(new.tipo, '_', ' ') || '.';
  elsif tg_table_name = 'os_status_eventos' then
    select os.client_id, os.id into v_cliente_id, v_referencia_id
      from pcm.ordens_servico os where os.id = new.ordem_servico_id;
    v_tipo := case when new.status_novo = 'concluida' then 'satisfacao' else 'os' end;
    v_titulo := case when new.status_novo = 'concluida' then 'Avalie o atendimento' else 'Ordem de serviço atualizada' end;
    v_mensagem := 'A ordem de serviço mudou para: ' || replace(new.status_novo, '_', ' ') || '.';
  elsif tg_table_name = 'pmoc_records' then
    select p.client_id into v_cliente_id from pcm.pmoc_properties p where p.id = new.property_id;
    v_referencia_id := new.id;
    v_tipo := 'laudo';
    v_titulo := 'Novo laudo disponível';
    v_mensagem := 'Um novo laudo PMOC está disponível na Central de Documentos.';
  end if;

  if v_cliente_id is not null then
    insert into pcm.portal_notificacoes (cliente_id, tipo, titulo, mensagem, referencia_tipo, referencia_id)
    values (v_cliente_id, v_tipo, v_titulo, v_mensagem, tg_table_name, v_referencia_id);
  end if;
  return new;
end;
$$;

create trigger trg_portal_notificar_chamado
after insert on pcm.chamados_eventos
for each row execute function pcm.fn_portal_notificar_evento();
create trigger trg_portal_notificar_os
after insert on pcm.os_status_eventos
for each row execute function pcm.fn_portal_notificar_evento();
create trigger trg_portal_notificar_laudo
after update of pdf_url on pcm.pmoc_records
for each row when (old.pdf_url is distinct from new.pdf_url and new.pdf_url is not null)
execute function pcm.fn_portal_notificar_evento();

create extension if not exists pg_net with schema extensions;
create or replace function pcm.fn_portal_disparar_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_url text;
  v_service_role_key text;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;
  if v_project_url is null or v_service_role_key is null then
    return new;
  end if;
  perform net.http_post(
    url := v_project_url || '/functions/v1/portal-notificar-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_service_role_key),
    body := jsonb_build_object('notificacaoId', new.id)
  );
  return new;
exception when others then
  raise warning 'fn_portal_disparar_email: in-app preservada; e-mail não disparado — %', sqlerrm;
  return new;
end;
$$;
create trigger trg_portal_disparar_email
after insert on pcm.portal_notificacoes
for each row execute function pcm.fn_portal_disparar_email();
create or replace function pcm.portal_marcar_notificacao_lida(p_notificacao_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update pcm.portal_notificacoes
     set lida_at = coalesce(lida_at, now())
   where id = p_notificacao_id
     and auth.jwt() ->> 'user_role' = 'cliente-sindico'
     and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid;
$$;
revoke all on function pcm.portal_marcar_notificacao_lida(uuid) from public;
grant execute on function pcm.portal_marcar_notificacao_lida(uuid) to authenticated;

create table pcm.portal_satisfacao (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null unique references pcm.ordens_servico (id),
  cliente_id uuid not null references pcm.clientes (id),
  csat bigint check (csat between 1 and 5),
  nps bigint check (nps between 0 and 10),
  comentario text,
  dispensada boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users,
  check (dispensada or csat is not null or nps is not null)
);
alter table pcm.portal_satisfacao enable row level security;
alter table pcm.portal_satisfacao force row level security;
grant select, insert on pcm.portal_satisfacao to authenticated;
grant select, insert, update, delete on pcm.portal_satisfacao to service_role;
create policy "portal_satisfacao_select" on pcm.portal_satisfacao for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);
create policy "portal_satisfacao_insert" on pcm.portal_satisfacao for insert to authenticated with check (
  auth.jwt() ->> 'user_role' = 'cliente-sindico'
  and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid
  and created_by = auth.uid()
  and exists (select 1 from pcm.ordens_servico os where os.id = ordem_servico_id and os.client_id = cliente_id and os.status = 'concluida')
);
