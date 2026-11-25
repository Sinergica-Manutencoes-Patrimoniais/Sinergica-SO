# Tarefas — E01-S185

**RODADA DE 2026-11-25 (pgTAP + destrave) — o que fechou, o que não fechou.**

Fechado nesta rodada:
- **pgTAP de AC-1/AC-2** — `supabase/tests/E01-S185_outbox_projecoes.test.sql` (28 assertions): conferência da outbox (0384), nota append-only com concorrência otimista contra o estado real da fila (40001 `origem_alterada`), idempotência por `request_id` (replay devolve o mesmo resultado; payload diferente → 23505), isolamento por Cliente na listagem e na anotação, e as projeções de Comercial/Financeiro (0391 via a mediação 1562) classificando `vinculo_observado` × `despesa_alterada_conferir` a partir das tabelas reais.
- **pgTAP de AC-3/AC-4** — `supabase/tests/E01-S185_recuperacao_fila.test.sql` (23 assertions): solicitação de recuperação (1453/1454/1457) prova que registra intenção e **não** executa retry (`retryExecutado:false`, `efeitoRemotoComprovado:false`, fila do Auvo intacta), época/revisão obsoletas recusadas (40001), recibo sem repetir o comando, append-only (23514 `conferencia_imutavel`), e o inbox de OS em situação incerta (0710) com gate fechado → 55000 e isolamento → 42501.
- **pgTAP de AC-6** — `supabase/tests/E01-S185_varredura_executor.test.sql` (24 assertions): varredura local paginada (1205/1207) com revisão esperada, idempotência por `request_id`, evento de origem `varredura` sem ator humano, linha de fila sem Cliente comprovável que **não** vira ocorrência, fila do Auvo nunca alterada, e a configuração do executor (1416) devolvendo `cronCriado:false`.
- **Teste de AC-5 ajustado** — `E01-S185_conflito_webhook_chamado.test.sql` passou a fechar explicitamente as travas que a migration 1875 abre; sem isso, os `throws_ok` de 55000 viravam falso verde.
- **BUG REAL DE PRODUÇÃO, achado pelo pgTAP novo e corrigido** — `supabase/migrations/1874_E01-S185_corrige_ambiguidade_listagem_outbox.sql`. `pcm.sso_listar_outbox_reconciliacao` e `pcm.sso_listar_outbox_reconciliacao_filtrada` declaram coluna de saída `id` e checavam o gate com `where id`: em plpgsql isso é `42702 column reference "id" is ambiguous`, levantado na PRIMEIRA linha executável. As duas funções eram **inalcançáveis em qualquer chamada** — a tela de conferência da fila nunca teria listado nada, mesmo com gate aberto, permissão e grant (1839). O mesmo defeito já tinha sido corrigido em `sso_listar_os_reconciliacao` pela migration 1030, com a mesma solução (alias `g` no gate); estas duas ficaram para trás porque nenhum teste as executava.
- **Destrave** — `supabase/migrations/1875_E01-S185_destrava_reconciliacao.sql` abre 23 das 26 travas da story (bloco `do` único, idempotente, no padrão da 1872 de E00-S29), autorização do Lucas de 25/11/2026, com `supabase/tests/E01-S185_destrava_reconciliacao.test.sql` (28 assertions) provando as 23 abertas, as 3 de varredura fechadas e RLS enable+force nas 26.
- **Suíte pgTAP inteira verde depois do destrave** — `npx supabase@2.114.0 test db supabase/tests/*.test.sql`: 292 arquivos, 3836 testes, PASS. Abrir as travas não quebrou nenhum teste de outra story.
- **Flags** — as 40 flags `VITE_SSO_*` usadas por `interfaces/reconciliacao/` e nunca declaradas entraram em `netlify.toml` (ligadas para a homologação) e `.env.example` (desligadas no desenvolvimento).

