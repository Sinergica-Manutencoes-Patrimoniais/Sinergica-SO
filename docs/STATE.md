---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Só a sessão mais recente fica aqui. Histórico completo, cronológico, em
> `docs/state-historico/` (índice: [INDEX.md](state-historico/INDEX.md)) — arquivado, não
> carregado por padrão. Regra de rotação em `.claude/skills/handoff/SKILL.md`.

## 2026-08-19 — 4 pedidos em sequência: limpeza de dado, fix Auvo, fix WhatsApp celular, dashboard Início real (Claude)

Sessão longa com Lucas pedindo coisas diferentes conforme via a tela rodando — nenhum planejado
com antecedência, cada um investigado/resolvido antes de passar pro próximo.

**1. Remoção de 4 inspeções de teste.** Confirmado com Lucas (dado real de produção, mas
resultado de teste de import de XLS — 4 registros idênticos "Relatório XLS —
Respostas_Inconformidade_03_06_2026_a_23_07_2026", `concluida`, 1 item cada, criadas 15-16/08).
Soft-delete direto via `supabase db query --linked` (CLI autenticado no projeto
`nudannsrfvjggoergvyn` — token já estava disponível, Lucas confirmou acesso). `pcm.inspecoes.
deleted_at = now()` — reversível, é a convenção do schema (não `DELETE` físico); `listarInspecoes()`
já filtra `deleted_at is null`, confirmado que a tela zera. Nenhum commit — mutação de dado, não
de código.

**2. Investigação + fix: "Saúde Auvo: 6 com erro" / 591 erros no cockpit PCM (E01-S146).** Lucas
pediu pra investigar se dava pra resolver ou se devia remover a feature — não era feature quebrada.
Achado real (via `supabase db query --linked`, leitura direta antes de qualquer mudança):
- **568/591 (96%)** = linhas do outbox (`pcm.auvo_sync_outbox`) com `row_id` de
  `pcm.clientes`/`equipamentos`/`ferramentas` já deletado (hard-delete real, anterior a esta
  sessão — as 3 tabelas têm `deleted_at`, então não veio de exclusão normal pela UI).
  `fn_claim_auvo_outbox_batch` só reivindica `status='pending'` — uma vez marcada `'error'`,
  nunca mais é reprocessada nem limpa sozinha (confirmado: `attempts=1` em 100% das 591 linhas).
  Fica pra sempre como ruído, sem significar falha de integração ativa.
- **8** = `writeEnabled=false, pulado (dry-run)` (`produto_categorias`/`serviços`/`sistemas` — E01-S47
  ainda não habilitou escrita pra essas entidades) contadas como "erro" por engano na view.
- **1** = "descriptor desconhecido" — anterior ao registro de `sistemas` no registry (já existe
  hoje, `writeEnabled:false` — ADR-0009/D2).

Motor de sync **funciona** (228 pushes reais bem-sucedidos no mesmo período) — não removida.
Migration `0210_E01-S146_limpar_saude_sync_auvo.sql`: purga as 568 órfãs (revalida contra o
estado atual da tabela, não confia só no `last_error` gravado), reabre a linha de `sistemas` como
`pending`, ajusta as views `auvo_sync_health`/`auvo_sync_error_details` pra não contar dry-run
como erro. Resultado real após aplicar: **2 entidades com erro genuíno** (equipamentos 10,
clientes 4) — investigação desses ~15 casos reais fica pra depois, não travou este fix.

**Achado colateral grave, ao tentar `supabase db push`:** o banco remoto já tinha migrations
`0205` a `0209` aplicadas (`E02-S31` gasto de IA + quota, `E02-S32` origem de envio de mensagem,
fix `E01-S142` acento em "INÍCIO VISITA", `E01-S151` backlog sem chamado) **que nunca foram
commitadas em nenhuma branch deste repositório** — aplicadas direto em produção em alguma sessão
anterior, sem deixar rastro em git. Reconstruídas nesta sessão a partir de
`supabase_migrations.schema_migrations.statements` (conteúdo fiel ao aplicado, marcado como
reconstruído no cabeçalho de cada arquivo) — sem isso, `db push` recusava aplicar qualquer coisa
nova (`supabase migration list` mostrava `local: ""` pras 5 versões). Minha migration original
teria colidido no número `0205` (já ocupado por `E02-S31`) — renomeada pra `0210`.

Branch `fix/E01-S146-limpar-saude-sync-auvo`, commit único com a migration + as 5 recuperadas.
`ci:local` (19 gates) verde. **Sem PR aberto ainda** — Lucas pediu pra terminar o resto antes.

**3. Investigação + fix: mensagem mandada direto do celular não aparecia no Atendimento (E02-S32).**
Lucas reportou por print da tela real. Causa raiz: `pcm-whatsapp-webhook/index.ts` ignorava
incondicionalmente todo evento `fromMe:true` da Evolution API — que cobre TANTO o eco do que o
próprio app manda QUANTO mensagem mandada direto do celular (mesmo número, o flag sozinho não
distingue origem). A migration `0207` (recuperada no achado do item 2) já tinha criado
`origem_envio`/`fn_registrar_mensagem_celular` com dedup por `wa_message_id` (`ON CONFLICT DO
NOTHING`) — pensado exatamente pra isso — mas **nunca foi ligada**: nem o webhook chamava a
função nova, nem `atendimento-whatsapp-envio` gravava o `wa_message_id` que a Evolution devolve
(sem isso, o dedup não tinha como funcionar — toda mensagem do próprio app ia duplicar na tela).

Fix em 3 arquivos (branch `fix/E02-S32-mensagem-celular-nao-capturada`, commit `44d2cd9`):
- `_shared/evolution.ts`: `chamarEvolution`/`enviarEvolution`/`responderEvolution` passam a
  devolver o `wa_message_id` (`key.id`) do corpo de resposta da Evolution — antes descartado.
  Extração isolada em `extrairWaMessageId` (pura, testada, nunca lança).
- `atendimento-whatsapp-envio/index.ts`: grava esse id na mensagem que o app já insere (branch
  Meta fica de fora — webhook/dedup próprios, fora de escopo).
- `pcm-whatsapp-webhook/index.ts`: `fromMe` agora chama `fn_registrar_mensagem_celular` em vez de
  ignorar — eco do app vira no-op (conflito no `wa_message_id`), celular vira linha nova, nenhum
  dos dois entra na fila do Zé (não é pergunta de cliente esperando IA).

`deno test` (195 testes, incluindo 2 novos pra `extrairWaMessageId`) + `ci:local` verdes. **Sem PR
aberto ainda.**

**4. Dashboard geral real na tela Início (E01-S147).** Retomada depois de pausada pela investigação
do item 2 — Lucas pediu explicitamente pra terminar isso antes de subir qualquer coisa pro git.
`specs/E01-S147-dashboard-geral-inicio/` (spec.md + tasks.md, tier Pequeno — reusa domínio/
aplicação já existente de PCM/Atendimento/Financeiro, sem bounded context novo). 8/8 tasks:
- Task 1: extraiu `DashboardGeral` (componente + o antigo mock `DASHBOARD_GERAL`) de
  `HomePage.tsx` pra `DashboardGeral.tsx` próprio; `MODULOS`/`ModuloTab`/`ModuloId` saíram pra
  `modulos.ts` (evita import circular entre os dois arquivos novos). Sem mudança de comportamento
  nesta task.
- Tasks 2-4: um hook TanStack Query por módulo (`resumo-inicio-queries.ts`, padrão de
  `features/comercial/application/dashboard-queries.ts`) — PCM usa `contarKpis()` (RPC leve
  `fn_kpis_ordens_servico`, não a pipeline pesada de `montarDashboardPcm`; por isso `Backlog GUT`
  saiu do card, sem fonte leve equivalente — spec ajustada durante a implementação, não depois).
  Atendimento usa `obterPainelAtendimento` + `montarPainelAtendimento` (período "hoje"). Financeiro
  usa `obterResumoCaixa`, formatado com `centavosParaReais`.
- Tasks 5-8: `DashboardGeral.tsx` reescrito — cada card real é uma `useQuery` independente (nunca
  `Promise.all`), loading/erro por card não trava os outros, módulo sem dado real pronto
  (Comercial — que na verdade JÁ tem dado real e hook `-queries.ts` pronto, mas não confirmado
  pro escopo desta leva —, Marketing, Gestão, Área do Cliente) mostra `EmptyState` honesto em vez
  de número inventado. `DashboardGeral.test.tsx` (5 testes RTL, `vi.mock` dos 3 adapters
  singleton, cobre AC-1 a AC-8).

Suite inteira 989/989, typecheck/biome verdes. Branch `feat/E01-S147-dashboard-geral-inicio`.
**Sem PR aberto ainda.**

**`docs/epics/ROADMAP.md` ganhou as linhas E01-S146 e E01-S147** (E00-S24 já estava, sessão
anterior). **Nenhuma das 4 mudanças desta sessão foi verificada visualmente em navegador** — mesma
limitação já registrada em sessões anteriores (ver bloqueios abaixo).

## Em andamento / próximo passo
3 branches prontas, commitadas localmente, **nenhum PR aberto ainda** (Lucas pediu pra terminar
tudo antes de subir): `fix/E01-S146-limpar-saude-sync-auvo`, `fix/E02-S32-mensagem-celular-nao-
capturada`, `feat/E01-S147-dashboard-geral-inicio`. Próximo passo literal: perguntar ao Lucas se
abre PR de cada uma separado ou bundla, e confirmar merge (mesmo padrão desta sessão — E00-S24 já
foi assim, PR #60, merge direto depois de CI verde).

## Bloqueios abertos
> Carregados da rotação desta sessão — confirmados como ainda abertos, não copiados às cegas.
- [ ] **`.claude/skills/revisao-adversarial/SKILL.md` nunca foi criada** — referenciada em
  `AGENTS.md`/`Definition-of-Done.md` desde 2026-07-02, conteúdo nunca materializado como skill de
  verdade. Quem destrava: Lucas, com pedido direto.
- [ ] **Rotacionar o JWT secret legado do projeto Supabase** — exposto sem querer num diagnóstico
  de sessão em 2026-07-02. Não catastrófico, mas é boa prática. Quem destrava: @devops/Lucas.
- [ ] **Lote visual E00-S14..S23 (S20 AC-4/5/6, S21, S23) sem navegador pra validar visualmente**
  — decisão de pular mantida por 2 sessões seguidas. Quem destrava: sessão com Playwright/
  `claude-in-chrome` disponível, ou revisão humana do Lucas.
- [ ] **`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD` ausentes em `.env.local` da raiz** —
  bloqueou verificação visual real em pelo menos 3 sessões seguidas agora (E00-S24, e as 4
  mudanças desta sessão). `e2e/auth.setup.ts` falha rápido sem eles. Quem destrava: Lucas, com as
  credenciais reais de teste — ou aceitar que verificação visual continua sendo feita só por ele,
  manualmente, depois do merge.
