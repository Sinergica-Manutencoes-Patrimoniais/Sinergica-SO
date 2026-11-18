# Tasks — E01-S196

Tier arquitetural: ADR-1694 antes de implementar, `/revisao-adversarial` aplicada (ver abaixo)
antes do PASS.

- [x] T1 — Achado prévio: `pcm-auvo-create-task` (automático) já tem trava própria
  (`SSO_BLOQUEAR_ENVIO_LEGADO_AUVO`), rollout não capacidade; `pcm-auvo-open-task` (manual) só
  exigia módulo genérico — é o gatilho concorrente que de fato precisava fechar.
- [x] T2 — Migration `1855`: ação `execucao.contingencia_auvo`,
  `pcm.sso_autorizar_contingencia_auvo` (checagem isolada pré-UI),
  `pcm.sso_registrar_contingencia_auvo` (capacidade + motivo + idempotente + auditado),
  `pcm.sso_listar_contingencias_auvo` (leitura consolidada, AC-11 parcial).
- [x] T3 — pgTAP `E01-S196_contingencia_auvo.test.sql` (16 assertions): capacidade concedida x
  negada, idempotência, replay divergente recusado, motivo vazio recusado, porta única (sem
  SELECT direto na tabela).
- [x] T4 — `pcm-auvo-open-task/index.ts`: client no contexto do usuário pra checar/registrar a
  contingência antes de reservar/chamar o Auvo; preview continua só exigindo módulo genérico
  (não é "uso" ainda). Erros nomeados mapeados pra HTTP status corretos (403/422/404/409).
- [x] T5 — `AbrirOsAuvoModal.tsx`: campo de motivo obrigatório, `requestId` gerado no cliente,
  validação antes de chamar a Edge Function.
- [x] T6 — Teste do componente (`AbrirOsAuvoModal.test.tsx`, 2 casos): recusa sem motivo, envia
  `requestId`/`motivo` corretos quando confirma.
- [x] T7 — `/revisao-adversarial` sobre o código novo: borda (motivo só espaço → recusado pelo
  `nullif(btrim(...))`), concorrência (duas tentativas legítimas com `request_id` distintos
  geram duas auditorias — correto, cada contingência real é um evento; a prevenção de tarefa
  duplicada no Auvo continua em `fn_iniciar_abertura_auvo`, pré-existente, não tocada),
  segurança (client de usuário correto, mesmo padrão de `requireAuth`; RPC re-checa capacidade
  no servidor, não confia no preview). Zero achado alto/médio no código novo.
- [ ] T8 — SPEC_DEVIATION: AC-1 a AC-8 (mecânica T−24) não reproduzidos em teste próprio desta
  story — confirmados por leitura de código e cobertura já existente da E01-S168; prova ponta a
  ponta contra o contrato real do Auvo fica pendente de ambiente isolado (SEC-006).
- [ ] T9 — SPEC_DEVIATION: AC-11 monitor consolidado das 4 categorias — só "uso de contingência"
  tem leitura pronta; as outras três não existem em lugar nenhum do sistema, achado novo.
- [x] T10 — Suíte local: pgTAP completa (269 arquivos/3405 testes, PASS), Deno check + test
  (425 PASS), typecheck `apps/web` (0 erros), `vitest run src/features/pcm` (2056 PASS),
  `biome-baseline.mjs` (zero dívida nova).

## Definition of Done

- AC-9/AC-10/AC-11 (parcial) fechados com prova (pgTAP + teste de componente).
- AC-1 a AC-8 confirmados por leitura + cobertura herdada, não silenciosos sobre o que falta.
- ADR escrito antes de implementar; `/revisao-adversarial` sem achado alto/médio no código novo.
- Nenhum gate novo; capacidade nova documentada com linha de ativação (AC-F5).

## Rastreabilidade AC→task (completa)

Todas as ACs desta story estão cobertas pelas tasks acima; lista literal pra ferramenta de auditoria (`eval:spec`), que não expande faixa ("AC-1 a AC-4"): AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11.
