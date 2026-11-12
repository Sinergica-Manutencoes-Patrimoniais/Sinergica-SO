-- 1845_E02-S35_canal_provedor_estado_saude.sql — Sinérgica SO
-- Canal Evolution confiável (ADR-1686). `status_conexao` (0057) só distingue
-- conectado/desconectado/erro — não sustenta "instância criada mas webhook falhou" vs.
-- "desconectado com credencial anterior" (reescanear) vs. "sem credencial" (configurar do zero),
-- que a UI de E02-S35 precisa mostrar. Esta migration é aditiva: `status_conexao` CONTINUA
-- existindo, sincronizado por trigger a partir de `estado_conexao`, até todo consumidor migrar.
--
-- Reverso:
--   drop trigger if exists trg_sincronizar_status_conexao_legado on atendimento.canais_externos;
--   drop function if exists atendimento.fn_sincronizar_status_conexao_legado();
--   alter table atendimento.canais_externos
--     drop constraint if exists canais_externos_provedor_valido,
--     drop constraint if exists canais_externos_estado_valido,
--     drop constraint if exists canais_externos_saude_valida,
--     drop column if exists provedor,
--     drop column if exists estado_conexao,
--     drop column if exists saude,
--     drop column if exists ultimo_sucesso_em,
--     drop column if exists ultimo_erro_em;

alter table atendimento.canais_externos
  add column if not exists provedor          text,
  add column if not exists estado_conexao    text,
  add column if not exists saude             text,
  add column if not exists ultimo_sucesso_em timestamptz,
  add column if not exists ultimo_erro_em    timestamptz;

-- Backfill sem adivinhação (AC-10): linha sem prova do provedor vira 'desconhecido', nunca um palpite.
update atendimento.canais_externos set provedor = case
  when tipo = 'evolution' then 'evolution-api'
  when tipo = 'meta_wa'   then 'meta-whatsapp'
  else 'desconhecido' end
where provedor is null;

update atendimento.canais_externos set estado_conexao = case
  when status_conexao = 'conectado' then 'conectado_verificado'
  else 'sem_credencial' end
where estado_conexao is null;

update atendimento.canais_externos set saude = 'desconhecida' where saude is null;

alter table atendimento.canais_externos
  alter column provedor       set default 'desconhecido',
  alter column provedor       set not null,
  alter column estado_conexao set default 'sem_credencial',
  alter column estado_conexao set not null,
  alter column saude          set default 'desconhecida',
  alter column saude          set not null;

alter table atendimento.canais_externos
  add constraint canais_externos_provedor_valido check (
    provedor in ('evolution-api', 'meta-whatsapp', 'desconhecido')
  ) not valid;

alter table atendimento.canais_externos
  add constraint canais_externos_estado_valido check (estado_conexao in (
    'sem_credencial', 'configurado', 'configuracao_incompleta',
    'aguardando_pareamento', 'conectado_verificado', 'desconectado'
  )) not valid;

alter table atendimento.canais_externos
  add constraint canais_externos_saude_valida check (
    saude in ('desconhecida', 'saudavel', 'degradada')
  ) not valid;

alter table atendimento.canais_externos validate constraint canais_externos_provedor_valido;
alter table atendimento.canais_externos validate constraint canais_externos_estado_valido;
alter table atendimento.canais_externos validate constraint canais_externos_saude_valida;

-- `status_conexao` legado é projeção de `estado_conexao`, nunca o contrário — é a fonte nova de
-- verdade. Mapa: qualquer estado "em progresso" ou "conectado" vira 'conectado' só quando
-- verificado; os demais caem em 'desconectado', exceto erro explícito de saúde degradada.
create or replace function atendimento.fn_sincronizar_status_conexao_legado()
returns trigger
language plpgsql
as $$
begin
  new.status_conexao := case
    when new.estado_conexao = 'conectado_verificado' then 'conectado'
    when new.saude = 'degradada' then 'erro'
    else 'desconectado'
  end;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_status_conexao_legado on atendimento.canais_externos;
create trigger trg_sincronizar_status_conexao_legado
  before insert or update of estado_conexao, saude on atendimento.canais_externos
  for each row execute function atendimento.fn_sincronizar_status_conexao_legado();

create index if not exists idx_canais_externos_estado_conexao
  on atendimento.canais_externos (estado_conexao);

comment on column atendimento.canais_externos.provedor is
  'E02-S35: evolution-api | meta-whatsapp | desconhecido (backfill sem prova, nunca palpite).';
comment on column atendimento.canais_externos.estado_conexao is
  'E02-S35: estado fino do canal (ADR-1686). status_conexao (legado) é projetado por trigger a partir deste.';
comment on column atendimento.canais_externos.saude is
  'E02-S35: reflete uso real (envio/webhook) — nunca selo permanente. Nunca atribuído manualmente pela UI.';
