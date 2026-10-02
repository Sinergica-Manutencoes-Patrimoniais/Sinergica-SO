-- E01-S53: planos e ocorrências são do PCM; a task remota só nasce após confirmação.
-- Reverso (após desvincular dados criados): remover as três colunas de
-- ordens_servico e as tabelas abaixo, na ordem achados, avaliacoes, ocorrencias,
-- planos. Nenhuma tabela ou dado preexistente é removido por esta migration.

create table pcm.planos_preventivos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pcm.clientes(id),
  sistema_id uuid references pcm.sistemas(id),
  equipamento_id uuid references pcm.equipamentos(id),
  questionario_id uuid not null references pcm.questionarios(id),
  tipo_tarefa_id uuid not null references pcm.tipos_tarefa(id),
  nome text not null check (length(trim(nome)) > 0),
  primeira_data date not null,
  intervalo_unidade text not null check (intervalo_unidade in ('semanas', 'meses')),
  intervalo_n integer not null check (intervalo_n between 1 and 120),
  fuso text not null default 'America/Sao_Paulo',
  estado text not null default 'rascunho' check (estado in ('rascunho', 'ativo', 'pausado')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint plano_preventivo_alvo_unico check (num_nonnulls(sistema_id, equipamento_id) = 1)
);

create index idx_planos_preventivos_cliente on pcm.planos_preventivos(cliente_id, estado);
create index idx_planos_preventivos_sistema on pcm.planos_preventivos(sistema_id) where sistema_id is not null;
create index idx_planos_preventivos_equipamento on pcm.planos_preventivos(equipamento_id) where equipamento_id is not null;

create function pcm.fn_plano_preventivo_validar_alvo() returns trigger
language plpgsql set search_path = pcm, public as $$
begin
  if tg_op = 'UPDATE' and exists (
    select 1 from pcm.ocorrencias_preventivas o where o.plano_id = old.id
  ) and (
    new.cliente_id is distinct from old.cliente_id or
    new.sistema_id is distinct from old.sistema_id or
    new.equipamento_id is distinct from old.equipamento_id or
    new.primeira_data is distinct from old.primeira_data or
    new.intervalo_unidade is distinct from old.intervalo_unidade or
    new.intervalo_n is distinct from old.intervalo_n or
    new.questionario_id is distinct from old.questionario_id or
    new.tipo_tarefa_id is distinct from old.tipo_tarefa_id
  ) then
    raise exception 'Plano com ocorrências: crie outro plano para mudar alvo ou recorrência';
  end if;
  if new.sistema_id is not null and not exists (
    select 1 from pcm.sistemas s where s.id = new.sistema_id
      and s.cliente_id = new.cliente_id and s.deleted_at is null
  ) then
    raise exception 'Sistema não pertence ao cliente ou está excluído';
  end if;
  if new.equipamento_id is not null and not exists (
    select 1 from pcm.equipamentos e where e.id = new.equipamento_id
      and e.client_id = new.cliente_id and e.deleted_at is null
  ) then
    raise exception 'Equipamento não pertence ao cliente ou está excluído';
  end if;
  if new.estado = 'ativo' and not exists (
    select 1 from pcm.questionarios q where q.id = new.questionario_id and q.ativo
  ) then
    raise exception 'Questionário Auvo inativo';
  end if;
  return new;
end;
$$;
create trigger trg_plano_preventivo_validar_alvo before insert or update
  on pcm.planos_preventivos for each row execute function pcm.fn_plano_preventivo_validar_alvo();

