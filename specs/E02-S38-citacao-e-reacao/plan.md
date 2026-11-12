---
name: plan
description: Detalhe técnico de E02-S38 — SQL de citação e reação, RPC, UI. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S38 · Citação e reação

## Migration `1835_E02-S38_citacao_e_reacao.sql`

```sql
-- 1. Citação (campos do cliente)
alter table atendimento.mensagens
  add column if not exists citada_mensagem_id uuid references atendimento.mensagens(id) on delete set null,
  add column if not exists citada_remote_id   text,
  add column if not exists citada_trecho      text,
  add column if not exists citada_autor       text;

alter table atendimento.mensagens
  add constraint mensagens_citacao_valida check (
    (citada_remote_id is null and citada_trecho is null
      and citada_autor is null and citada_mensagem_id is null)
    or (direcao = 'entrada' and remetente_tipo = 'cliente'
        and length(btrim(citada_remote_id)) between 1 and 256
        and citada_autor in ('cliente','ze','humano','desconhecido')
        and (citada_trecho is null or length(citada_trecho) between 1 and 500))
  ) not valid;

create index if not exists idx_mensagens_citada on atendimento.mensagens (citada_mensagem_id)
  where citada_mensagem_id is not null;

-- 2. Reação: uma por mensagem, só pela RPC
create table if not exists atendimento.reacoes_mensagem (
  mensagem_id   uuid primary key references atendimento.mensagens(id) on delete cascade,
  conversa_id   uuid not null references atendimento.conversas(id) on delete cascade,
  emoji         text not null check (length(emoji) between 1 and 32),
  remote_id     text not null check (length(btrim(remote_id)) between 1 and 256),
  atualizada_em timestamptz not null default clock_timestamp()
);
create index if not exists idx_reacoes_conversa on atendimento.reacoes_mensagem (conversa_id);

alter table atendimento.reacoes_mensagem enable row level security;
alter table atendimento.reacoes_mensagem force  row level security;
revoke all on table atendimento.reacoes_mensagem from public, anon, authenticated, service_role;
grant select on table atendimento.reacoes_mensagem to authenticated;

create policy "reacoes_mensagem_leitura" on atendimento.reacoes_mensagem
  for select to authenticated using (atendimento.fn_pode_ler_conversa(conversa_id));
```

> `revoke` inclusive de `service_role` para INSERT/UPDATE: a escrita só acontece dentro da RPC
> `security definer`. É a prova de AC-10.

## RPC `atendimento.fn_registrar_reacao_evolution`

```sql
create or replace function atendimento.fn_registrar_reacao_evolution(
  p_canal_id uuid, p_remote_id_reagido text, p_emoji text
) returns text   -- 'aplicada' | 'removida' | 'orfa'
language plpgsql security definer set search_path = atendimento, public as $$
declare v_mensagem_id uuid; v_conversa_id uuid;
begin
  select m.id, m.conversa_id into v_mensagem_id, v_conversa_id
    from atendimento.mensagens m
    join atendimento.conversas c on c.id = m.conversa_id
   where c.canal_id = p_canal_id and m.wa_message_id = p_remote_id_reagido
   limit 1;
  if v_mensagem_id is null then return 'orfa'; end if;   -- AC-9: sem erro

  if btrim(coalesce(p_emoji,'')) = '' then
    delete from atendimento.reacoes_mensagem where mensagem_id = v_mensagem_id;
    return 'removida';                                    -- AC-7
  end if;

  insert into atendimento.reacoes_mensagem (mensagem_id, conversa_id, emoji, remote_id)
  values (v_mensagem_id, v_conversa_id, p_emoji, p_remote_id_reagido)
  on conflict (mensagem_id) do update
    set emoji = excluded.emoji, atualizada_em = clock_timestamp();
  return 'aplicada';
end $$;
```

**Não toca** `conversas.ultima_mensagem_preview`, `ultima_mensagem_em`, `nao_lidas`, `status` nem
`modo` — é o que garante AC-6 e AC-8.

## Resolução da citação na ingestão

Na RPC de ingestão de mensagem (E02-S37), acrescentar:

```sql
-- citada_mensagem_id: resolve DENTRO do mesmo canal, nunca globalmente
select m.id, case
    when m.direcao = 'entrada' then 'cliente'
    when m.remetente_tipo in ('ze','agente') then 'ze'
    else 'humano' end
  into v_citada_id, v_citada_autor
  from atendimento.mensagens m
  join atendimento.conversas c on c.id = m.conversa_id
 where c.canal_id = p_canal_id and m.wa_message_id = p_citada_remote_id
 limit 1;
-- não achou: citada_mensagem_id fica null, citada_autor = 'desconhecido' (AC-2)
```

## Classificador e extração

`citacaoDaMensagem(mensagem, contextoDoEvento)` já portada em `_shared/evolution-midia.ts` (S37).
Lembretes do contrato:

- Procura `contextInfo` em `extendedTextMessage`, `imageMessage`, `videoMessage`, `documentMessage`,
  `audioMessage`, `stickerMessage` **e** em `data.contextInfo` (Evolution 2 manda fora).
- Trecho vem de `contextInfo.quotedMessage`, resolvido por `trechoDaCitada`:
  texto direto · `[imagem] legenda` · `[vídeo] legenda` · `[documento] nome.pdf` · `[áudio]` ·
  `[figurinha]`. Cortado em 500 (AC-3, AC-5 — só o primeiro nível, porque `trechoDaCitada` não recursa).
- `reacaoDaMensagem` devolve `{ remoteIdReagido, emoji }`; emoji vazio = remoção; `remote_id` > 256 ou
  emoji > 32 → `null` (ignorado).

## O que o Zé lê

O texto entregue ao Zé ganha prefixo quando há citação:

```
Em resposta a {autor}: "{trecho}"
{texto da mensagem}
```

Onde `{autor}` é "cliente", "Zé" ou "equipe". Limite total continua 4000 caracteres — a citação é
cortada antes do texto novo, nunca o contrário.

## UI

`MensagemBubble` ganha:

- **Bloco de citação** acima do conteúdo: barra lateral, autor em negrito, trecho em 1–2 linhas com
  reticência. Clicável quando `citadaMensagemId !== null` → rola até a mensagem e pisca o destaque.
  Sem `citadaMensagemId` e sem trecho → texto "mensagem anterior", não clicável.
- **Reação** ancorada no canto inferior da bolha, sobreposta, com o emoji e `aria-label`
  "Cliente reagiu com {emoji}".

A lista de conversas **não muda** com reação — o adapter não reconsulta a prévia.

## Leitura

`listar-mensagens.ts` passa a trazer as reações num `select` embutido
(`reacoes_mensagem(emoji, atualizada_em)`) e os campos `citada_*`, num único round-trip.
Invalidação da chave `atendimentoQueryKeys.mensagens(conversaId)` depois de cada escrita.
