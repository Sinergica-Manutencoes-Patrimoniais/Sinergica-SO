---
name: spec-E01-S03-pmoc-schema
description: Contrato (retroativo) — sub-módulo PMOC fundação: schema, contratos, cronograma automático e inventário AC.
alwaysApply: true
tier: arquitetural
---

# Spec — E01-S03: Sub-módulo PMOC (schema, contratos e cronograma)

> **Spec retroativa.** A implementação (S03b, PR #28) entrou com `design.md` mas **sem** `spec.md`/
> `tasks.md` — gap de processo sinalizado no ROADMAP. Esta spec documenta o contrato **do que foi
> construído**, registra o desvio do `design.md` e delimita o que ficou deferido para E01-S04/S05/S06.
> Fonte de negócio: `docs/blueprint/01-pcm-operacao.md` (Sub-módulo PMOC). Arquitetura: [design.md](design.md).

## Resumo
PMOC (Plano de Manutenção, Operação e Controle) — documento **legal obrigatório** (Portaria MS
3.523/1998) para AR condicionado em edificações coletivas. Esta fundação cria o schema `pcm.pmoc_*`,
o cadastro de Contrato PMOC (imóvel + ART + inventário de AC) e a geração automática do Cronograma de
12 visitas anuais, mais a leitura consolidada (agenda, microbiologia, NCs) e as métricas de gestão.

## Critérios de aceite

**AC-1 — Schema PMOC.** Given o schema `pcm`, When a migration `0023` aplica, Then existem as tabelas
`pmoc_properties`, `pmoc_equipment`, `pmoc_contracts`, `pmoc_schedules`, `pmoc_records`,
`pmoc_microbio_analysis`, `pmoc_nonconformity_log` — todas com `enable`+`force row level security`,
colunas de auditoria e soft-delete onde aplicável (Decisão 1: prefixo `pmoc_` no schema `pcm`).

**AC-2 — Criar Contrato PMOC.** Given um cliente e usuário `pcm:escrita`, When cria um Contrato
(imóvel: nome/tipo/endereço/contato; técnico/CREA/ART; vigência `start_date`/`end_date`; lista de
equipamentos de AR), Then persiste `pmoc_properties` + `pmoc_contracts` + `pmoc_equipment` vinculados.

**AC-3 — Cronograma automático de 12 visitas.** Given um Contrato recém-criado, When persiste, Then são
geradas 12 linhas em `pmoc_schedules` (uma por mês a partir de `start_date`), com `maintenance_type`
por mês — **12→anual, 6→semestral, 3 e 9→trimestral, demais→mensal** — e `scheduled_date =
start_date + N meses` (ajustada ao último dia se o mês for mais curto). Tipos são acumulativos
(o cronograma registra o tipo mais alto por visita).

**AC-4 — Lista de contratos com métricas.** Given contratos existentes, When lista, Then cada um traz
`totalEquipamentos`, `visitasMes`, `visitasAtrasadas`, `proximaVisita`, `microbioPendentes` e
`ncsAbertas` calculados (insumo do dashboard de gestão).

**AC-5 — Detalhe consolidado do contrato.** Given um contrato, When abre o detalhe, Then vê
equipamentos, agenda (cronograma), análises microbiológicas, não-conformidades e as sugestões de
equipamento importáveis do Auvo — **leitura** consolidada num `PmocDetalhe`.

**AC-6 — Inventário de AC.** Given um imóvel PMOC, When cadastra um equipamento de AR (`tag` único por
imóvel, tipo, BTU, fluido, fase, condição…) ou importa uma sugestão do Auvo (`auvoEquipmentId`), Then
persiste em `pmoc_equipment` vinculado ao imóvel.

**AC-7 — Checklists versionados.** Given os checklists PMOC por tipo de visita (mensal/trimestral/
semestral/anual), When usados, Then vêm de **constantes TypeScript versionadas** (`domain/pmoc.ts`
`CHECKLIST_PMOC`), não do banco (Decisão 4) — o banco guarda só resultados em `pmoc_records.checklist`.

**AC-8 — RLS por papel.** Given as tabelas `pmoc_*`, When acessadas, Then SELECT exige `pcm` in
(`leitura`,`escrita`); escrita exige `pcm='escrita'`; `superadmin` bypass. Testado por efeito.

## Divergência do design (SPEC_DEVIATION — registrada em tasks.md)
- **Cronograma gerado client-side, não por Edge Function.** O `design.md` (Decisão 3) previa a Edge
  Function `pmoc-generate-schedule`. A implementação gera o cronograma no **domínio** (`gerarCronogramaPmoc`,
  função pura) e insere via **adapter** dentro do `criarContrato`. Motivo: a lógica é cálculo de datas
  puro, sem I/O — não justifica função server; fica transacional com o insert do contrato. Trade-off
  aceito: a geração roda na sessão do usuário (com `pcm:escrita`), não num worker isolado.

## Fora de escopo / deferido (não é regressão — herança para stories seguintes)
- **`pcm.pcm_equipment`** (espelho cross-disciplina, Decisão 2) — **não criado**. Deferido para **E01-S04**.
- **Edge Functions** de cronograma→Auvo-OS, `daily-status` (atrasado), alerta ART D-30, alerta microbio,
  webhook→laudo e geração de **PDF** do laudo — **não existem**. Deferidas para **E01-S05** (laudo/PDF) e
  bloco transversal de cron/alertas.
- **Gestão (create/update)** de análise microbiológica e de NC — hoje só **leitura** no detalhe. Deferida para **E01-S06**.
- **Hub de OS** (relação `os_hub`↔`pcm.ordens_servico`) — decisão adiada (Decisão 5). Deferida para **E01-S07**.

## Rastreabilidade
- Migration: `supabase/migrations/0023_E01-S03_pmoc_core.sql`.
- Domínio: `apps/web/src/features/pcm/domain/pmoc.ts` (`gerarCronogramaPmoc`, `tipoManutencaoPorMes`, `CHECKLIST_PMOC`) + `pmoc.test.ts`.
- Application: `application/pmoc-gateway.ts` (porta `PmocGateway`) + `pmoc.ts` (use-cases) + `pmoc.test.ts`.
- Infra: `infrastructure/supabase-pmoc-adapter.ts`.
- UI: `pages/PmocPage.tsx`.
