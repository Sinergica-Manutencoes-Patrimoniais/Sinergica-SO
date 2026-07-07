---
name: spec
description: Contrato — CRUD de Funcionários (técnicos/gestores) no PCM, promovendo pcm.tecnicos_cache (read-only desde E01-S11) para tabela editável sincronizada com Auvo /users (webhook User=1).
alwaysApply: true
---

# Spec — Funcionários

> **Fonte da verdade.** Status: **aprovado** ·
> Tier: Pequeno (usa o motor já construído; a promoção de RLS é uma mudança de política, não de
> mecanismo novo)
> Endpoint: `/users`. Webhook `User` (entity=1) — uma das 6 entidades em tempo real.

## Resumo
`pcm.tecnicos_cache` existe desde `E01-S11` como espelho **read-only** (só `pcm-auvo-users-sync`,
via `service_role`, escreve — `authenticated` tem só `SELECT`, com deny explícito de
INSERT/UPDATE/DELETE, `0012`). Esta story **promove** essa tabela para `pcm.funcionarios`,
editável pelo Fabrício, sincronizada nos dois sentidos pelo motor.

## Contexto específico (ler antes de implementar)
- `POST /users/` **exige** `name`, `culture`, `userType` (1-User/2-TeamManager/3-Administrator),
  `password` (até 14 chars!), `login`. Decisão do PO em 2026-07-07: **o PCM pode criar
  funcionário novo**, mesmo isso provisionando uma credencial de login real no Auvo. A UI deve
  tratar esse fluxo como provisionamento de acesso ao app de campo, não como metadado inofensivo.
- `PATCH /users/{id}`: JSON Patch — atributos editáveis não incluem claramente `password`/`login`
  no que foi documentado (mudar credencial provavelmente é um fluxo separado, não coberto aqui).
- **Sem campo `active`**: Users usa `unavailableForTasks` (boolean) para "indisponível para
  tarefas" — o `deactivatePatch` do descriptor é `{ unavailableForTasks: true }`, não
  `{ active: false }` (ver `E01-S22/design.md` → Riscos, achado documentado ali).
- Webhook `User` (entity=1) — tempo real, já coberto pelo dispatcher de `E01-S23`.
- `pcm.tecnicos_cache` hoje: `auvo_user_id`, `nome`, `equipe`, `ativo` (colunas mínimas, `0012`).
  Promoção para `pcm.funcionarios` deve ADICIONAR colunas (cargo/telefone/e-mail/tipo), não
  reescrever o que já existe — `equipe` continua sendo texto livre (não há tabela `equipes` ainda,
  isso é `E01-S32`).

## Critérios de aceite

### AC-1: Criar Funcionário no PCM provisiona usuário no Auvo
- **Dado** um usuário com `podeAcessar('pcm','escrita')` preenche nome, login, senha, cultura e
  `userType`
- **Quando** salva
- **Então** `pcm.funcionarios` ganha a linha, o outbox enfileira, o drain chama `POST /users/`,
  grava `auvo_user_id`/`auvo_id`, e a credencial criada passa a existir no Auvo

### AC-2: Editar Funcionário existente propaga como PATCH
- **Dado** um funcionário já importado (`auvo_id` preenchido, veio de `E01-S11`)
- **Quando** o usuário edita cargo/telefone/e-mail (campos que NÃO são credencial)
- **Então** o drain envia `PATCH` (JSON Patch)

### AC-3: "Excluir"/desativar funcionário usa `unavailableForTasks`, não `active`
- **Dado** um funcionário sincronizado
- **Quando** o usuário marca como inativo/desligado no PCM
- **Então** `pcm.funcionarios.deleted_at` (ou uma coluna `ativo=false` — decidir na
  implementação se é soft-delete completo ou só uma flag de disponibilidade) é atualizado, e o
  Auvo recebe `PATCH { unavailableForTasks: true }` (`deactivatePatch` do descriptor)

### AC-4: Mudança no Auvo chega ao PCM em tempo real (webhook User)
- **Dado** um funcionário editado no Auvo (ex.: RH muda telefone)
- **Quando** o webhook `User` (action=Alteração) chega
- **Então** `pcm.funcionarios` é atualizado (upsert por `auvo_user_id`/`auvo_id`) via
  `fn_apply_auvo_sync`

### AC-5: Tela lista/cria/edita com gate de permissão
- Mesmo padrão das demais entidades — leitura para todos com `pcm:leitura`, edição só com
  `pcm:escrita`.

### AC-6: RLS de `pcm.funcionarios` é RELAXADA de `pcm.tecnicos_cache`, deliberadamente
- **Dado** a migration de promoção
- **Quando** aplicada
- **Então** as policies `*_deny_insert`/`*_deny_update`/`*_deny_delete` de `0012` são substituídas
  por policies de escrita por módulo (`db/rls.template.sql`), com um comentário na migration
  explicando que isso inverte deliberadamente o contrato read-only original de `E01-S11`

## Casos de borda e erros
- **Criar funcionário novo pelo PCM** precisa pedir `login` e `password` no formulário. A senha
  nunca deve ser persistida no PCM após o envio; se o `POST /users/` falhar, mostrar erro claro e
  permitir o reenvio com nova senha informada pelo usuário.
- Funcionário sem `auvo_id` após criação pendente: deve aparecer como "aguardando sync" e bloquear
  ações que dependem do usuário real do Auvo até o outbox concluir.
- `equipe` (texto livre hoje) não vira FK para uma tabela `equipes` real nesta story — isso é
  `E01-S32`; manter como está para não acoplar as duas stories.

## Fora de escopo
- Editar `password`/`login`/horários de trabalho detalhados (`workSchedule`) — só os campos de
  identificação/contato/disponibilidade nesta leva.
- Vincular a uma tabela `equipes` real (`E01-S32`).

## Riscos
- Criar funcionário novo pelo PCM provisiona acesso real ao app de campo. O formulário precisa
  deixar claro o efeito operacional, restringir a ação a `pcm:escrita`, não persistir senha em
  tabela/log, e nunca incluir `password`/`login` em `PATCH` de edição comum.
- Promoção de RLS (AC-6) inverte uma decisão de segurança de `E01-S11` — revisar com atenção
  redobrada em code review, já que "read-only por design" virou "editável" (não é um bug, é a
  entrega desta story, mas merece o mesmo rigor de revisão de qualquer mudança de RLS).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}` (achado
  `unavailableForTasks` já documentado lá)
- Tabela a promover: `supabase/migrations/0012_E01-S11_cache_tecnicos_equipamentos.sql`
