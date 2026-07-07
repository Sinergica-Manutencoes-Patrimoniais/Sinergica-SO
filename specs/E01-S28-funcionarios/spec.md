---
name: spec
description: Contrato — CRUD de Funcionários (técnicos/gestores) no PCM, promovendo pcm.tecnicos_cache (read-only desde E01-S11) para tabela editável sincronizada com Auvo /users (webhook User=1).
alwaysApply: true
---

# Spec — Funcionários

> **Fonte da verdade.** Status: **aprovado com uma decisão de produto pendente** (ver Riscos) ·
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
  `password` (até 14 chars!), `login`. Isso significa **criar um funcionário no PCM cria uma
  credencial de login no Auvo** — não é um cadastro inofensivo de metadado, é provisionar acesso
  real ao app de campo (GPS, fotos, check-in/out). Ver Riscos.
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

### AC-1: Editar Funcionário existente propaga como PATCH
- **Dado** um funcionário já importado (`auvo_id` preenchido, veio de `E01-S11`)
- **Quando** o usuário edita cargo/telefone/e-mail (campos que NÃO são credencial)
- **Então** o drain envia `PATCH` (JSON Patch)

### AC-2: "Excluir"/desativar funcionário usa `unavailableForTasks`, não `active`
- **Dado** um funcionário sincronizado
- **Quando** o usuário marca como inativo/desligado no PCM
- **Então** `pcm.funcionarios.deleted_at` (ou uma coluna `ativo=false` — decidir na
  implementação se é soft-delete completo ou só uma flag de disponibilidade) é atualizado, e o
  Auvo recebe `PATCH { unavailableForTasks: true }` (`deactivatePatch` do descriptor)

### AC-3: Mudança no Auvo chega ao PCM em tempo real (webhook User)
- **Dado** um funcionário editado no Auvo (ex.: RH muda telefone)
- **Quando** o webhook `User` (action=Alteração) chega
- **Então** `pcm.funcionarios` é atualizado (upsert por `auvo_user_id`/`auvo_id`) via
  `fn_apply_auvo_sync`

### AC-4: Tela lista/edita com gate de permissão
- Mesmo padrão das demais entidades — leitura para todos com `pcm:leitura`, edição só com
  `pcm:escrita`.

### AC-5: RLS de `pcm.funcionarios` é RELAXADA de `pcm.tecnicos_cache`, deliberadamente
- **Dado** a migration de promoção
- **Quando** aplicada
- **Então** as policies `*_deny_insert`/`*_deny_update`/`*_deny_delete` de `0012` são substituídas
  por policies de escrita por módulo (`db/rls.template.sql`), com um comentário na migration
  explicando que isso inverte deliberadamente o contrato read-only original de `E01-S11`

## Casos de borda e erros
- **Criar funcionário novo pelo PCM** (não apenas editar um já importado): decisão de produto em
  aberto — ver Riscos. Enquanto não decidido, a tela do PCM permite EDITAR mas não CRIAR um
  funcionário novo (o cadastro inicial continua no Auvo, onde o onboarding com credencial já é o
  fluxo natural); a listagem/edição funciona sobre os funcionários já importados por `E01-S11`.
- Funcionário sem `auvo_id` (não deveria existir, já que `pcm.funcionarios` só existe via import
  do Auvo) — se a tela permitir criar no futuro, precisa do fluxo de `password`/`login` completo,
  fora do escopo desta leva.
- `equipe` (texto livre hoje) não vira FK para uma tabela `equipes` real nesta story — isso é
  `E01-S32`; manter como está para não acoplar as duas stories.

## Fora de escopo
- Criar funcionário novo (com credencial de login) pelo PCM — ver Riscos, decisão de produto
  pendente.
- Editar `password`/`login`/horários de trabalho detalhados (`workSchedule`) — só os campos de
  identificação/contato/disponibilidade nesta leva.
- Vincular a uma tabela `equipes` real (`E01-S32`).

## Riscos
- **[DECISÃO DE PRODUTO PENDENTE]** Permitir que o PCM crie um funcionário novo significa que o
  Fabrício (ou qualquer `pcm:escrita`) provisiona uma credencial de login real no Auvo (senha
  definida no formulário, até 14 caracteres). Isso é diferente de editar um cadastro — é
  segurança de acesso ao app de campo. **Antes de implementar o `criar-funcionario` use case,
  confirmar com o Lucas/Fabrício se esse fluxo deve existir no PCM ou se criação continua
  exclusiva do Auvo** (PCM só edita/lista o que já existe). Esta spec assume a segunda opção até
  confirmação explícita (ver AC/Casos de borda).
- Promoção de RLS (AC-5) inverte uma decisão de segurança de `E01-S11` — revisar com atenção
  redobrada em code review, já que "read-only por design" virou "editável" (não é um bug, é a
  entrega desta story, mas merece o mesmo rigor de revisão de qualquer mudança de RLS).

## Rastreabilidade
- Design/Domínio: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}` (achado
  `unavailableForTasks` já documentado lá)
- Tabela a promover: `supabase/migrations/0012_E01-S11_cache_tecnicos_equipamentos.sql`