**Não fechou, de propósito:** `pcm.sso_varredura_fila_gate`, `pcm.sso_varredura_os_gate` e `pcm.sso_varredura_origens_gate` continuam FECHADAS. Elas guardam escrita automática (ocorrências, demoras e quarentenas sem ator humano) e nenhuma tela as alcança — as RPCs só têm grant para `service_role`. Correção de fato ao registro anterior: as edge functions `integracoes-verificar`, `integracoes-verificar-os`, `integracoes-agendar-fila`, `integracoes-agendar-os` e `integracoes-agendar-origens` **existem** no repositório (o registro de 2026-11-11 dizia que a varredura não tinha edge function); o que não existe é `cron.schedule` para nenhuma delas, então o ADR-1264 ("gate fechado e nenhum cron criado") continua válido na prática.

**Ainda sem pgTAP:** a maior parte das 82 migrations — triagem de funcionários (0663-0671), avaliação/evidência de OS (0651-0684), varredura de OS e de origens internas (1236-1254), quarentena e confirmação de retorno (1300-1302, 1605), observação de novo Cliente (1273-1275) e demora de fila (1295-1299). Os três arquivos acima cobrem o esqueleto de cada AC, não cada migration.

**CORREÇÃO GRAVE (2026-11-11):** a auditoria anterior (madrugada de 2026-11-10, abaixo riscada) estava **errada** — usou `grep -rln "E01-S185" supabase/migrations/*.sql`, que busca a string dentro do CONTEÚDO do arquivo, não no nome do arquivo. A maioria das migrations deste programa não repete o ID da story no corpo do SQL (só no nome do arquivo), então essa busca deu zero falsamente. `ls supabase/migrations/ | grep -i S185` mostra a realidade: **82 migrations reais** (`0384` a `1605`, fora as que citam S185 compartilhado com outras stories como `1211`/`1238`). Este é o mesmo tipo de falha de verificação que motivou "nunca confiar em claim não re-verificado" neste programa — eu mesmo não re-conferi essa claim específica antes de começar a construir em cima dela, e quase cheguei a commitar uma migration nova (`1833`, **apagada antes de aplicar/commitar**, nunca tocou o banco) duplicando um sistema que já existe.

