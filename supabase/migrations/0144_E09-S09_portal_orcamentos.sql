-- 0144_E09-S09_portal_orcamentos.sql — Sinérgica SO
-- Fecha dependência E01-S14 pelo recorte necessário ao portal: requisição pré-OS,
-- orçamento e decisão append-only. OS só nasce após aceite explícito.

create table pcm.requisicoes_servico (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid references pcm.chamados (id),
  cliente_id uuid not null references pcm.clientes (id),
  titulo text not null,
  descricao text,
  status text not null default 'em_orcamento'
    check (status in ('em_orcamento','aguardando_aceite','aceita','recusada','encerrada')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);

create table pcm.orcamentos_servico (
  id uuid primary key default gen_random_uuid(),
  requisicao_id uuid not null references pcm.requisicoes_servico (id),
  cliente_id uuid not null references pcm.clientes (id),
  numero text not null unique,
  titulo text not null,
  descricao text,
  itens jsonb not null default '[]'::jsonb,
  valor_total_centavos integer not null check (valor_total_centavos > 0),
  status text not null default 'rascunho'
    check (status in ('rascunho','pendente','aprovado','recusado','expirado')),
  valido_ate date,
  ordem_servico_id uuid references pcm.ordens_servico (id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
create index idx_orcamentos_servico_cliente_status
  on pcm.orcamentos_servico (cliente_id, status, created_at desc);

create table pcm.orcamento_decisoes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null unique references pcm.orcamentos_servico (id),
  cliente_id uuid not null references pcm.clientes (id),
  decisao text not null check (decisao in ('aprovado','recusado')),
  motivo text,
  autor_user_id uuid not null references auth.users,
  ip_hash text,
  created_at timestamptz not null default now(),
  check (decisao <> 'recusado' or nullif(btrim(motivo), '') is not null)
);

alter table pcm.requisicoes_servico enable row level security;
alter table pcm.requisicoes_servico force row level security;
alter table pcm.orcamentos_servico enable row level security;
alter table pcm.orcamentos_servico force row level security;
alter table pcm.orcamento_decisoes enable row level security;
alter table pcm.orcamento_decisoes force row level security;

grant select, insert, update on pcm.requisicoes_servico, pcm.orcamentos_servico to authenticated;
grant select on pcm.orcamento_decisoes to authenticated;
grant select, insert, update, delete on pcm.requisicoes_servico, pcm.orcamentos_servico, pcm.orcamento_decisoes to service_role;

create policy "requisicoes_servico_select" on pcm.requisicoes_servico for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);
create policy "requisicoes_servico_insert" on pcm.requisicoes_servico for insert to authenticated with check (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
);
create policy "requisicoes_servico_update" on pcm.requisicoes_servico for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita');

create policy "orcamentos_servico_select" on pcm.orcamentos_servico for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);
create policy "orcamentos_servico_insert" on pcm.orcamentos_servico for insert to authenticated with check (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'
);
create policy "orcamentos_servico_update" on pcm.orcamentos_servico for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin' or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita');

create policy "orcamento_decisoes_select" on pcm.orcamento_decisoes for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura','escrita')
  or (auth.jwt() ->> 'user_role' = 'cliente-sindico' and cliente_id = nullif(auth.jwt() ->> 'cliente_id','')::uuid)
);

create or replace function pcm.portal_decidir_orcamento(
  p_orcamento_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orc pcm.orcamentos_servico%rowtype;
  v_req pcm.requisicoes_servico%rowtype;
  v_os_id uuid;
begin
  if auth.jwt() ->> 'user_role' <> 'cliente-sindico' then
    raise exception 'somente_cliente_sindico' using errcode = '42501';
  end if;
  if p_decisao not in ('aprovado','recusado') then
    raise exception 'decisao_invalida' using errcode = '23514';
  end if;
  if p_decisao = 'recusado' and nullif(btrim(p_motivo), '') is null then
    raise exception 'motivo_recusa_obrigatorio' using errcode = '23514';
  end if;

  select * into v_orc from pcm.orcamentos_servico
   where id = p_orcamento_id for update;
  if not found or v_orc.cliente_id <> nullif(auth.jwt() ->> 'cliente_id','')::uuid then
    raise exception 'orcamento_nao_encontrado' using errcode = '42501';
  end if;
  if v_orc.status <> 'pendente' or (v_orc.valido_ate is not null and v_orc.valido_ate < current_date) then
    raise exception 'orcamento_nao_decidivel' using errcode = '23514';
  end if;

  insert into pcm.orcamento_decisoes (orcamento_id, cliente_id, decisao, motivo, autor_user_id)
  values (v_orc.id, v_orc.cliente_id, p_decisao, nullif(btrim(p_motivo), ''), auth.uid());

  update pcm.orcamentos_servico set status = p_decisao, updated_at = now(), updated_by = auth.uid()
   where id = v_orc.id;
  update pcm.requisicoes_servico
     set status = case p_decisao when 'aprovado' then 'aceita' else 'recusada' end
   where id = v_orc.requisicao_id
   returning * into v_req;

  if p_decisao = 'aprovado' then
    insert into pcm.ordens_servico (
      client_id, numero, titulo, descricao, categoria, status, prioridade,
      origem, origem_ref_id, created_by
    ) values (
      v_orc.cliente_id, pcm.fn_proximo_numero_os(), v_orc.titulo,
      coalesce(v_orc.descricao, v_req.descricao), 'corretiva', 'solicitacao', 'normal',
      'portal', v_orc.id::text, auth.uid()
    ) returning id into v_os_id;
    update pcm.orcamentos_servico set ordem_servico_id = v_os_id where id = v_orc.id;
  end if;

  return v_os_id;
end;
$$;
revoke all on function pcm.portal_decidir_orcamento(uuid,text,text) from public;
grant execute on function pcm.portal_decidir_orcamento(uuid,text,text) to authenticated;

