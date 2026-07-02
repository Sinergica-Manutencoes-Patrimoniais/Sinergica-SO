---
name: product
description: PRD-lite da story E00-S05 — Autenticação e Autorização (Supabase Auth real + RBAC).
alwaysApply: false
---

# Product — E00-S05: Autenticação e Autorização

> **Tier:** arquitetural · **Status:** aprovado · **Dono:** @pm (Morgan) — sessão Lucas

## Problema

O login atual é um bypass de desenvolvimento: uma única credencial hardcoded
(`trivia@triviastudio.com.br` / `Trivia123456`) aceita em `apps/web/src/app/auth-context.tsx`,
sem sessão real, sem vínculo com um usuário de banco, e com o papel gravado apenas no
`localStorage` do navegador. Isso bloqueia dois avanços:

1. **Produção real:** não é possível colocar o sistema no ar com uma única senha compartilhada
   entre todos os papéis (`admin`, `escritorio`, `tecnico`, `cliente-sindico`).
2. **Todas as próximas features:** toda tabela de domínio já está com `RLS FORCE` habilitado
   (migration `0001_E00-S00`), mas nenhuma policy real de acesso por papel existe ainda — porque
   não há, hoje, uma fonte de verdade no banco para "quem é o usuário logado e qual seu papel".
   Sem essa camada, cada story de domínio (PCM, Comercial, Financeiro…) teria que reinventar sua
   própria lógica de identidade.

## Para quem

- **Admin (Trívia Studio / gestão Sinérgica):** acesso total, hoje é o único perfil usado em
  demos. Login diário.
- **Escritório (equipe operacional Sinérgica):** login diário, uso intenso nos módulos
  operacionais (PCM, Comercial, Financeiro).
- **Técnico:** login esporádico pelo navegador (o principal canal de campo é o Auvo, não este
  sistema) — mas precisa existir para as telas de inspeção/OS do técnico já mapeadas no roadmap
  (E01).
- **Cliente-síndico:** fora do fluxo desta story (ver Non-goals) — hoje interage via WhatsApp
  (Zé) e, futuramente, Área do Cliente. Precisa apenas que o **papel exista no modelo de dados**
  para não travar o desenho da Área do Cliente (E09).

## Resultado esperado / métrica de sucesso

- **Métrica 1:** 0 usuários autenticando via credencial hardcoded em qualquer ambiente após o
  merge (bypass removido do código, não apenas desativado por flag).
- **Métrica 2:** 100% das tabelas de domínio hoje existentes (`pcm.clientes`,
  `pcm.ordens_servico`, `atendimento.config_ze`, `atendimento.wa_messages`,
  `atendimento.wa_queue`, `comercial.leads`, `config.feature_flags`) com pelo menos uma RLS
  policy real que referencia o papel do usuário autenticado (não apenas `force row level
  security` sem policy de acesso).
- **Baseline hoje:** 1 credencial universal, 0 policies de acesso por papel → **Alvo:** 4 papéis
  distintos autenticados via Supabase Auth, policies de acesso aplicadas nas 7 tabelas acima.

## Goals

- Autenticação real via **Supabase Auth** (e-mail/senha), com sessão gerenciada pelo SDK
  (`@supabase/supabase-js`), substituindo o `localStorage` manual.
- Fonte de verdade de **papel do usuário** no Postgres, vinculada 1:1 a `auth.users`, disponível
  para políticas de RLS e para o frontend.
- Um **padrão reutilizável de RLS por papel** (função/helper) documentado e aplicado às tabelas
  de domínio já existentes — para que as próximas stories de cada bounded context só precisem
  seguir o padrão, não reinventá-lo.
- Guard de rota no frontend: usuário sem sessão válida não acessa telas internas.
- Logout real (invalida sessão no Supabase, não só limpa `localStorage`).

## Non-goals

- **SSO / login social** (Google, Microsoft) — não solicitado, sem caso de uso hoje.
- **MFA** — não é requisito de segurança levantado para o Mês 1/2; reavaliar se Financeiro exigir.
- **Tela de "esqueci minha senha" customizada** — usar o fluxo padrão do Supabase Auth
  (magic link/reset por e-mail) sem UI própria nesta story.
- **Telas de administração de usuário** (convite, criação de conta, desativação pela UI) —
  provisionamento de novos usuários feito manualmente via Supabase Dashboard/SQL nesta fase.
  Vira story própria quando houver demanda (ex.: onboarding de novo técnico).
- **Autenticação do cliente-síndico** (WhatsApp/portal) — pertence à story de Área do Cliente
  (E09); aqui só garantimos que o papel `cliente-sindico` existe no modelo de dados.
- **Policies granulares por regra de negócio** (ex.: técnico só vê OS onde é responsável) — esta
  story estabelece o **padrão** e aplica um recorte por papel amplo (ex.: `tecnico` lê, não
  escreve fora do próprio). Regras finas de "dono do registro" ficam para a story de cada domínio
  (ex.: E01-S07 Hub de OS), referenciando o helper criado aqui.

## Riscos / premissas

- **Premissa:** o projeto Supabase (`ljvpmcamqydeklvkiigy.supabase.co`) já tem o schema `auth`
  provisionado por padrão (Supabase Auth habilitado out-of-the-box) — não requer setup adicional
  de infraestrutura.
- **Risco:** se a criação do registro de perfil (papel) não for automática ao criar o usuário
  (ex.: trigger `on auth.users insert`), contas criadas manualmente no Dashboard ficam sem papel
  e quebram o guard de rota / RLS silenciosamente. Mitigação: `@architect` deve decidir entre
  trigger automático vs. criação explícita documentada — decisão vai para `design.md`.
- **Risco:** aplicar RLS policy por papel em tabelas com dados já existentes (ex.: `pcm.clientes`
  populado por seed/demo) pode quebrar telas que hoje leem sem autenticação real (dashboard
  mock). Mitigação: `@qa` valida que as telas com dados mock continuam funcionando com o usuário
  `admin` logado de verdade antes do merge.
- **Risco:** guard de rota mal implementado pode causar loop de redirecionamento ou "flash" de
  tela protegida antes do redirect — `@dev` deve tratar estado de loading da sessão.
