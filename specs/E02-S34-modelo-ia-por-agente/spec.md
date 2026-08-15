---
name: E02-S34-modelo-ia-por-agente
description: Permitir escolher modelo de IA por agente (Atendimento/Zé), com fallback global
alwaysApply: true
---

# E02-S34 — Modelo de IA por agente

> **SPEC_DEVIATION (2026-08-15, confirmado com Lucas):** AC-1 pede tabela nova
> `config.agentes_ia`. Descoberto que `atendimento.personas.modelo_llm` já faz esse papel pros 2
> agentes citados (Zé, Assistente Atendimento), com UI própria. Decisão: estender
> `personas.modelo_llm` (fallback pro modelo global quando vazio) em vez de duplicar a fonte de
> verdade. Ver `tasks.md` pro design corrigido; ACs abaixo continuam válidos em espírito (mesmo
> comportamento observável), só a AC-1 (tabela) não se aplica literalmente.

## Contexto
Hoje existe um único modelo global OpenRouter (E00-S13): `Configurações > Integrações > Modelo`.
Cada **agente** (Zé = abertura de chamado, assistente de atendimento) usa esse modelo.

Lucas quer: **modelo configurável por agente**, com o global como fallback default.

## Requisitos

### AC-1: Tabela de agentes IA
- `config.agentes_ia` (id, nome, modelo, ativo, created_at)
- Seed: "Agente Zé" + "Assistente Atendimento" com modelos default (global)

### AC-2: Configuração por agente
- Tela `ConfiguracaoAgentesIaPage` (Configurações > Integrações > Agentes IA)
- Tabela com agentes, modelo selecionável (dropdown de modelos OpenRouter disponíveis)
- Botão "Usar global" (reseta pro modelo default global)

### AC-3: Fallback global
- Se agente não tem modelo setado: usa `config.integracoes.modelo` (global)
- Se global também vazio: usa hardcoded `google/gemini-2.5-flash` (AC-1 de E00-S13)

### AC-4: Uso no código
- `_shared/openrouter.ts` recebe `agentId` (ou nome) como parâmetro
- Resolve: `config.agentes_ia[agentId].modelo || config.integracoes.modelo || default`
- Edge Functions (`pcm-ze-agent`, `atendimento-whatsapp-envio`) passam `agentId` ao chamar OpenRouter

## Fora de escopo
- Tokens/rate limit por agente (só modelo)
- Prompt customizável por agente (hoje é global no `_shared/`)

## Tier
Pequeno (1 tabela, 1 tela, mudança em OpenRouter caller).

---

## Tarefas

1. **Migration `0208`:** `config.agentes_ia` + seed 2 linhas
2. **Migration `0209`:** `config.integracoes` ganha `modelo` (existia? conferir E00-S13)
3. **Adapter:** `supabase-config-adapter.ts` lê agentes + modelo fallback
4. **UI:** `ConfiguracaoAgentesIaPage` nova (tabela + dropdown)
5. **Integração:** `_shared/openrouter.ts` recebe `agentId`, resolve modelo
6. **Edge:** `pcm-ze-agent`, `atendimento-whatsapp-envio` passam `agentId` ao invocar
7. **Testes:** unit (resolução de fallback) + Playwright (UI config)

---

## Validação
- `ci:local` verde
- Smoke: trocar modelo do agente Zé, criar chamado, verifica payload real do OpenRouter
- Playwright: dropdown, "Usar global", fallback funciona
