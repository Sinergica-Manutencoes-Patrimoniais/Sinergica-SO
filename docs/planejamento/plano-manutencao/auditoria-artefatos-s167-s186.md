---
name: "docs-planejamento-plano-manutencao-auditoria-artefatos-s167-s186-md"
description: "Documento Sinérgica SO: Auditoria de artefatos das stories E01-S167–S186 (2026-11-09)"
alwaysApply: false
---

# Auditoria de artefatos — stories E01-S167 a S186

**Data:** 2026-11-09 · **Autor:** Claude · **Escopo:** as 18 stories fora do lote S165/S166/S170/S176 · **Natureza:** medição por arquivo; não é prova de implementação, de gate nem de homologação.

## Achado principal

Os `tasks.md` e as linhas do ROADMAP dessas stories dizem "implementação não iniciada" e quase todas as tarefas estão `[ ]` (4 `[X]` no total, fora o lote 1), mas o repositório já tem cerca de 1.070 migrations, pgTAP e uma pegada grande de código web nos mesmos domínios. A documentação está defasada em relação ao código. Contagem de arquivos não prova que a regra funciona, que está ligada a gate ou que passou em CI/E2E: nenhuma dessas stories teve E2E isolado, CI por story ou homologação.

## Método

1. Para cada task, extraí os caminhos de código (`apps/`, `packages/`, `supabase/`) citados em `tasks.md` e conferi se existem (com glob).
2. Contei migrations (`supabase/migrations/*E01-SNNN*`), arquivos pgTAP (`supabase/tests`) e E2E (`apps/web/e2e`) por story.
3. Para reduzir falso negativo por renomeação, contei arquivos web/Edge por palavra-chave do domínio.
**Limite:** "ausente" pode significar "renomeado" — o código foi escrito com outro nome que o planejado em `tasks.md`. A auditoria semântica por story (ler o código e cruzar com cada AC) continua pendente.

## Tabela

| Story | Entrega | Tasks [X]/total | Migrations | pgTAP | E2E | Tasks com código planejado: existe / parcial / ausente | Pegada por palavra-chave (arquivos) |
|---|---|---|---|---|---|---|---|
| E01-S167 | Chamado 1:N OS | 1/16 | 60 | 3 | 0 | 1 / 2 / 11 | chamados-os: 5+ arquivos |
| E01-S168 | Auvo T−24 e validação PCM | 0/22 | 108 | 28 | 1 | 6 / 0 / 14 | auvo/_shared: 51; orquestração T−24: 1; validação-os: 0 |
| E01-S169 | Importação/exportação de Planos | 0/16 | 38 | 8 | 0 | 4 / 4 / 6 | importação de plano/Rimini: 34 |
| E01-S171 | Visita e associação de OS | 1/16 | 59 | 6 | 0 | 9 / 2 / 3 | visita: 112 |
| E01-S172 | Agenda e capacidade | 0/16 | 49 | 22 | 0 | 8 / 2 / 4 | capacidade/agenda: 51 |
| E01-S173 | Pendências técnicas | 0/16 | 33 | 6 | 0 | 4 / 4 / 6 | pendência: 71 |
| E01-S174 | Backlog e escopo | 0/16 | 81 | 1 | 0 | 5 / 0 / 9 | backlog: 9 |
| E01-S175 | Origem Auvo e triagem | 0/18 | 40 | 0 | 0 | 5 / 1 / 10 | não medida |
| E01-S177 | Códigos públicos e aliases | 0/16 | 43 | 7 | 0 | 4 / 2 / 8 | código público/alias: 2 |
| E01-S178 | Levantamentos em staging | 0/16 | 155 | 29 | 1 | 5 / 4 / 5 | levantamento: 109 |
| E01-S179 | Central de Materiais | 1/16 | 32 | 5 | 0 | 5 / 4 / 5 | materiais: 32 |
| E01-S180 | Despesas por Visita | 0/19 | 39 | 10 | 0 | 7 / 0 / 10 | despesa: 45 |
| E01-S181 | Orçamento operacional | 0/19 | 56 | 2 | 0 | 2 / 5 / 10 | orçamento operacional: 30 |
| E01-S182 | A Faturar | 0/19 | 111 | 3 | 0 | 4 / 3 / 10 | faturáveis: 55 |
| E01-S183 | Portal operacional | 0/19 | 40 | 0 | 0 | 1 / 3 / 13 | portal-operacional: 1 (só contratos em packages/shared); área do cliente: 43 |
| E01-S184 | Proteção de custos | 1/19 | 18 | 2 | 0 | 5 / 5 / 7 | não medida |
| E01-S185 | Reconciliação | 0/18 | 80 | 0 | 0 | 5 / 1 / 10 | reconciliação: 69 |
| E01-S186 | Migração e homologação | 0/16 | 32 | 0 | 0 | 3 / 0 / 11 | não medida |

