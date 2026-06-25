---
name: spec-E00-S01-login-home
description: Contrato da tela de login e home com cards dos módulos (shell do OS). Fonte da verdade do gate de testes.
alwaysApply: false
---

# Spec — E00-S01: Login + Home (Shell do OS)

> Épico: E00 — Shell & Infra · Tier: pequeno · Status: **implementado**
> Implementado sem passar pelo processo de agentes — registrado retroativamente. Ver `docs/epics/ROADMAP.md`.

## Resumo
Usuário acessa o OS via tela de login (e-mail + senha). Após autenticação, vê a home com os 9
módulos do sistema exibidos em cards, cada um marcado como "Em construção". Serve como casca
navegável para demonstrar o roadmap do produto.

## Critérios de aceite (AC)

### AC-1: Rota protegida — redireciona para login se não autenticado
- Dado um usuário que acessa `/` sem sessão ativa
- Quando o sistema processar a rota
- Então o usuário é redirecionado para `/login`

### AC-2: Login com e-mail e senha válidos
- Dado um usuário que preenche e-mail e senha válidos e clica em "Entrar"
- Quando o sistema processar o formulário
- Então o usuário é autenticado, sessão persiste no localStorage e é redirecionado para `/`

### AC-3: Feedback de loading durante autenticação
- Dado um usuário que clicou em "Entrar"
- Quando o sistema estiver processando (latência simulada)
- Então o botão exibe "Entrando…" e fica desabilitado

### AC-4: Validação de campos obrigatórios
- Dado um usuário que clica em "Entrar" com campos vazios
- Quando o sistema validar o formulário
- Então exibe mensagem de erro sem chamar o backend

### AC-5: Home exibe os 9 módulos com badge "Em construção"
- Dado um usuário autenticado que acessa `/`
- Quando a home renderizar
- Então exibe 9 cards (PCM, Atendimento, Comercial, Financeiro, Operação, Marketing, Growth, Gestão, Área do Cliente), cada um com badge "Em construção"

### AC-6: Logout remove sessão e redireciona para login
- Dado um usuário autenticado que clica em "Sair"
- Quando o sistema processar o logout
- Então a sessão é removida do localStorage e o usuário é redirecionado para `/login`

## Fora de escopo (VINCULANTE)
- Autenticação real via Supabase (mock por enquanto — substitui quando Supabase for provisionado).
- Navegação interna dos módulos (os cards não são clicáveis — os módulos ainda não existem).
- Controle de permissão por papel (admin/escritorio/tecnico) — toda role acessa a home.

## Rastreabilidade
- Tasks: [tasks.md](tasks.md)
- Implementação: `apps/web/src/features/auth/pages/LoginPage.tsx`, `apps/web/src/app/HomePage.tsx`
- Épico: [ROADMAP.md](../../docs/epics/ROADMAP.md)

## SPEC_DEVIATION
- `// SPEC_DEVIATION: story implementada sem abertura formal pelo @pm/@analyst e sem tasks.md prévio.`
  Motivo: primeira iteração de UI — spec registrada retroativamente. Corrigir processo nas próximas stories.
