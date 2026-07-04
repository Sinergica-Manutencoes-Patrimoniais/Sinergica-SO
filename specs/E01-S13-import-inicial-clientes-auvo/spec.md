---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Import inicial de clientes Auvo → PCM (bootstrap)

> **Fonte da verdade.** Status: aprovado (decisão do usuário, 2026-07-04 — ver `docs/STATE.md`).
> Tier: Pequeno (reaproveita a fundação/ACL de `E01-S09` e o padrão de sync de `E01-S11` — mesma
> direção invertida, Auvo é a fonte). Sem `design.md` próprio; consome o design de `E01-S09`.

## Por que esta story existe
Em produção, `PCM · Operação → Clientes` e a Visão 360 do Cliente (E01-S12) estão vazios —
"Nenhum cliente cadastrado". Não é bug de exibição: **não existe nenhuma tela de cadastro/CRUD de
cliente no PCM** e a única integração de clientes hoje (`pcm-auvo-customers-sync`, E01-S09) só
**empurra** um cliente do PCM pro Auvo como fallback ao criar uma OS — nunca importa o que já
existe no Auvo. Como a Sinérgica já opera o Auvo em produção com clientes reais cadastrados lá, o
usuário decidiu importar esses dados para o PCM em vez de recadastrar manualmente (CRUD de
cadastro fica para uma story futura, fora de escopo aqui — ver "Fora de escopo").

## Resumo
Uma Edge Function nova, **`pcm-auvo-customers-import`** (nome novo — não colide com
`pcm-auvo-customers-sync`, que continua existindo para o fluxo PCM→Auvo de E01-S09), lê
`GET /customers` do Auvo (paginado) e faz upsert em `pcm.clientes` por `auvo_id`, populando a base
inicial de clientes no PCM a partir do que já existe no Auvo.

## Critérios de aceite

### AC-1: Import popula `pcm.clientes` a partir do Auvo
- **Dado** clientes cadastrados no Auvo (`GET /customers`)
- **Quando** a Edge Function `pcm-auvo-customers-import` é executada (via `pg_cron` diário ou
  invocação HTTP autenticada sob demanda — mesmo padrão de AC-5 de `E01-S11`)
- **Então** `pcm.clientes` é populado/atualizado com `auvo_id`, `nome` — um upsert por `auvo_id`
  (a coluna já é `unique`, migration `0001_E00-S00`), nunca duplica.

### AC-2: Idempotente — rodar de novo não duplica nem sobrescreve edição manual indevidamente
- **Dado** um cliente já importado anteriormente (mesmo `auvo_id`)
- **Quando** o import roda de novo
- **Então** o registro existente é atualizado (upsert por `auvo_id`), não criado de novo.
  **[AUTO-DECISION]** o import atualiza `nome` a cada rodada (Auvo é a fonte para os campos que ele
  fornece) — se um humano editar o nome manualmente no PCM depois de existir o CRUD (story futura),
  o próximo import roda por cima. Aceitável nesta fase (hoje não existe CRUD, então não há edição
  manual para conflitar); revisitar quando o CRUD existir.

### AC-3: Cliente inativado/removido no Auvo não quebra o PCM
- **Dado** um cliente que existia no PCM (importado) e foi removido/desativado no Auvo
- **Quando** o próximo import roda
- **Então** o registro no PCM é marcado inativo (`ativo = false`), nunca apagado fisicamente — OS
  históricas que referenciam esse cliente (`pcm.ordens_servico.client_id`, FK não anulável)
  continuam funcionando. Mesma regra de soft-delete de `E01-S11` AC-4, pelo mesmo motivo.
  **[OPEN-QUESTION]** o campo que indica "cliente ativo/inativo" no Auvo não está confirmado neste
  ambiente (mapeamento externo não disponível para consulta direta) — a Edge Function deve tratar
  "ausente da resposta paginada completa" como o sinal de inativo (mesmo critério operacional que
  `E01-S11` usa pros seus caches), não um campo `active`/`status` específico do Auvo que pode não
  existir. Confirmar contra a API real antes de produção — mesma ressalva de todas as integrações
  Auvo deste projeto (sem Deno CLI/chamada real neste ambiente).

### AC-4: Cliente sem CNPJ/dado incompleto no Auvo não trava o import
- **Dado** um cliente no Auvo sem campo equivalente a CNPJ (ou outro campo opcional)
- **Quando** o import processa esse registro
- **Então** ele é importado mesmo assim com `cnpj = null` (coluna é nullable, migration
  `0001_E00-S00` — só `unique`, não `not null`) — um cliente com dado incompleto não pode travar o
  import inteiro nem ser pulado silenciosamente. **[OPEN-QUESTION]** o campo exato do Auvo
  equivalente a CNPJ não está confirmado (mapeamento externo não disponível) — se não houver campo
  claro, importar só com `nome`/`auvo_id` e deixar `cnpj = null`; não inventar/gerar um valor.

