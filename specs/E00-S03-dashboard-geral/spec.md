---
name: spec-E00-S03-dashboard-geral
description: >
  Auth bypass de desenvolvimento (credencial única para testes) + Dashboard Geral inicial
  mostrando resumo dos 9 módulos. Tier Pequeno — sem novo schema, sem design.md.
story: E00-S03
tier: pequeno
status: aprovado
alwaysApply: false
---

# Spec — E00-S03: Auth bypass dev + Dashboard Geral inicial

> **Épico:** E00 — Shell & Infra
> **Story:** E00-S03
> **Tier:** Pequeno (sem decisão arquitetural irreversível)
> **Fase:** Mês 1 — casca funcional para testes

## Problema

O mock de autenticação aceita qualquer email/senha, o que é inadequado para demonstrações. A landing page após login mostra apenas o módulo PCM; os outros 8 módulos ficam invisíveis na visão inicial, dificultando a apresentação do sistema completo.

## Solução

1. **Auth bypass controlado:** aceitar somente `trivia@triviastudio.com.br / Trivia123456` durante o Mês 1. Substituição por Supabase Auth está planejada para o Mês 2.
2. **Dashboard Geral como landing:** aba "Início" ativa por padrão, mostrando um card por módulo com KPIs resumidos. Permite visualizar e navegar para qualquer módulo.

## Personas

- **Admin (Trívia Studio):** acessa o sistema para demos, apresentações e desenvolvimento. É o único usuário nesta fase.

## Fora de escopo

- Supabase Auth real (Mês 2)
- Dados reais via API (todo KPI é mock hardcoded)
- Role-based access control efetivo (todos os papéis veem o mesmo — Mês 2)
- Links funcionais nos menus da sidebar para módulos ainda não construídos

## Acceptance Criteria

### AC-1 — Login restrito ao bypass de desenvolvimento
**Given** a página de login está aberta  
**When** o usuário submete qualquer combinação de email/senha diferente de `trivia@triviastudio.com.br / Trivia123456`  
**Then** o formulário exibe a mensagem "Usuário ou senha inválidos" sem revelar qual campo está incorreto, e nenhuma sessão é criada

### AC-2 — Landing inicial é o Dashboard Geral
**Given** o usuário faz login com as credenciais corretas  
**When** é redirecionado para a home  
**Then** a aba "Início" está ativa e o conteúdo principal exibe o Dashboard Geral (não o dashboard PCM)

### AC-3 — Dashboard Geral exibe cards de todos os módulos
**Given** o Dashboard Geral está visível  
**When** o usuário observa o conteúdo  
**Then** são exibidos exatamente 9 cards — um por módulo — cada um com ícone, nome e no mínimo 2 KPIs com dados mock

### AC-4 — Navegação a partir do card ou da aba superior
**Given** o Dashboard Geral está visível  
**When** o usuário clica em "Ver módulo →" dentro de qualquer card, OU clica na aba do módulo no topo  
**Then** o conteúdo principal troca para aquele módulo e a aba correspondente fica ativa

### AC-5 — Sidebar em "Início" lista todos os módulos
**Given** a aba "Início" está ativa  
**When** o usuário observa a sidebar esquerda  
**Then** são exibidos os 9 módulos como atalhos clicáveis; clicar em um equivale a clicar na aba superior

### AC-6 — Sidebar PCM mantém grupos sem regressão
**Given** o usuário navega para a aba PCM  
**When** observa a sidebar  
**Then** os grupos OPERAÇÃO, PREVENTIVO e RELATÓRIOS aparecem com todos os itens anteriores, sem regressão

### AC-7 — Logout funciona corretamente
**Given** o usuário está autenticado  
**When** clica em "Sair"  
**Then** a sessão é removida do localStorage e o usuário é redirecionado para `/login`

### AC-8 — Gates de qualidade
**Given** a implementação está completa  
**When** os scripts são executados  
**Then** `pnpm run typecheck` e `pnpm exec biome check apps/web/src/` passam sem erros ou warnings

## Regras de negócio

- A senha `Trivia123456` **nunca** é logada (não chamar `log.*` com dados de credencial)
- A mensagem de erro do login é genérica — não diferencia "email não existe" de "senha errada"
- O `localStorage` armazena apenas `{ name, email, role }` — sem senha ou token
- O código de bypass deve conter comentário `// DEV-ONLY` explícito para não passar para prod
- Os KPIs do Dashboard Geral são todos mock hardcoded — nenhuma chamada de API

## Definição de Done

- [ ] AC-1 a AC-8 verificados manualmente no browser (dev server)
- [ ] `pnpm run typecheck` verde
- [ ] `pnpm exec biome check apps/web/src/` verde
- [ ] PR aberto com referência E00-S03 no título
- [ ] ROADMAP.md e STATE.md atualizados
