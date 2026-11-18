# ADR-1692 — Status `validacao_pcm` e fechamento do dead-end de `demanda` (E01-S194)

**Status:** aceita · **Data:** 2026-11-18 · **Story:** E01-S194

## Contexto

O Kanban aprovado (Pacote Consolidado SSO v1.0, BL 007) exige `Solicitações · Preventivas ·
Campo a conciliar · Demanda · Planejamento · Em execução · Validação PCM · Finalizado`. Duas
lacunas de backend bloqueavam isso:

1. `pcm.fn_operacao_alterar_status_lote` (0178) — usada pelo dropdown de status, drag do Kanban
   e ação em lote — não validava transição nem exigia capacidade alguma. Qualquer usuário com
   escrita em `pcm` finalizava qualquer OS sem passar pela decisão do PCM.
2. A própria migration da E01-S193 (`1854`) documentou que Chamado em `'demanda'` era dead-end:
   `pcm.sso_criar_os_chamado` só aceitava `'aberto'/'convertido_os'`.

## Decisão

- Novo status de OS `'validacao_pcm'`, aditivo, entre `'em_execucao'` e `'finalizado'`. A tarefa
  terminar no Auvo não finaliza mais a OS direto — vira parada obrigatória; só uma transição
  manual explícita (gated por `execucao.validar`) fecha pra `'finalizado'`.
- `fn_operacao_alterar_status_lote` ganha o gate de capacidade **só** na transição pra
  `'finalizado'` — a de maior risco e já provada (achado 1). Matriz de transição completa fica
  pra story dedicada: fechar todos os saltos sem inventariar todos os chamadores (lote,
  automação, `ConversaoIntegral.tsx`) arriscava quebrar caminho legítimo não mapeado.
- `sso_criar_os_chamado` aceita `'demanda'` como origem válida; a OS resultante nasce em
  `'planejamento'`, não `'solicitacao'` (o Chamado já passou da triagem). Esta função já tinha
  sido remendada cirurgicamente duas vezes (`1475`: concorrência/escopo; `1499`: token de guarda
  de múltiplas OS) — a correção usa o MESMO padrão de cirurgia de texto sobre
  `pg_get_functiondef`, nunca um `create or replace` com corpo reescrito do zero, pra não apagar
  os remendos anteriores. Confirmado na prática: a primeira tentativa (corpo copiado) quebrou
  `E01-S167_ensaio_multiplas_os.test.sql`.
- "Campo a conciliar" e a matriz de transição completa ficam fora desta migration — SPEC_DEVIATION
  documentado em `specs/E01-S194-kanban-operacional-aprovado/plan.md`, não um silêncio.

## Consequências

- Positiva: fecha dois achados de segurança/correção reais (capacidade ausente, dead-end
  documentado) com prova em pgTAP, sem reescrever a mecânica de validação já existente
  (0348/0375/0560).
- Negativa/aceita: o dropdown de status ainda permite outros saltos sem validação de transição
  (só `finalizado` está fechado). "Campo a conciliar" não tem coluna ainda. O caminho de UI
  "arrastar cartão sintético de Demanda" não foi verificado ponta a ponta.
- Reversível: todo o `ALTER`/`create or replace` é aditivo; reverter é possível sem perda de
  dado (nenhuma linha existente muda de status retroativamente).

## Referências

Migration `1855_E01-S194_validacao_pcm_status.sql` · `specs/E01-S194-kanban-operacional-aprovado/`
· ADR-1689 (E01-S193, introduz `'demanda'`) · `1475_E01-S167_criacoes_concorrentes.sql`,
`1499_E01-S167_guarda_escritores_multiplas_os.sql` (padrão de cirurgia de texto reusado).