create table pcm.ocorrencias_preventivas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references pcm.planos_preventivos(id),
  indice integer not null check (indice >= 0),
  vencimento date not null,
  tecnico_funcionario_id uuid references pcm.funcionarios(id),
  visita_em timestamptz,
  envio_estado text not null default 'prevista'
    check (envio_estado in ('prevista', 'enviando', 'falha', 'incerto', 'disponivel')),
  chave_externa text not null unique,
  auvo_task_id bigint unique,
  erro_envio text,
  alvo_snapshot jsonb,
  questionario_auvo_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocorrencia_preventiva_ciclo unique(plano_id, indice),
  constraint ocorrencia_preventiva_vinculo check (
    (envio_estado = 'disponivel' and auvo_task_id is not null)
    or envio_estado <> 'disponivel'
  )
);
create index idx_ocorrencias_preventivas_vencimento on pcm.ocorrencias_preventivas(vencimento);
create index idx_ocorrencias_preventivas_visita on pcm.ocorrencias_preventivas(visita_em)
  where visita_em is not null;

alter table pcm.ordens_servico
  add column if not exists ocorrencia_preventiva_id uuid,
  add column if not exists sistema_id uuid,
  add column if not exists questionario_id uuid;
alter table pcm.ordens_servico add constraint os_ocorrencia_preventiva_fkey
  foreign key (ocorrencia_preventiva_id) references pcm.ocorrencias_preventivas(id) not valid;
alter table pcm.ordens_servico add constraint os_sistema_preventivo_fkey
  foreign key (sistema_id) references pcm.sistemas(id) not valid;
alter table pcm.ordens_servico add constraint os_questionario_preventivo_fkey
  foreign key (questionario_id) references pcm.questionarios(id) not valid;
create unique index idx_os_ocorrencia_preventiva on pcm.ordens_servico(ocorrencia_preventiva_id)
  where ocorrencia_preventiva_id is not null;

create table pcm.avaliacoes_preventivas (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references pcm.ocorrencias_preventivas(id),
  chave_origem text not null,
  item_referencia text,
  local_informado text,
  resposta jsonb not null default '{}'::jsonb,
  fotos jsonb not null default '[]'::jsonb,
  medicoes jsonb not null default '[]'::jsonb,
  auvo_updated_at timestamptz,
  recebido_em timestamptz not null default now(),
  unique(ocorrencia_id, chave_origem)
);

create table pcm.achados_preventivos (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references pcm.avaliacoes_preventivas(id),
  chave_origem text not null,
  descricao text not null,
  decisao text not null default 'pendente' check (decisao in ('pendente', 'descartado', 'backlog')),
  backlog_os_id uuid unique references pcm.ordens_servico(id),
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id),
  unique(avaliacao_id, chave_origem),
  constraint achado_backlog_vinculo check (
    (decisao = 'backlog' and backlog_os_id is not null)
    or (decisao <> 'backlog' and backlog_os_id is null)
  )
);

-- A confirmação remota é fechada por padrão. Esta linha só é alterada pela Edge Function
-- de validação, após POST/PATCH/GET real comprovar os quatro campos do contrato Auvo.
create table pcm.preventiva_auvo_contrato (
  id boolean primary key default true check (id),
  estado text not null default 'pendente' check (estado in ('pendente', 'validado', 'falhou')),
  validado_em timestamptz,
  evidencia jsonb not null default '{}'::jsonb,
  erro text,
  updated_at timestamptz not null default now()
);
insert into pcm.preventiva_auvo_contrato(id) values (true) on conflict do nothing;

alter table pcm.planos_preventivos enable row level security;
alter table pcm.planos_preventivos force row level security;
alter table pcm.ocorrencias_preventivas enable row level security;
alter table pcm.ocorrencias_preventivas force row level security;
alter table pcm.avaliacoes_preventivas enable row level security;
alter table pcm.avaliacoes_preventivas force row level security;
alter table pcm.achados_preventivos enable row level security;
alter table pcm.achados_preventivos force row level security;
alter table pcm.preventiva_auvo_contrato enable row level security;
alter table pcm.preventiva_auvo_contrato force row level security;

grant select, insert, update on pcm.planos_preventivos to authenticated;
grant select on pcm.ocorrencias_preventivas, pcm.avaliacoes_preventivas,
  pcm.achados_preventivos, pcm.preventiva_auvo_contrato to authenticated;