**Realidade confirmada por leitura real (2026-11-11):** S185 está **essencialmente pronta**, como as outras 14 stories auditadas na madrugada anterior — só com tasks.md igualmente desatualizado e arquitetura real bem diferente do plano original (evoluiu pra algo mais conservador, sem reinventar fila). Núcleo real:
- **AC-1/AC-2** (identificar objeto/causa/impacto, estados fiéis): `pcm.reconciliacao_outbox_gate`/`reconciliacao_outbox_notas` (migration 0384) — `sso_listar_outbox_reconciliacao` projeta `pcm.auvo_sync_outbox` (isolamento por Cliente via join em `sistemas`/`equipamentos`, nunca lendo a outbox direto — AC-7 de E01-S22 preservado) mapeando status pra vocabulário de reconciliação (pendente/incerto/enviado_não_confirmado); `sso_anotar_outbox_reconciliacao` registra observação do operador com concorrência otimista contra o estado real da outbox (`origem_alterada`, 40001); `sso_listar_notas_outbox` lê o histórico (append-only, trigger `nota_imutavel`). `sso_listar_reconciliacao_comercial`/`sso_listar_reconciliacao_financeiro` (0391) fazem o mesmo pra Comercial/Financeiro, **sem tabela de "ocorrência" separada** — o estado é derivado AO VIVO via join contra as tabelas reais (`comercial.propostas`/`financeiro.itens_faturaveis`), não uma cópia que pode divergir.
- **AC-3/AC-4** (recuperar sem repetir efeito, incerteza/múltiplos candidatos): `1453`/`1454`/`1457` (`sso_solicitar_recuperacao_fila` e afins — não lidos linha a linha ainda), `1202-1254` (observação/varredura/demora/quarentena de fila e OS).
- **AC-5** (conflito/precedência): `1030-1035` (`sso_resolver_conflito_webhook`/listagem/mediação de conflito de webhook de Chamado) — UI `ConflitosWebhook.tsx`/`ResolverConflitoWebhook.tsx`, com teste colocado (2+5 testes, passando).
- **AC-6** (varredura periódica, lease/tentativa presa): `1205-1254` (varredura de fila/OS/origens internas + executor periódico), `1416` (config do executor, admin liga/desliga sem cron real ainda — "ADR-1264: gate fechado e nenhum cron criado").
- **UI real**: `apps/web/src/features/pcm/interfaces/reconciliacao/` — **51 componentes**, incluindo `Workspace.tsx` (orquestrador real, wired de verdade em `EstruturaClientePage.tsx`, confirmado não ser código morto), `SolicitarRecuperacaoFila.tsx`/`HistoricoSolicitacoesRecuperacao.tsx` (AC-3), `InboxOsIncerta.tsx`/`RevalidarIncertezaOs.tsx` (AC-4), `ConflitosWebhook.tsx`/`ResolverConflitoWebhook.tsx` (AC-5), `DemorasObservadas.tsx`/`ProcessamentosDemorados.tsx` (AC-6), `CustosProposta.tsx`/`ItensHistoricosCusto.tsx` (Comercial/Financeiro). Vitest rodado de dentro de `apps/web/`: **4 arquivos, 12 testes, todos passando** — só 4 dos 51 componentes têm teste colocado.
- **GAP-REAL-CONFIRMADO, maior de todo o programa**: `grep -rl "reconciliacao_outbox_gate\|sso_listar_outbox_reconciliacao\|sso_solicitar_recuperacao\|sso_resolver_conflito_webhook\|sso_executor_varredura_fila" supabase/tests/*.sql` → **zero resultados**. 82 migrations, **nenhum pgTAP** — maior superfície sem prova server-side de todas as stories auditadas até agora (ultrapassa até S182, que tinha 111 migrations/3 testes). Candidata prioritária a receber pgTAP real.
  - **Parcialmente fechado em 2026-11-11**: `E01-S185_conflito_webhook_chamado.test.sql` (AC-5, 17 assertions, PASS local e suite completa) prova o fluxo real de conflito webhook×Chamado encerrado (1030/1032/1034/1035): captura mínima/privada, idempotência por chave natural, mediação (`sso_listar_conflitos_webhook_autorizado`, não o núcleo 1032 que é privado por desenho), resolução com confirmação remota explícita + concorrência otimista, append-only. **Ainda sem pgTAP**: AC-1/AC-2 (outbox/Comercial/Financeiro, 0384/0391), AC-3/AC-4 (solicitar recuperação, 1453-1457), AC-6 (varredura/executor periódico, 1205-1254/1416) — candidatos pra próxima rodada.

**SPEC_DEVIATION sobre T015 continua válida, mas revisada:** a varredura periódica REAL já existe nesta story (`1205-1254`/`1416`), só com nomes diferentes do plano (`sso_executor_varredura_fila`, não uma edge function `integracoes-verificar/index.ts`) — e ainda sem cron real ligado (gate fechado, "nenhum cron criado" por decisão explícita do ADR-1264). A colisão de nome com a edge function `integracoes-verificar` de E01-S165 (varredura do Plano de Manutenção) continua real SE alguém um dia decidir criar essa edge function — mas dado que a varredura de S185 já roda via `sso_executor_varredura_fila`/RPC, não via edge function dedicada, a colisão pode nunca se materializar. Não é mais bloqueio ativo, só nota de atenção se T015 for revisitada literalmente como planejada.

Dependências: E01-S168, E01-S175, E01-S181, E01-S182 — por auditoria anterior (2026-11-10), as 4 já têm código real substancial, mas S168 e S175 têm gaps reais confirmados (T-24 sem produtor real; pgTAP agora parcialmente fechado) que também merecem atenção numa integração de verdade. Testes antes da implementação de cada regra. Sem rede real por padrão.

<details>
<summary>Auditoria anterior (2026-11-10, madrugada) — mantida só como registro do erro, não usar como referência</summary>

