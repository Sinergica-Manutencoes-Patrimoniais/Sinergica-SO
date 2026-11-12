-- 1846_E02-S35_evolution_servidor_instancia.sql — Sinérgica SO
-- Canal Evolution confiável (ADR-1686). Servidor atestado (SSRF) + matriz de compatibilidade +
-- instância criada pelo produto, com token por canal no Vault (referência opaca, nunca o valor).
-- Só superadmin administra — isto não é tela de colaborador.
--
-- Reverso:
--   drop policy if exists evolution_servidor_superadmin  on atendimento.evolution_servidor;
--   drop policy if exists evolution_instancia_superadmin on atendimento.evolution_instancia;
--   drop table if exists atendimento.evolution_instancia;
--   drop table if exists atendimento.evolution_servidor;

create table if not exists atendimento.evolution_servidor (
  id                        uuid        primary key default gen_random_uuid(),
  url_base                  text        not null check (length(btrim(url_base)) between 1 and 500),
  versao_detectada          text,
  estado                    text        not null default 'pendente'
                                         check (estado in ('pendente', 'compativel', 'incompativel')),
  motivo_incompatibilidade  text,
  credencial_ref            text,
  indicio                   text        not null default '' check (length(indicio) <= 4),
  geracao                   integer     not null default 1 check (geracao > 0),
  created_by                uuid        references auth.users,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists atendimento.evolution_instancia (
  canal_id            uuid        primary key references atendimento.canais_externos(id) on delete cascade,
  nome_remoto         text        not null unique check (length(nome_remoto) between 1 and 200),
  token_ref           text,
  webhook_secret_ref  text,
  estado              text        not null default 'criando'
                                   check (estado in (
                                     'criando', 'configuracao_incompleta', 'aguardando_pareamento',
                                     'conectado_verificado', 'desconectado'
                                   )),
  created_by          uuid        references auth.users,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_evolution_instancia_estado
  on atendimento.evolution_instancia (estado);

alter table atendimento.evolution_servidor  enable row level security;
alter table atendimento.evolution_servidor  force  row level security;
alter table atendimento.evolution_instancia enable row level security;
alter table atendimento.evolution_instancia force  row level security;

revoke all on table atendimento.evolution_servidor, atendimento.evolution_instancia
  from public, anon, authenticated;

grant select, insert, update on table atendimento.evolution_servidor, atendimento.evolution_instancia
  to authenticated;
grant select, insert, update, delete on table atendimento.evolution_servidor,
  atendimento.evolution_instancia to service_role;

create policy "evolution_servidor_superadmin" on atendimento.evolution_servidor
  for all to authenticated
  using      (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

create policy "evolution_instancia_superadmin" on atendimento.evolution_instancia
  for all to authenticated
  using      (auth.jwt() ->> 'user_role' = 'superadmin')
  with check (auth.jwt() ->> 'user_role' = 'superadmin');

-- Projeta o estado da instância para o canal (AC-4, AC-5): instância criada/webhook falhando
-- nunca marca o canal conectado por engano; só 'conectado_verificado' real propaga.
create or replace function atendimento.fn_sincronizar_estado_canal_evolution()
returns trigger
language plpgsql
security definer
set search_path = atendimento, public
as $$
begin
  -- `evolution_instancia.estado` e `canais_externos.estado_conexao` (migration 1845) tem enums
  -- quase iguais, mas não idênticos: 'criando' só existe do lado da instância (credencial já
  -- existe, a criação remota ainda está em voo) — mapeia para 'configurado', o estado mais
  -- próximo que o CHECK de canais_externos aceita. Os demais batem 1:1.
  update atendimento.canais_externos
     set estado_conexao = case
           when new.estado = 'criando' then 'configurado'
           else new.estado
         end,
         updated_at = now()
   where id = new.canal_id;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_estado_canal_evolution on atendimento.evolution_instancia;
create trigger trg_sincronizar_estado_canal_evolution
  after insert or update of estado on atendimento.evolution_instancia
  for each row execute function atendimento.fn_sincronizar_estado_canal_evolution();

comment on table atendimento.evolution_servidor is
  'E02-S35: servidor Evolution atestado (SSRF) + matriz de compatibilidade (ADR-1686). Só superadmin.';
comment on table atendimento.evolution_instancia is
  'E02-S35: instância criada pelo produto, nome derivado do canal_id, token no Vault por referência opaca.';
comment on column atendimento.evolution_servidor.credencial_ref is
  'Referência opaca ao Vault (config.fn_gravar_segredo_referenciado) — nunca a API key em si.';
comment on column atendimento.evolution_instancia.token_ref is
  'Referência opaca ao Vault — token da instância, distinto da API key global do servidor.';
comment on column atendimento.evolution_instancia.webhook_secret_ref is
  'Referência opaca ao Vault — segredo por canal do webhook (E02-S36), nunca em query string.';
