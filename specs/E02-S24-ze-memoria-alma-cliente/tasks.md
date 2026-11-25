---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Memória e "alma" por cliente para o Zé

> ADR-0015 já registrado (estratégia textual, RAG adiado). Formato da alma resolvido: **texto livre
> único** (mesmo padrão de `persona.base_conhecimento`, já existente e testado neste codebase).

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                                  | Status |
|----|--------------------------------------------------------------------------|----------|------------|-------------------------------------------------|--------|
| 1  | Migration: `atendimento.cliente_alma` + `cliente_memoria_resumo` + RLS FORCE | AC-1,AC-3 | —     | `lint:migrations`/squawk verde                  | done   |
| 2  | Composição de contexto: `comporContextoCliente` (alma+resumo) + `comporPromptPersona` estendido | AC-1,AC-2 | 1 | Deno test (não executado — sem Deno CLI) | done |
| 3  | Job de resumo rolante + saída da janela crua por retenção                | AC-3     | 1          | `supabase test db supabase/tests/E02-S24_memoria_resumo.test.sql` (8/8) + `deno test supabase/functions/_shared/memoria-cliente.test.ts` (13/13) | done (2026-11-25) |
| 3b | Janela crua de 30 dias no `pcm-ze-agent` (antes era só "últimas 20")     | AC-2     | 3          | `deno check` + testes de 3                      | done (2026-11-25) |
| 3c | Budget: alma inteira, resumo truncado com log                            | AC-1,AC-3 | 3         | `deno test` (3 casos de orçamento)              | done (2026-11-25) |
| 3d | UI: resumo rolante visível (somente leitura) na Visão 360 → Comunicação  | AC-3     | 3          | `tsc --noEmit` verde; flag `VITE_SSO_ZE_MEMORIA_CLIENTE_ENABLED` declarada | done (2026-11-25) |
| 4  | Tool de consulta de chamados sob demanda                                 | AC-5     | —          | **não feito — ver SPEC_DEVIATION**              | bloqueado |
| 5  | UI: editar "alma" na aba Comunicação da Visão 360 do cliente             | AC-6     | 1          | typecheck + vitest verdes                       | done   |
| 6  | Isolamento por `cliente_id` (segurança) — teste que prova não-vazamento  | AC-4     | 2          | Deno test (`comporContextoCliente`, isolamento por chamada) | done |
| 7  | Evals do prompt: usa contexto corretamente; budget respeitado            | AC-1,AC-2,AC-3 | 2,3    | **não feito — ver SPEC_DEVIATION**              | bloqueado |

## Plano de teste
- Unidade: `comporContextoCliente` (5 casos: vazio, só alma, só resumo, ambos, isolamento entre 2
  clientes), `validarAlma` (3 casos), `comporPromptPersona` com o novo parâmetro opcional (testes
  existentes seguem passando sem alteração — parâmetro é opt-in).
- Segurança: isolamento entre clientes garantido por construção — `buscarMemoriaCliente` sempre
  filtra por `clienteId` único (nunca lista "todos"); `comporContextoCliente` só recebe o que já
  veio filtrado. Não há teste de integração ponta a ponta (exige Postgres real).
- Eval LLM (`ia/`): **não criado** — ver SPEC_DEVIATION.
- Aceite: Playwright não rodado (pendente teste local do Lucas).

## Divergências (SPEC_DEVIATION)

### Abertas nesta rodada (2026-11-25)
- [x] **Retenção é saída do contexto, NÃO exclusão física.** A spec diz "o conteúdo cru antigo é
  descartado conforme a política de retenção". A migration 1880 **não apaga** `atendimento.mensagens`:
  mensagem com mais de 90 dias simplesmente deixa de entrar em qualquer contexto do Zé (nem crua,
  nem resumida). Motivo: apagar histórico real de WhatsApp de cliente é irreversível, é dado de
  atendimento com valor operacional e jurídico, e nenhuma ADR autoriza. Resolução: se exclusão
  física for mesmo desejada, precisa de ADR própria — o recorte de contexto já entrega o efeito
  que o AC-3 descreve (o conteúdo antigo não influencia mais a resposta diretamente).
- [x] **Do TriviAtende, não foram portadas** a `regra-de-conduta`/`protecao`/`fonte-de-conhecimento`
  como MODELO DE DADOS (regras nomeadas com métricas de uso, política de proteção com 14 motivos
  de bloqueio, Fonte citável com validade). Motivo: ADR-0015 trava a estratégia **textual** desta
  story; trocar a alma de texto livre por regras estruturadas é redesenho de schema + nova ADR, e
  seria a terceira forma de "conhecimento do agente" convivendo com `persona.base_conhecimento` e
  `atendimento.conhecimento`. O que foi portado é a IDEIA de `fonte-de-conhecimento`: separar o
  que está quente (janela crua) do que virou conhecimento consolidado (resumo), com validade.

### Resolvidas nesta rodada
- [x] ~~**Task 3 (job de resumo rolante) não implementada.**~~ **Resolvida em 2026-11-25**:
  migration 1880 (`fn_clientes_para_resumo_memoria`, `fn_mensagens_para_resumo_memoria`, cron
  diário `atendimento_memoria_resumo_diario`) + Edge Function `atendimento-memoria-resumo`.
  Frequência escolhida: **uma vez por dia, 04:25** — o resumo cobre meses, granularidade fina não
  muda a resposta e só multiplica chamada de LLM paga. Teto de 20 clientes por execução, sempre os
  mais atrasados primeiro. Texto original abaixo, preservado para rastreio:

- [x] **Task 3 (job de resumo rolante) não implementada.** A tabela `cliente_memoria_resumo` existe
  e já é lida/injetada no prompt, mas **nada a preenche ainda** — fica vazia até alguém rodar um job
  (cron + edge function + chamada de LLM pra resumir). Motivo: decidir frequência/custo desse job é
  uma escolha de produto (quanto custa rodar resumo pra todos os clientes ativos, com que
  periodicidade) que não me cabe decidir sozinho. Resolução: Lucas define frequência aceitável;
  depois é uma edge function nova (`pcm-cliente-memoria-resumo` ou similar) agendada via pg_cron,
  reusando o padrão de `pcm-auvo-tasks-import` (cron horário existente).
- [x] **Task 4 (tool de consulta de chamados sob demanda) não implementada.** O Zé hoje não tem
  mecanismo de "tool calling" via OpenRouter (extração é sempre 1 chamada JSON, sem function
  calling) — adicionar isso é uma mudança de arquitetura da integração com o LLM, não uma tarefa
  pontual. Fica para uma story própria se/quando for prioridade.
- [x] **Task 7 (evals) não implementada.** Sem harness de eval configurado neste ambiente.

## Checklist de Definition of Done
- [x] Migration + composição de contexto + isolamento implementados e revisados
- [x] UI de edição da alma funcional (convertida para TanStack Query em 2026-11-25)
- [x] Job de resumo rolante (migration 1880 + `atendimento-memoria-resumo` + cron diário)
- [ ] Tool de consulta de chamados (SPEC_DEVIATION — mudança de arquitetura maior)
- [ ] Evals (SPEC_DEVIATION — sem harness)
- [ ] `docs/STATE.md` atualizado