~~**Auditoria de código em 2026-11-10 (madrugada):** confirmado por leitura real (fork somente-leitura) — esta é a **única story do programa (S165-S186) genuinamente 0% implementada**. `grep -rln "E01-S185" supabase/migrations/*.sql` → zero resultados; nenhuma tabela "ocorrência de reconciliação" existe; `application/reconciliacao.ts` não existe; `pages/ReconciliacaoIntegracoesPage.tsx` não existe.~~ **Errado — ver correção acima.**

</details>

## Preparação e fundação

- [ ] T001 Conferir fontes, ADR-0026/0027/0028 e contrato compartilhado; registrar matriz de capacidade e reuso em `specs/E01-S185-reconciliacao-integracoes/research.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Criar testes pgTAP de unicidade, requestId, RLS FORCE e permissão permitida/negada em `supabase/tests/E01-S185_integracao.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Implementar schema/RPCs aditivas em `supabase/migrations/`, com requestId único, expectedRevision, histórico e policies conforme `specs/E01-S185-reconciliacao-integracoes/data-model.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## US1 — Identificar objeto, causa e impacto

- [ ] T004 [US1] Escrever testes de consulta consolidada e isolamento de dados/custos em `apps/web/src/features/pcm/application/reconciliacao.test.ts` (AC-1).
- [ ] T005 [US1] Implementar consulta consolidada e isolamento de dados/custos em `apps/web/src/features/pcm/application/reconciliacao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-1).
- [ ] T006 [US1] Escrever testes de estados fiéis, histórico e minimização em `supabase/functions/_shared/integracoes/projecao.test.ts` (AC-2).
- [ ] T007 [US1] Implementar estados fiéis, histórico e minimização em `supabase/functions/_shared/integracoes/projecao.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-2).

## US2 — Recuperar sem repetir efeitos

- [ ] T008 [US2] Escrever testes de retry delegado, concorrência e permissão em `supabase/functions/integracoes-reconciliar/index.test.ts` (AC-3).
- [ ] T009 [US2] Implementar retry delegado, concorrência e permissão em `supabase/functions/integracoes-reconciliar/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-3).
- [ ] T010 [US2] Escrever testes de incerteza e decisão de duplicidades em `supabase/functions/_shared/integracoes/reconciliar.test.ts` (AC-4).
- [ ] T011 [US2] Implementar incerteza e decisão de duplicidades em `supabase/functions/_shared/integracoes/reconciliar.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-4).

## US3 — Tratar conflito e prevenir regressão

- [ ] T012 [US3] Escrever testes de evento fora de ordem e precedência de decisões em `supabase/functions/_shared/integracoes/conflitos.test.ts` (AC-5).
- [ ] T013 [US3] Implementar evento fora de ordem e precedência de decisões em `supabase/functions/_shared/integracoes/conflitos.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-5).
- [ ] T014 [US3] Escrever testes de varredura, tentativa presa e fechamento rastreável em `supabase/functions/integracoes-verificar/index.test.ts` (AC-6).
- [ ] T015 [US3] Implementar varredura, tentativa presa e fechamento rastreável em `supabase/functions/integracoes-verificar/index.ts`, integrando RPC/adapters existentes conforme plan e contrato (AC-6).

## Integração e fechamento

- [ ] T016 Testar ações/estados da UI com doubles em `apps/web/src/features/pcm/application/e01-s185-integration.test.ts` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T017 Integrar consultas paginadas e ações em `apps/web/src/features/pcm/application/operacao-queries.ts` e `apps/web/src/features/pcm/pages/ReconciliacaoIntegracoesPage.tsx`, com invalidação TanStack Query, foco e carregando/vazio/erro/sucesso (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T018 Registrar resultados CT, revisão adversarial e CI/db-tests em `specs/E01-S185-reconciliacao-integracoes/quickstart.md`; manter gate operacional fechado até etapa autorizada (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependências, paralelismo e estratégia

Preparação/fundação precedem US1. US2 usa objetos de US1; US3 usa resultados anteriores e pode preparar fixtures independentemente. Não paralelizar migrations nem arquivos compartilhados. MVP demonstrável: US1 com doubles; aprovação de implementação exige todas as fases. Cada AC tem teste dedicado e implementação de regra; tarefas gerais não substituem cobertura específica.