### AC-5: Gatilho — agendado + sob demanda (mesmo padrão de E01-S11)
- **Dado** a Edge Function `pcm-auvo-customers-import` implantada
- **Quando** (a) o `pg_cron` dispara no horário agendado, OU (b) alguém faz uma chamada HTTP
  autenticada (`service_role`) diretamente à função
- **Então** o import roda do mesmo jeito nos dois casos. Resolve tanto o bootstrap imediato (rodar
  uma vez manualmente após o deploy, sem esperar o cron) quanto manter a lista atualizada depois
  (novos clientes cadastrados no Auvo aparecem no PCM sem re-import manual).

## Casos de borda e erros
- **Paginação**: `GET /customers` é paginado (mesmo padrão de `/users`/`/equipments` em `E01-S11`
  — reaproveitar `_shared/auvo/paginate.ts` já existente, não duplicar).
- **Rate limit**: mesma nota de `E01-S11` — usar `pageSize` alto (100) para minimizar chamadas.
- **GRANT que falta (achado por inspeção do schema atual, não suposição)**: `pcm.clientes`
  (migration `0001_E00-S00`) hoje só tem `grant select, insert, update on pcm.clientes to
  authenticated` (migration `0002_E00-S05`, ajustado por `0009_E00-S09` para checar
  `user_modulos->>'pcm'`) — **não há nenhum GRANT para `service_role`** nesta tabela. A migration
  `0012_E01-S11` deu `grant usage on schema pcm to service_role`, mas `USAGE` no schema **não
  cascade para privilégio de tabela** — a Edge Function desta story vai levar `permission denied
  for table clientes` sem um `grant select, insert, update on pcm.clientes to service_role`
  explícito numa migration nova. **Não repetir o bug de GRANT esquecido já corrigido 2x neste
  projeto** (E00-S09 grupos, E01-S11 schema `pcm`) — `@dev`/`@sm`: incluir esse GRANT como task
  explícita, e rodar `lint:migrations` (que já checa `CREATE POLICY` ↔ `GRANT`) antes de considerar
  pronto.
- **RLS de `pcm.clientes` não muda**: diferente de `E01-S11` (cache read-only, só `service_role`
  escreve), `pcm.clientes` já é escrita por `authenticated` com `user_modulos->>'pcm' = 'escrita'`
  (pensado para o CRUD futuro) — esta story não restringe isso, só garante que `service_role`
  (a Edge Function) também consegue escrever. Nenhuma policy nova, nenhuma migration de RLS.

## Fora de escopo
> Vinculante. Não implemente nada aqui.
- **CRUD de cadastro de clientes no PCM** (criar/editar cliente manualmente pela UI) — decisão
  explícita do usuário de não fazer isso agora; fica como story futura quando for necessário.
- **Reconciliação por nome/CNPJ** de clientes que porventura já existam no PCM sem `auvo_id` — hoje
  a tabela está vazia em produção (confirmado pelo usuário via screenshot), então esse caso não
  existe ainda; se `pcm.clientes` deixar de estar vazio antes desta story rodar (ex.: alguém usar o
  Supabase Studio direto), o comportamento é indefinido — reconciliação por nome fica para quando o
  CRUD existir.
- **Hierarquia Administradora → Condomínio** — mesma razão de `E01-S12`, `pcm.clientes` continua
  plano.
- **Modificar `pcm-auvo-customers-sync`** (a function existente, direção PCM→Auvo) — continua
  existindo sem alteração, para o fluxo de criação de OS.
- **Endereço/outros campos do cliente além de nome/cnpj/auvo_id/ativo** — `pcm.clientes` só tem
  essas colunas (migration `0001_E00-S00`); campos adicionais exigiriam migration de schema, fora
  de escopo aqui.

## Rastreabilidade
- Design técnico: `../E01-S09-integracao-auvo-fundacao/design.md` (cliente HTTP, ACL — reaproveitados).
- Precedente de mesma direção (Auvo→PCM, cache/sync): `../E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md`.
- Blueprint de origem: `docs/blueprint/integracoes/auvo.md` → "Divisão de responsabilidades"
  (Clientes/condomínios: dono PCM, fluxo PCM→Auvo — esta story é o bootstrap inverso, não uma
  mudança da divisão de responsabilidades declarada).
- Schema: `supabase/migrations/0001_E00-S00_schemas_dominio.sql` (`pcm.clientes`),
  `0002_E00-S05_perfis_rbac.sql` + `0009_E00-S09_rls_modulos.sql` (GRANT/policy atuais).
- Function existente (não tocada, referência de padrão de auth interna):
  `supabase/functions/pcm-auvo-customers-sync/index.ts`.
