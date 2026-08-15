---
name: E02-S34-modelo-ia-por-agente-tasks
description: Tasks executáveis para E02-S34 — pivô de design confirmado com Lucas em 2026-08-15
alwaysApply: false
---

# Tasks — E02-S34 — Modelo de IA por agente

Owner: Claude (sessão Lucas) · Início: 2026-08-15

## SPEC_DEVIATION (decisão consciente, confirmada com Lucas)
`spec.md` AC-1 pede tabela nova `config.agentes_ia`. Descoberto durante implementação:
**`atendimento.personas.modelo_llm`** (migration `0053_E02-S13_atendimento_config_ia.sql`) já
existe, já tem UI própria (`OperacaoTab.tsx`, dentro de `AtendimentoConfigPage.tsx`), e já é lido
pelos 2 call sites que a E02-S34 quer configurar (`extrairChamadoViaOpenRouter` com
`persona.modelo_llm` da persona `tipo='chamados'` = "Zé"; `extrairLeadViaOpenRouter` com a persona
`tipo='comercial'` = "Assistente Atendimento"). Criar `config.agentes_ia` duplicaria a fonte de
verdade do mesmo dado. Perguntei a Lucas: decisão foi **estender `personas.modelo_llm`**, não criar
tabela nova. Migration `0207_E02-S34_config_agentes_ia.sql` que eu tinha escrito foi descartada
antes de aplicada (renumerado — `0207` agora é a migration de E02-S32).

O gap real (o que a E02-S34 resolve de fato):
1. `persona.modelo_llm` vazio caía num fallback de ENV VAR (`OPENROUTER_ZE_MODEL`), não no modelo
   global do Vault (`config.integracoes.config_publico.modelo`) — cadeia de fallback incompleta.
2. Os 2 call sites (`extrairChamadoViaOpenRouter`, `extrairLeadViaOpenRouter`) leem
   `OPENROUTER_API_KEY` de env direto, bypassando o Vault — debito arquitetural pré-existente
   (comentário antigo em `_shared/openrouter.ts` dizia isso ser "fora de escopo de E01-S81").
3. `tentarMelhorarTituloOs` (dentro de `pcm-ze-agent`) resolve a credencial na mão (lê
   `config.integracoes`/Vault inline) em vez de usar `obterConfiguracaoOpenRouter()` — duplica lógica.

## Tarefas

1. **`_shared/openrouter.ts`**: `obterConfiguracaoOpenRouter()` volta a não receber `agentNome` —
   `modelo` retornado é só o fallback GLOBAL (`config.integracoes.config_publico.modelo` ||
   `"google/gemini-2.5-flash"`). Resolução por agente vira responsabilidade do chamador:
   `persona.modelo_llm || configuracao.modelo`.
2. **`pcm-ze-agent/index.ts`**: `extrairChamadoViaOpenRouter`/`extrairLeadViaOpenRouter` passam a
   receber `apiKey` como parâmetro (não leem `OPENROUTER_API_KEY` de env) — resolvidos uma vez no
   caller via `obterConfiguracaoOpenRouter()`, junto com `modelo = persona.modelo_llm ||
   configuracao.modelo`. Remove o fallback de `OPENROUTER_ZE_MODEL`/env var duplicado.
3. **`tentarMelhorarTituloOs`**: troca a leitura manual de `config.integracoes`/Vault por
   `obterConfiguracaoOpenRouter()`.
4. **Gasto de IA (tie-in com E02-S31)**: como os 2 call sites passam a fazer `fetch` com `apiKey`
   resolvido pelo Vault, aproveita pra capturar `data.usage` e chamar `registrarGastoIa({modulo:
   'atendimento', ...})` com `refId` = id da mensagem que `registrarMensagemAgente` acabou de
   inserir (muda `registrarMensagemAgente` pra retornar o id inserido via `.select('id').single()`).
5. **UI**: nenhuma tela nova — `OperacaoTab.tsx` já edita `modelo_llm` por persona. Verificar/ajustar
   texto de ajuda pra deixar claro que campo vazio usa o modelo global de Configurações > IA.
6. **Testes**: unit (fallback: persona com modelo, persona sem modelo cai no global, ambos vazios
   cai no hardcoded) · Playwright (se aplicável, reusa specs existentes de `OperacaoTab`).

## Fora de escopo (reafirmado do spec.md)
Tokens/rate limit por agente · prompt customizável por agente · tabela `config.agentes_ia` (decisão
revertida).
