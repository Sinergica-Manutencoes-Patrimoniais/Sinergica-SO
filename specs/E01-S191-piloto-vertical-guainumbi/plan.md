---
name: plan
description: Detalhe técnico de E01-S191 — roteiro das nove etapas, sem código novo. Puxe ao implementar.
alwaysApply: false
---

# Plan — E01-S191 · Jornada vertical do piloto Guainumbi

Decisão central: o Fabrício pediu **demonstração**, não código novo ("não deve ser mais código
incorporado"). As nove etapas já existem como RPC/tabela em produção; esta story é o roteiro que
as encadeia numa execução única, com evidência, num Cliente de teste descartável.

## Mapa das nove etapas → mecanismo real (nenhum é novo)

| Etapa | AC | RPC/tabela | Migration |
|---|---|---|---|
| 1. Estrutura | AC-1 | `pcm.areas`/`locais`/`sistemas` (insert direto) | `0001` e descendentes |
| 2. Ocorrência + feriado | AC-2 | `pcm.ocorrencias_rotina_preparadas` + `pcm.feriados_declarados` | `0427` (E01-S166) |
| 3. Promover a Chamado preventivo | AC-3 | `pcm.sso_criar_chamado_ciclo_preventivo` | `1582` (E01-S167) |
| 4. Duas OS no mesmo Chamado | AC-4 | `pcm.sso_criar_os_chamado` (×2) | `1020`/`1842` (E01-S167) |
| 5. Agrupar em Visita | AC-5 | `pcm.visitas` + `pcm.visita_ordens_servico` (insert direto) | `0282` (E01-S171) |
| 6. Despacho (1 tarefa/OS) | AC-6 | `pcm.ordens_servico.auvo_task_id` — **DUPLO DE TESTE** | — |
| 7. Retorno de campo | AC-7 | `pcm.retorno_os_preparado` + `respostas_os_preparadas` | `0371` (E01-S173) |
| 8. Validação PCM | AC-8 | `pcm.sso_comando_escopo_chamado` (atender/declarar) + `pcm.sso_encerrar_chamado_conferido` | `0333`/`0611` (E01-S167) |
| 9. Evidência + gates | AC-9/10 | abertura/retorno manual dos 4 gates tocados, dentro da mesma transação | — |

## Por que "DUPLO DE TESTE" na etapa 6 (AC-6, FR-005)

Não existe credencial Auvo real neste ambiente (16.2-1 pendente, fora desta story). A etapa grava
`auvo_task_id`/`auvo_sync_status` diretamente, sem chamar a Edge Function `pcm-auvo-webhook`/o
motor de sync (`fn_auvo_enqueue`). **Isso está marcado explicitamente no teste e neste documento**
— nunca apresentado como prova contra o sistema real (FR-005/SC-004).

## Evidência da execução (AC-9)

Cada corrida do pgTAP produz, nas mensagens das próprias asserções: identificador do Cliente de
teste, do Chamado, das duas OS, da Visita, e o motivo de cada decisão. Versão = commit HEAD desta
branch; ambiente = `supabase db reset` local (mesmo mecanismo do `db-tests` do CI); executor =
`auth.uid()` do ator de teste. Nenhum passo edita o banco fora de RPC ou `insert` na tabela
própria do agregado (nunca `UPDATE` em coluna que algum RPC já protege).

## Teste

`supabase/tests/E01-S191_piloto_vertical_guainumbi.test.sql`, 35 assertions, roda as nove etapas
numa única transação (`begin`/`rollback`), isolada por Cliente de teste descartável
(`[PILOTO] Cliente Guainumbi (teste)`), sem tocar dado de Cliente real (FR-004).

Achados corrigidos durante a escrita (documentados aqui pra não se repetir):
- `pcm.planos_manutencao.estado` nasce `'rascunho'`; `sso_criar_chamado_ciclo_preventivo` exige
  `'aprovado'`/`'ativo'` — fixture precisa declarar isso explicitamente.
- A trigger `sso_guardar_os_chamado_preventivo` (1584) exige que TODA OS de um Chamado
  preventivo tenha `categoria='preventiva'` e bata com o `sistema_id`/`modo` do snapshot da
  Rotina — não aceita categoria livre como um Chamado manual aceitaria.
- `sso_encerrar_chamado_conferido` exige o sistema de escopo/parcela (`0333`/E01-S167) declarado
  e completo — não basta toda OS estar `status='finalizado'`; é preciso
  `adicionar_parcela`→`atender_parcela` (que por sua vez exige a OS já finalizada)
  →`declarar_composicao` antes de encerrar.

## Riscos / fora de escopo

- Não comprova o contrato Auvo real (depende de 16.2-1, fora desta story).
- Não é E2E de browser (Playwright) — rodar o roteiro Playwright real exigiria credenciais de
  teste (`SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`) e write contra um projeto Supabase real,
  o exato risco que `docs/SECURITY_DEBT.md` SEC-006 já registra. O pgTAP prova o mesmo contrato
  de dados sem esse risco; a demonstração assistida ao cliente (ato operacional) pode reusar este
  roteiro como script, mas a execução com o Fabrício presente é fora do escopo de código.
