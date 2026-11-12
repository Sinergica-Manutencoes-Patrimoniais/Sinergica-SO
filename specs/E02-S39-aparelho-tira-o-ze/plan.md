---
name: plan
description: Detalhe técnico de E02-S39 — SQL do canal_aparelho, RPC, detecção de eco, UI. Puxe ao implementar.
alwaysApply: false
---

# Plan — E02-S39 · Mensagem do aparelho tira o Zé

## Migration `1836_E02-S39_canal_aparelho.sql`

```sql
-- Normalização usada por eco e por texto automático (mesma função nas duas pontas)
create or replace function atendimento.fn_normalizar_texto_do_aparelho(p_texto text)
returns text language sql immutable as $$
  select btrim(regexp_replace(lower(coalesce(p_texto,'')), '\s+', ' ', 'g'))
$$;

create or replace function atendimento.fn_textos_automaticos_validos(p_textos jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p_textos) = 'array'
     and jsonb_array_length(p_textos) <= 10
     and not exists (select 1 from jsonb_array_elements_text(p_textos) t
                      where length(t) > 1000 or btrim(t) = '')
     and (select count(distinct atendimento.fn_normalizar_texto_do_aparelho(t))
            from jsonb_array_elements_text(p_textos) t)
         = jsonb_array_length(p_textos)
$$;

create table if not exists atendimento.canal_aparelho (
  canal_id           uuid primary key references atendimento.canais_externos(id) on delete cascade,
  responsavel_id     uuid references auth.users on delete set null,
  textos_automaticos jsonb not null default '[]'::jsonb
    check (atendimento.fn_textos_automaticos_validos(textos_automaticos)),
  versao             bigint not null default 1 check (versao > 0),
  updated_by         uuid references auth.users,
  updated_at         timestamptz not null default now()
);

alter table atendimento.canal_aparelho enable row level security;
alter table atendimento.canal_aparelho force  row level security;
revoke all on table atendimento.canal_aparelho from public, anon, authenticated;
grant select on table atendimento.canal_aparelho to authenticated, service_role;

create policy "canal_aparelho_superadmin" on atendimento.canal_aparelho
  for select to authenticated using (auth.jwt() ->> 'user_role' = 'superadmin');
-- Escrita só pela RPC (AC-10)
```

### Leitura e escrita da configuração

```sql
-- Devolve também as pessoas elegíveis e se a atual continua válida (AC-11)
create or replace function atendimento.fn_ler_configuracao_do_aparelho(p_canal_id uuid)
  returns jsonb ...   -- { versao, responsavelId, responsavelNome, responsavelValido,
                      --   textos[], pessoasElegiveis[] }

create or replace function atendimento.fn_salvar_configuracao_do_aparelho(
  p_canal_id uuid, p_responsavel_id uuid, p_textos jsonb, p_versao_esperada bigint)
  returns bigint ...  -- CAS: versão divergente -> exception 'versao_divergente'
                      -- pessoa inválida        -> exception 'pessoa_invalida'
                      -- textos inválidos       -> exception 'textos_invalidos'
```

Pessoa válida = usuário **ativo** com `user_modulos->>'atendimento' in ('leitura','escrita')` ou
`superadmin`. A checagem roda **no servidor**, dentro da RPC; o browser só sugere a lista.

## Migration `1837_E02-S39_registrar_mensagem_do_aparelho.sql`

Substitui o comportamento de `fn_registrar_mensagem_celular` por uma RPC nova, **sem apagar** a antiga
(migration aditiva; a velha deixa de ser chamada).

```sql
create or replace function atendimento.fn_registrar_mensagem_do_aparelho(
  p_canal_id uuid, p_remote_jid text, p_remote_id text,
  p_texto text, p_enviada_em timestamptz, p_automatica boolean, p_atrasada boolean
) returns table (mensagem_id uuid, conversa_id uuid, tirou_o_ze boolean)
language plpgsql security definer set search_path = atendimento, public as $$
declare v_conversa_id uuid; v_mensagem_id uuid;
        v_responsavel uuid; v_tirou boolean := false;
begin
  -- 1. resolve/cria conversa do CANAL
  -- 2. eco por id: insert ... on conflict (wa_message_id) do nothing
  --    nada inserido -> eco conhecido, retorna sem tocar a conversa (AC-4)
  -- 3. eco por texto: existe mensagem do sistema com mesmo
  --    fn_normalizar_texto_do_aparelho(conteudo), status_entrega='enviando',
  --    created_at > now() - interval '20 minutes'  -> trata como eco (AC-4)
  -- 4. grava: direcao='saida', remetente_tipo='humano', origem_envio='celular',
  --    created_at = p_enviada_em  (AC-1)
  -- 5. tirar o Zé:
  select responsavel_id into v_responsavel
    from atendimento.canal_aparelho where canal_id = p_canal_id;
  if v_responsavel is not null and not p_automatica and not p_atrasada
     and atendimento.fn_pessoa_do_aparelho_valida(v_responsavel) then
    update atendimento.conversas
       set modo = 'pausado', atribuido_a = v_responsavel, updated_at = now()
     where id = v_conversa_id and modo = 'auto';
    v_tirou := found;
    -- cancela resposta e follow-up pendentes do Zé
    delete from atendimento.wa_queue where queue_key = ...;
  end if;
  -- 6. prévia e ultima_mensagem_em sempre atualizam; nao_lidas NUNCA (não é entrada)
  return query select v_mensagem_id, v_conversa_id, v_tirou;
end $$;
```

