---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Agente entrevistador de cadastro de cliente/estrutura

> **Atualização 2026-07-29:** Lucas confirmou que já esperava usar isso pelo botão "Editar com IA"
> no cadastro do cliente (item 7 do feedback de teste local) — ver `product.md`/`spec.md` AC-7.
> Não muda o SPEC_DEVIATION abaixo (motor continua não implementado), só reforça a prioridade: os
> dois pontos de entrada (onboarding e edição) usam o mesmo motor, então construir o motor uma vez
> resolve os dois.

> **Escopo entregue nesta sessão (2026-07-28): só schema + validação de roteiro.** O motor
> conversacional (a parte que de fato "entrevista" via LLM) é um sistema novo do tamanho de
> `pcm-ze-agent` — não uma extensão de algo existente como S23/S24/S25 foram. Implementar isso sem
> revisão de arquitetura é o tipo de decisão irreversível que o próprio `CLAUDE.md` pede pra parar
> e sinalizar antes de codar. ADR-0016 e as questões em aberto do `design.md` **continuam sem
> resposta** — não decidi sozinho.

## Plano
| #  | Task                                                                    | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|-------------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 0  | ADR-0016 (fronteira Atendimento→cadastro PCM via entrevista)            | —        | —          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 1  | Migration: `atendimento.roteiro_entrevista` + `entrevista_sessao` + RLS FORCE | AC-1,AC-2 | —     | `lint:migrations`/squawk verde                | done   |
| 1b | Domínio: `validarRoteiro` (nome + perguntas obrigatórios)                | AC-1     | 1          | `pnpm test` (4 testes novos)                   | done   |
| 2  | Config de roteiro — UI admin                                             | AC-1     | 1b         | `tsc --noEmit` + `vitest src/app` (95/95, inclui as travas de navegação) | done (2026-11-25) |
| 3  | Motor de entrevista conversacional (edge function nova, tipo `pcm-ze-agent`) | AC-2 | 0,2     | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 4  | Montador de proposta (contato/CNPJ/árvore até 3 níveis)                 | AC-3     | 3          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 5  | Tela de confirmação — nada grava sem confirmar                          | AC-4     | 4          | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 6  | Gravação transacional em cliente + estrutura + auditoria                 | AC-5     | 4,5        | **não feito — ver SPEC_DEVIATION**            | bloqueado |
| 7  | Cadastro manual preservado                                               | AC-6     | —          | já é verdade — nenhuma mudança tocou o cadastro manual | done (por não ter mexido) |
| 8  | Sanitização/defesa a prompt injection                                    | AC-4     | 3          | **não feito — ver SPEC_DEVIATION**            | bloqueado |

## Plano de teste
- Unidade: `validarRoteiro` (4 casos) — `apps/web/src/features/pcm/domain/roteiro-entrevista.test.ts`.
- Todo o resto: sem gate executável ainda, ver SPEC_DEVIATION.

## Divergências (SPEC_DEVIATION)

### Estado em 2026-11-25
Nesta rodada foi entregue **somente o AC-1** (task 2): a tela
`apps/web/src/features/pcm/pages/RoteirosEntrevistaPage.tsx`, alcançável por
**Administração → Catálogos → Roteiros de Entrevista**, atrás da flag
`VITE_SSO_ROTEIRO_ENTREVISTA_ENABLED`. Antes disso o roteiro era uma tabela (migration 0160) que
nenhuma tela alcançava — configurável no papel e inexistente na prática.

**As tasks 0, 3–6 e 8 continuam bloqueadas, e o inventário desta rodada explica por quê com
evidência** (antes era "parece grande demais"; agora é um fato verificado):

- **Hoje o cadastro manual de cliente e de locais é `insert` direto do browser, sem transação e
  sem auditoria.** Cliente: `apps/web/src/features/pcm/infrastructure/supabase-cliente-360-adapter.ts`
  (`.from("clientes").insert(...)`, sem RPC). Estrutura: `supabase-hierarquia-adapter.ts`
  (`.from("areas").insert`, `.from("locais").insert`), **uma requisição HTTP por nó**. Não há
  trigger genérico de auditoria: `audit.events` só recebe `insert` explícito de dentro de RPCs
  `security definer`.
