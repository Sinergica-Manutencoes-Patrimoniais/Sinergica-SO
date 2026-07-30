---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Zé abre chamado a partir do contexto da conversa

> **Achado (2026-07-28):** `buscarMensagens` (`pcm-ze-agent/index.ts`) já limita a `.limit(20)` —
> AC-1 (janela de contexto) já estava satisfeita antes desta story, `X = 20` mensagens. Não mudei
> esse valor (fora de escopo confirmar se é o ideal, mas já é comportamento existente e estável).

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                                        | Status |
|----|----------------------------------------------------------------------|----------|------------|-------------------------------------------------------|--------|
| 1  | ~~Definir X~~ já existia (`buscarMensagens.limit(20)`)               | AC-1     | —          | —                                                       | done (pré-existente) |
| 2  | Prompt (migration 0157) + parsing multi-item (`itens: [...]`)        | AC-2, AC-3 | —        | revisão manual (sem Deno CLI/eval real neste ambiente) | done (não validado contra LLM real) |
| 3  | Máquina de confirmação síncrona (`chamados_pendentes` em `atendimento.conversas`) | AC-4 | 2  | revisão manual                                          | done (não validado contra LLM real) |
| 4  | `interpretarConfirmacao`/`montarResumoPendentes` — puros, testáveis sem LLM | AC-4 | 3   | Deno test (não executado neste ambiente, sem Deno CLI) | done   |
| 5  | Gravar N chamados em `pcm.chamados` (`origem="whatsapp"`) e devolver CH-XXXX | AC-5 | 2,3 | revisão manual                                         | done   |
| 6  | Caso de borda: ambíguo → repergunta sem re-rodar IA; sem conversa → degrada pro fluxo antigo (cria direto) | AC-2,AC-5 | 3 | revisão manual | done |

## Plano de teste
- Unidade: `interpretarConfirmacao` (confirma/nega/ambíguo, tolerância a acento) e
  `montarResumoPendentes` (1 item vs N itens) — `supabase/functions/_shared/confirmacao-texto.test.ts`,
  **não executado** neste ambiente (sem Deno CLI disponível, mesma limitação já registrada em E01-S99).
- Integração: gravação em `pcm.chamados`/`pcm.ordens_servico` com `chamado_id` — não testado (exige
  Postgres real).
- Aceite: Playwright/E2E real do WhatsApp não é viável sem instância Evolution + OpenRouter reais —
  **fica pendente de teste manual do Lucas em produção/staging**, mesmo cuidado já registrado em
  outras features de IA deste projeto (E01-S81/E04-S09/E01-S85: "não simular IA real").
- Eval LLM (`ia/`): **não criado** — trilha `ia/`/`@prompt-engineer` não acionada nesta sessão por
  falta de harness de eval configurado; risco real de o prompt novo (migration 0157) não se
  comportar como esperado até validação manual.

## Divergências (SPEC_DEVIATION)
- [x] Trilha `ia/` (evals formais, defesa a prompt injection) não executada — sem harness disponível
  neste ambiente. Resolução: Lucas testa manualmente com o WhatsApp real antes do PR; se o prompt
  não separar bem múltiplas solicitações, ajustar o texto em `atendimento.personas.prompt_sistema`
  (persona 'chamados') direto pela `AtendimentoConfigPage`, sem precisar nova migration.

## Checklist de Definition of Done
- [x] Código implementado (extração multi-item, confirmação síncrona, criação de N chamados)
- [ ] Testado manualmente pelo Lucas com WhatsApp/OpenRouter reais antes do PR
- [ ] Deno tests executados (sem Deno CLI neste ambiente)
- [x] `X` = 20 mensagens (já existia, documentado)
- [ ] `docs/STATE.md` atualizado