**Ordem das travas** (`FOR UPDATE` na conversa antes de tocar a fila) copiada da ingestão canônica,
para não inverter a ordem e criar deadlock com o caminho de entrada.

## `_shared/evolution-aparelho.ts` — porte direto

```ts
export const TAMANHO_MAXIMO_DO_TEXTO_DO_APARELHO = 4000
export function textoDoAparelho(mensagemBruta): string   // marcadores de mídia (AC-7)
export function horarioDoAparelho(valor: unknown): Date | null
export function mensagemDoAparelho(payload, nomeDoEvento):
  | { tipo: 'ignorar' }
  | { tipo: 'mensagem'; remoteId; remoteJid; texto; enviadaEm }
  | null   // não é fromMe
```

Marcadores (AC-7): `[Áudio enviado pelo aparelho]`, `[Imagem enviada pelo aparelho]`,
`[Vídeo enviado pelo aparelho]`,
`[Documento enviado pelo aparelho]`, `[Figurinha enviada pelo aparelho]`,
`[Localização enviada pelo aparelho]`, `[Contato enviado pelo aparelho]`, com a legenda concatenada
quando houver; fallback `[Mensagem enviada pelo aparelho]`.

Desembrulha `ephemeralMessage`, `viewOnceMessage`, `viewOnceMessageV2`, `viewOnceMessageV2Extension`,
`documentWithCaptionMessage`. Ignora `@g.us`, `@broadcast`, `protocolMessage`, `reactionMessage`
(AC-9). **Nunca lê `pushName`** (AC-13).

## Decisão a registrar no ADR 1688

A Sinérgica **não tem** versão de responsável (`responsavel_versao`) como o TriviAtende. Duas opções:

| Opção | Custo | Risco |
|---|---|---|
| **A — aceitar a corrida** (escolhida) | zero schema extra; `update ... where modo='auto'` é a trava | resposta do Zé já reservada na `wa_queue` pode sair depois da humana |
| B — adicionar `conversas.responsavel_versao` + CAS em todo o caminho do Zé | migration + mudança em `wa_queue`, `pcm-ze-agent`, follow-up | atrasa a story; escopo cresce |

**Decisão: A.** O `delete from wa_queue` fecha a janela quase toda; o resíduo é o item já reivindicado
por um worker em voo. Esse resíduo entra como risco aceito no ADR e **vira teste** (um caso que prova
que a mensagem do Zé já em voo chega mesmo assim, e que isso não corrompe o estado).

## UI — `RespostasPeloAparelho.tsx`

Seção dentro da aba do canal (`EvolutionTab`), só para superadmin:

- Select "Quem responde pelo celular", com "Ninguém" como primeira opção (AC-3), listando as pessoas
  elegíveis que a RPC devolveu. Pessoa configurada e inválida aparece com aviso.
- Textarea "Mensagens automáticas do WhatsApp", **um texto por bloco separado por linha em branco**.
  Validação no cliente espelha `erroDosTextos` (até 10, até 1.000, sem repetir) e a RPC revalida.
- Salvar envia `versaoEsperada`; `versao_divergente` mostra "Esta configuração mudou em outra sessão.
  Recarregue antes de salvar".

Mensagens de erro:

```ts
const MENSAGENS_DE_ERRO = {
  pessoa_invalida:  'A pessoa escolhida não está ativa no atendimento.',
  textos_invalidos: 'Revise as mensagens automáticas: até 10, com até 1.000 caracteres, sem repetir.',
  versao_divergente:'Esta configuração mudou em outra sessão. Recarregue antes de salvar.',
}
```

## Rótulo na conversa

`MensagemBubble` já mostra "Enviado pelo celular" para `origem_envio='celular'`. Acrescentar o rótulo
"Mensagem automática do WhatsApp" quando a mensagem casou com um texto automático — gravado numa
coluna `origem_envio='celular_automatico'` (valor novo no CHECK, aditivo).