- **Logo, o AC-5 ("transacional, tudo ou nada, auditado em `audit.*`") NÃO pode ser atendido
  reusando o caminho manual.** Exige uma RPC `security definer` nova, no molde de
  `pcm.sso_incorporar_localizacao_levantamento` (migration 0352) e
  `pcm.sso_receber_levantamento_manual` (0315/1014/1448): idempotência por `request_id`, advisory
  lock, checagem de duplicidade, `insert into audit.events` e grant só depois dos gates. Isso é
  exatamente a decisão que a **ADR-0016 está Proposta** para tomar — e ela segue **não aceita**.
- **O que NÃO bloqueia** (bom saber para a próxima sessão): não existe trava do Auvo contra criar
  cliente localmente. `pcm.clientes.auvo_id` é nullable e o único trigger é o de outbox
  (`trg_clientes_auvo_enqueue`, migration 0030), que empurra depois — não é pré-requisito.
- **Não existe validação de CNPJ em lugar nenhum** do repo (nem SQL, nem front: `validarClienteForm`
  só faz `trim`, e o campo é rotulado "CNPJ/CPF"). O AC-3/"CNPJ inválido" do caso de borda precisa
  de código novo de dígito verificador, não de reuso.
- **Do TriviAtende, o que vale portar quando a ADR-0016 for aceita** (já mapeado, para não
  reinvestigar): de `conduzir-treinamento`, a concorrência otimista por `numeroEsperado` — a
  rodada é recusada com `rodada_desatualizada` ANTES de gastar chamada de modelo, e **rodada que
  falha não é registrada**, então o texto de quem respondeu não se perde; de `implantar-agente`, o
  roteiro de ações (`abrir`/`adicionar_*`/`propostas`/`decidir`/`aplicar`) e o `proximo_rotulo`
  (rótulo de material nunca reusado, para uma proposta não citar outro texto); de `treinar-agente`,
  `estimar` + `confirmarCusto` antes de iniciar. Nada disso foi portado nesta rodada.

### Original (2026-07-28)
- [x] **Tasks 0, 2-6, 8 não implementadas.** O motor conversacional (condução da entrevista via
  LLM, normalização de resposta, montagem da árvore de estrutura, tela de confirmação, escrita
  transacional em cliente+estrutura) é uma peça de arquitetura nova — do tamanho de construir um
  segundo `pcm-ze-agent`, não uma extensão pontual. As questões em aberto do `design.md` (MVP com
  roteiro fixo ou já configurável? perfis de padrão de prédio por quem/como?) também não foram
  respondidas nesta sessão porque são decisões de produto, não técnicas. Resolução: esta story
  precisa de uma sessão própria de design (`@architect` + ADR-0016 revisado e aceito) antes de
  qualquer código do motor — o schema abaixo já está pronto pra receber essa implementação sem
  precisar de migration nova na maior parte dos casos.

## O que já existe pra próxima sessão puxar
- `atendimento.roteiro_entrevista` (perguntas configuráveis, mesmo formato `PassoFluxo` do fluxo
  comercial já usado em `pcm-ze-agent`) e `atendimento.entrevista_sessao` (estado entre turnos,
  mesmo padrão de `chamados_pendentes` da E02-S23) já existem e têm RLS.
- `apps/web/src/features/pcm/domain/roteiro-entrevista.ts` já valida o formato de roteiro — falta
  só o gateway/adapter/UI de CRUD (baixo risco, pode ser feito a qualquer momento) e,
  principalmente, o motor conversacional (alto risco, precisa de design revisado antes).

## Checklist de Definition of Done
- [x] Schema criado e revisado (migration + RLS)
- [x] Validação de roteiro implementada e testada
- [ ] ADR-0016 registrado e aceito
- [ ] Motor conversacional implementado
- [ ] `docs/STATE.md` atualizado