Tasks só de documentação (2 por story, ex.: revalidar dependências) não entram nas três colunas de código.

## Leitura por story

- **E01-S167 — Chamado 1:N OS:** Backend e transição 1:N preparados (60 migrations, `fontes/s167-transicao-1n.sql`); arquivos de aplicação/UI planejados em grande parte ausentes ou com outro nome; gate fechado, sem múltiplas OS ativas.
- **E01-S168 — Auvo T−24 e validação PCM:** Maior descompasso: 108 migrations e 28 pgTAP, mas `serializacao.ts`, `pcm-auvo-orquestrar`, `validacao-os.ts` e `auvo-elegibilidade.ts` planejados não existem; só `orquestracao-t24.ts` aparece. Contrato Auvo real não provado; testar com doubles.
- **E01-S169 — Importação/exportação de Planos:** Importação de plano tem 34 arquivos; exportação e UI da ADR-0888 não liberadas; parte dos caminhos planejados ausente.
- **E01-S171 — Visita e associação de OS:** Mais próxima de pronta entre as não validadas: 9 de 16 tasks com todo o código planejado presente e 112 arquivos de Visita. Falta E2E, CI e revisão.
- **E01-S172 — Agenda e capacidade:** 8 tasks com código completo, 22 pgTAP e 51 arquivos de capacidade; falta fechar lacunas e validar.
- **E01-S173 — Pendências técnicas:** 71 arquivos de Pendência, mas 6 tasks sem nenhum arquivo planejado e 4 parciais.
- **E01-S174 — Backlog e escopo:** Só 1 pgTAP para 81 migrations; Workspace, adapter e e2e de backlog planejados ausentes; gate 0903 fechado e corrida associação × retorno sem resolver.
- **E01-S175 — Origem Auvo e triagem:** 0 pgTAP e 0 E2E; inbox 0357 e triagem 0358/0418/0428 desconectadas; 10 tasks sem arquivo planejado; identidade/ordem/autenticação da fonte Auvo não comprovadas.
- **E01-S177 — Códigos públicos e aliases:** Código público: só 2 arquivos web (aliases) para 43 migrations; UI de imutabilidade/exceção administrativa incompleta.
- **E01-S178 — Levantamentos em staging:** Maior backend (155 migrations, 29 pgTAP, 1 E2E) e 109 arquivos de levantamento; pendente confirmar staging→cadastro oficial por AC.
- **E01-S179 — Central de Materiais:** 32 migrations, parser e listas parciais; 5 tasks sem arquivo planejado.
- **E01-S180 — Despesas por Visita:** Policy de upload e dispatcher experimentais (ADR-0800/0837/0996); 45 arquivos de despesa; 10 tasks sem arquivo planejado. Não ampliar permissões para contornar.
- **E01-S181 — Orçamento operacional:** 56 migrations, só 2 pgTAP; 30 arquivos de orçamento operacional; 10 tasks sem arquivo planejado.
- **E01-S182 — A Faturar:** 111 migrations, 3 pgTAP, 55 arquivos de faturáveis em `features/financeiro` (nomes diferentes do planejado: `AFaturarPage`, `faturaveis-queries` ausentes); validar por AC.
- **E01-S183 — Portal operacional:** Mais atrás no front: `PortalOperacionalPage` e adapter planejados ausentes, só contratos em `packages/shared`; 0 pgTAP. A área do cliente tem 43 arquivos (cobrança 13, orçamento 32, materiais 7), possivelmente de stories anteriores.
- **E01-S184 — Proteção de custos:** Proteção parcial desde o ROADMAP; é a primeira da ordem topológica e S181/S183 dependem dela: priorizar prova das 6 AC (JSON, consultas diretas e PDF do Portal) e fechar.
- **E01-S185 — Reconciliação:** 0 pgTAP e 0 E2E para 80 migrations; 10 tasks sem arquivo planejado; reconciliação com 69 arquivos.
- **E01-S186 — Migração e homologação:** Depende de todas as outras; 32 migrations e 0 testes; 11 tasks sem código planejado. Só conclui depois das demais.

## Próximos passos

1. Auditoria semântica por story na ordem topológica (S184, S167, S171, S168, S177, S178, S169, S172, S173, S174, S175, S179, S180, S181, S182, S183, S185, S186): ler o código existente, mapear cada AC a teste e implementação, marcar `[X]` só com comando e resultado.
2. Corrigir `tasks.md` e ROADMAP dessas stories depois dessa leitura; esta tabela não autoriza marcar nada.
3. Para cada story: E2E isolado, CI com db-tests, revisão adversarial (tier arquitetural) e só então homologação.
4. Gates e flags seguem fechados em produção até decisão do Lucas e liberação do Fabrício.