grant select, insert, update, delete on pcm.planos_preventivos,
  pcm.ocorrencias_preventivas, pcm.avaliacoes_preventivas,
  pcm.achados_preventivos, pcm.preventiva_auvo_contrato to service_role;

create policy planos_preventivos_read on pcm.planos_preventivos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));
create policy planos_preventivos_insert on pcm.planos_preventivos for insert to authenticated
  with check (auth.uid() = created_by and (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita'));
create policy planos_preventivos_update on pcm.planos_preventivos for update to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita')
  with check (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' = 'escrita');
create policy ocorrencias_preventivas_read on pcm.ocorrencias_preventivas for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));
create policy avaliacoes_preventivas_read on pcm.avaliacoes_preventivas for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));
create policy achados_preventivos_read on pcm.achados_preventivos for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));
create policy preventiva_auvo_contrato_read on pcm.preventiva_auvo_contrato for select to authenticated
  using (auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita'));

-- Janela finita e idempotente. Índice calculado da primeira data, nunca da execução.
create function pcm.materializar_ocorrencias_preventivas(p_plano_id uuid, p_ate date)
returns integer language plpgsql security definer set search_path = pcm, public as $$
declare
  v_plano pcm.planos_preventivos%rowtype;
  v_indice integer;
  v_max_indice integer;
  v_data date;
  v_total integer := 0;
  v_mes_base date;
  v_ultimo_dia integer;
begin
  if coalesce(auth.jwt() ->> 'user_role', '') <> 'superadmin'
     and coalesce(auth.jwt() -> 'user_modulos' ->> 'pcm', '') <> 'escrita'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Sem permissão PCM de escrita' using errcode = '42501';
  end if;
  if p_ate is null or p_ate > current_date + interval '2 years' then
    raise exception 'Janela de materialização inválida';
  end if;
  select * into v_plano from pcm.planos_preventivos where id = p_plano_id;
  if not found then raise exception 'Plano não encontrado'; end if;
  if v_plano.estado <> 'ativo' or p_ate < v_plano.primeira_data then return 0; end if;

  if v_plano.intervalo_unidade = 'semanas' then
    v_max_indice := (p_ate - v_plano.primeira_data) / (7 * v_plano.intervalo_n);
  else
    v_max_indice := (
      (extract(year from p_ate)::integer - extract(year from v_plano.primeira_data)::integer) * 12
      + extract(month from p_ate)::integer - extract(month from v_plano.primeira_data)::integer
    ) / v_plano.intervalo_n;
  end if;

  for v_indice in 0..v_max_indice loop
    if v_plano.intervalo_unidade = 'semanas' then
      v_data := v_plano.primeira_data + 7 * v_plano.intervalo_n * v_indice;
    else
      v_mes_base := date_trunc('month', v_plano.primeira_data)::date
        + make_interval(months => v_plano.intervalo_n * v_indice);
      v_ultimo_dia := extract(day from (
        v_mes_base + interval '1 month' - interval '1 day'
      ))::integer;
      v_data := v_mes_base + (
        least(extract(day from v_plano.primeira_data)::integer, v_ultimo_dia) - 1
      );
    end if;
    if v_data <= p_ate then
      insert into pcm.ocorrencias_preventivas(plano_id, indice, vencimento, chave_externa)
      values (p_plano_id, v_indice, v_data, 'PREV-' || p_plano_id || '-' || v_indice)
      on conflict (plano_id, indice) do nothing;
      if found then v_total := v_total + 1; end if;
    end if;
  end loop;
  return v_total;
end;
$$;
revoke all on function pcm.materializar_ocorrencias_preventivas(uuid, date) from public;
grant execute on function pcm.materializar_ocorrencias_preventivas(uuid, date)
  to authenticated, service_role;
