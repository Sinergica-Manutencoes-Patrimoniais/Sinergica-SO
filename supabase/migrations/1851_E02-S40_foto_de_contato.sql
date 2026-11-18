-- 1851_E02-S40_foto_de_contato.sql — Sinérgica SO
-- Foto do WhatsApp do contato (ADR-1686 família). A Sinérgica não tem entidade `contato`
-- separada do Lead — `atendimento.conversas` já é única por (instance_id, remote_jid), que é
-- exatamente "contato naquele canal". A foto é ancorada na conversa (decisão em plan.md): o mesmo
-- número em dois canais Evolution tem duas fotos, uma por conversa — aceito, igual ao TriviAtende.
--
-- Reverso:
--   drop function if exists atendimento.fn_conversas_para_foto_inicial(integer);
--   drop function if exists atendimento.fn_registrar_foto_de_contato(uuid,text,text,text);
--   drop function if exists atendimento.fn_reservar_consulta_de_foto(uuid,interval);
--   alter table atendimento.conversas drop column if exists foto_em, drop column if exists foto_hash;
--   drop table if exists atendimento.foto_de_contato;

create table if not exists atendimento.foto_de_contato (
  conversa_id   uuid        primary key references atendimento.conversas(id) on delete cascade,
  estado        text        not null check (estado in ('guardada', 'sem_foto', 'falhou')),
  mime          text        check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  hash          text        check (hash ~ '^[0-9a-f]{64}$'),
  consultada_em timestamptz not null default clock_timestamp(),
  atualizada_em timestamptz,
  constraint foto_guardada_completa check (
    (estado = 'guardada') = (mime is not null and hash is not null)
  )
);

alter table atendimento.foto_de_contato enable row level security;
alter table atendimento.foto_de_contato force row level security;
revoke all on table atendimento.foto_de_contato from public, anon, authenticated;
grant select, insert, update, delete on table atendimento.foto_de_contato to service_role;

-- Cópia de leitura para a fila/cabeçalho não pedirem imagem que não existe.
alter table atendimento.conversas
  add column if not exists foto_em   timestamptz,
  add column if not exists foto_hash text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atendimento-fotos-contato', 'atendimento-fotos-contato', false, 1048576,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reserva atômica: marca consultada_em ANTES da busca real, para duas mensagens seguidas do
-- mesmo contato conseguirem só uma reserva. `found` = conseguiu reservar (estava fora da janela
-- ou é a primeira vez); false = dentro da janela, não consulta de novo.
create or replace function atendimento.fn_reservar_consulta_de_foto(
  p_conversa_id uuid,
  p_intervalo interval default interval '7 days'
) returns boolean
language plpgsql
security definer
set search_path = atendimento, public
as $$
begin
  insert into atendimento.foto_de_contato (conversa_id, estado, consultada_em)
  values (p_conversa_id, 'falhou', clock_timestamp())
  on conflict (conversa_id) do update
     set consultada_em = clock_timestamp()
   where atendimento.foto_de_contato.consultada_em < clock_timestamp() - p_intervalo;
  return found;
end;
$$;

revoke all on function atendimento.fn_reservar_consulta_de_foto(uuid, interval) from public, anon, authenticated;
grant execute on function atendimento.fn_reservar_consulta_de_foto(uuid, interval) to service_role;

-- 'sem_foto' apaga o que estava guardado e zera a cópia de leitura da conversa (volta a
-- iniciais). 'guardada' grava mime/hash e atualiza a cópia de leitura com o novo hash (versão).
create or replace function atendimento.fn_registrar_foto_de_contato(
  p_conversa_id uuid,
  p_estado text,
  p_mime text,
  p_hash text
) returns void
language plpgsql
security definer
set search_path = atendimento, public
as $$
begin
  if p_estado not in ('guardada', 'sem_foto', 'falhou') then
    raise exception 'estado_invalido' using errcode = '22023';
  end if;

  update atendimento.foto_de_contato
     set estado = p_estado,
         mime = case when p_estado = 'guardada' then p_mime else null end,
         hash = case when p_estado = 'guardada' then p_hash else null end,
         atualizada_em = clock_timestamp()
   where conversa_id = p_conversa_id;

  if not found then
    insert into atendimento.foto_de_contato (conversa_id, estado, mime, hash, atualizada_em)
    values (
      p_conversa_id, p_estado,
      case when p_estado = 'guardada' then p_mime else null end,
      case when p_estado = 'guardada' then p_hash else null end,
      clock_timestamp()
    );
  end if;

  update atendimento.conversas
     set foto_em = case when p_estado = 'guardada' then now() else null end,
         foto_hash = case when p_estado = 'guardada' then p_hash else null end
   where id = p_conversa_id;
end;
$$;

revoke all on function atendimento.fn_registrar_foto_de_contato(uuid, text, text, text) from public, anon, authenticated;
grant execute on function atendimento.fn_registrar_foto_de_contato(uuid, text, text, text) to service_role;

-- Preenchimento inicial: conversas ativas de canal Evolution, respeitando o intervalo de 7 dias
-- por contato, com teto por execução — idempotente por construção (a reserva de 7 dias impede
-- reprocessar).
create or replace function atendimento.fn_conversas_para_foto_inicial(p_limite integer)
returns table (conversa_id uuid, canal_id uuid, remote_jid text)
language sql
stable
security definer
set search_path = atendimento, public
as $$
  select c.id, c.canal_id, c.remote_jid
    from atendimento.conversas c
    join atendimento.canais_externos ce on ce.id = c.canal_id
   where ce.tipo = 'evolution'
     and c.status <> 'encerrada'
     and not exists (
           select 1 from atendimento.foto_de_contato f
            where f.conversa_id = c.id
              and f.consultada_em > clock_timestamp() - interval '7 days'
         )
   order by c.ultima_mensagem_em desc nulls last
   limit greatest(1, least(coalesce(p_limite, 100), 500))
$$;

revoke all on function atendimento.fn_conversas_para_foto_inicial(integer) from public, anon;
grant execute on function atendimento.fn_conversas_para_foto_inicial(integer) to authenticated, service_role;

comment on table atendimento.foto_de_contato is
  'E02-S40: foto de perfil do WhatsApp, ancorada na conversa (não existe entidade contato separada).';
