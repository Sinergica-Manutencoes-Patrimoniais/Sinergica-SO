---
name: spec-E01-S06-analise-microbiologica-nc
description: Contrato — gestão (criar/editar) de análise microbiológica e não-conformidade PMOC.
alwaysApply: true
tier: pequeno
---

# Spec — E01-S06: Análise microbiológica e log de não-conformidades

> Arquitetura herdada de [E01-S03/design.md](../E01-S03-pmoc-schema/design.md) — schema, RLS (incl.
> policies de UPDATE) e classificação de conformidade já existiam prontos desde a migration `0023`;
> a lacuna era só a aplicação (gateway/adapter/UI) nunca ter ganhado os métodos de escrita.

## Resumo
PMOC exige análise microbiológica semestral obrigatória (Portaria MS 3.523/1998, limites ANVISA RDC
09/2003: fungos ≤750 UFC/m³, relação I/E ≤1,5, coliformes ausência) e rastreio de não-conformidades
(NC) encontradas em visita. Hoje o PCM só **lê** esses registros no detalhe do contrato — esta story
cria os fluxos de **cadastro** (análise microbiológica) e **gestão de ciclo de vida** (NC: aberto →
em-andamento → fechado), reaproveitando a classificação de conformidade já existente no domínio
(`classificarMicrobio`).

## Critérios de aceite

**AC-1 — Registrar análise microbiológica.** Given um contrato PMOC, When o usuário `pcm:escrita`
registra uma análise (data, laboratório, pontos de coleta, `fungiUfcM3`, `ieRatio`,
`coliformsResult`), Then persiste em `pmoc_microbio_analysis` com `status` calculado por
`classificarMicrobio` (não digitado à mão) e `correctiveActionNeeded = true` quando `status =
'nao_conforme'`.

**AC-2 — Análise sem resultado ainda é "pendente".** Given uma análise sem `fungiUfcM3`/`ieRatio`/
`coliformsResult` (coleta feita, laudo do laboratório ainda não chegou), When registrada, Then
`status = 'pendente'`, sem marcar ação corretiva.

**AC-3 — Não-conforme dispara aviso visível.** Given `fungiUfcM3 > 750` OU `ieRatio > 1.5` OU
`coliformsResult = 'presenca'`, When a análise é salva, Then a UI mostra um aviso destacado de
não-conformidade com ação corretiva necessária (entrega visual desta story; **envio de e-mail/push
fica fora de escopo** — depende de Edge Function, ver Fora de escopo).

**AC-4 — Registrar não-conformidade.** Given um contrato (e opcionalmente um equipamento), When o
usuário `pcm:escrita` registra uma NC (descrição, severidade, ação recomendada, responsável, prazo),
Then persiste em `pmoc_nonconformity_log` com `status = 'aberto'`.

**AC-5 — NC de severidade alta é destacada.** Given uma NC com `severity = 'alta'`, When exibida na
lista, Then aparece com destaque visual (cor/badge) distinto de `media`/`baixa` — sinalização
imediata na tela (alerta push/e-mail é Fora de escopo, mesma ressalva do AC-3).

**AC-6 — Ciclo de vida da NC.** Given uma NC `aberto`, When o usuário avança o status
(`aberto`→`em_andamento`→`fechado`), Then persiste a transição; ao marcar `fechado`, grava
`completedAt` (data de hoje se não informada). Não permite pular direto de `aberto` pra `fechado` sem
passar por `em_andamento` — **decisão de UX, não uma constraint de banco** (o schema aceita qualquer
`status`; o domínio valida a transição).

**AC-7 — Consolidado no detalhe do contrato.** Given análises e NCs de um contrato, When o detalhe é
aberto, Then a lista de microbiologia mostra status/badge e a lista de NC mostra severidade/status,
ambas já existentes no `PmocDetalhe` — sem regressão do que já funcionava (leitura).

## Casos de borda
- `fungiUfcM3` exatamente 750 (limite) → conforme (`> 750`, não `>=`, é o limite legal exato da regra
  já implementada em `classificarMicrobio`; esta story não reabre essa decisão).
- NC sem `equipmentId` (achado geral do imóvel, não de um AC específico) → `tag`/`equipmentId` nulos, aceito.

## Fora de escopo (vinculante)
- **Notificação real (push/e-mail) de NC alta e microbiológico não-conforme** — regras de negócio 3 e 4
  do `design.md` de S03 preveem alerta imediato via Edge Function/cron; isso exige deploy e não é
  verificável neste ambiente. Fica junto do bloco transversal de Edge Functions (S05 + alertas).
- Upload de PDF do laudo microbiológico (`report_url`) — campo existe no schema mas sem fluxo de
  upload nesta story (seria natural em S05, quando Storage entrar pro PMOC).
- Edição/exclusão de análise microbiológica após criada (é um resultado de laboratório — não faz
  sentido "editar"; correção é nova análise). NC também não tem exclusão (log é append-only por design).

## Rastreabilidade
- Domínio: `apps/web/src/features/pcm/domain/pmoc.ts` (estende: `validarTransicaoStatusNc`) + `pmoc.test.ts`.
- Application: `application/pmoc-gateway.ts` (`criarAnaliseMicrobio`, `criarNaoConformidade`, `atualizarStatusNc`) + `pmoc.ts` (use-cases) + `pmoc.test.ts`.
- Infra: `infrastructure/supabase-pmoc-adapter.ts`.
- UI: `pages/PmocPage.tsx` (seções Microbiologia e Não-conformidades no detalhe do contrato).
