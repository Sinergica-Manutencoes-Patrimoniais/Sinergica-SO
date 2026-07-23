---
name: spec-E01-S04-inventario-climatizacao
description: Contrato — espelho pcm.pcm_equipment do inventário PMOC de AC (design.md Decisão 2).
alwaysApply: true
tier: pequeno
---

# Spec — E01-S04: Inventário de equipamentos de climatização (espelho cross-disciplina)

> Arquitetura herdada de [E01-S03/design.md](../E01-S03-pmoc-schema/design.md) (Decisão 2) — não
> precisa de `design.md` próprio, já foi aprovada por @architect. O cadastro/wizard de equipamento AC
> já existe (`PmocPage.tsx`: form manual com `proximaTagPmoc`, 1-clique "importar do Auvo" com
> `inferirTipoEquipamentoPmoc`) — a lacuna real é o **espelho automático** nunca implementado.

## Resumo
Ao cadastrar um equipamento de AR no PMOC (`pcm.pmoc_equipment`), o sistema cria/atualiza
automaticamente um espelho em `pcm.pcm_equipment` — o inventário geral **cross-disciplina** do imóvel
(elétrica, hidráulica, climatização, SPCI, civil, SPDA…). O técnico nunca vê "PMOC" e "PCM" como
sistemas separados; o espelho é espelho de leitura, mantido por trigger (não pela aplicação).

## Critérios de aceite

**AC-1 — Schema do inventário cross-disciplina.** Given o schema `pcm`, When a migration aplica,
Then existe `pcm.pcm_equipment` (`property_id`, `pmoc_equipment_id` único, `discipline`, `type`, `tag`,
`name`, `brand`, `model`, `serial`, `location`, `install_date`, `condition`, `active`, `notes`, colunas
de auditoria) com `enable`+`force row level security`.

**AC-2 — Espelho automático na criação.** Given um equipamento PMOC criado (form manual ou import
1-clique do Auvo), When a linha é inserida em `pmoc_equipment`, Then uma linha correspondente aparece em
`pcm_equipment` com `discipline='climatizacao'`, `pmoc_equipment_id` apontando pro original, `tag`/`type`/
`brand`/`model`/`location`/`condition` copiados e `name` sintetizado (`brand + model`, ou `tag` como
fallback).

**AC-3 — Espelho acompanha edição.** Given um equipamento PMOC já espelhado, When seus campos mudam
(update em `pmoc_equipment`), Then o espelho em `pcm_equipment` reflete a mudança (upsert por
`pmoc_equipment_id`), sem duplicar linha.

**AC-4 — Sem duplicação, sem escrita manual no espelho.** Given a tabela `pcm_equipment`, When um
equipamento PMOC é criado, Then a aplicação (adapter) **nunca** insere/atualiza `pcm_equipment`
diretamente — só o trigger de banco escreve nela. Não há RLS de insert/update pra `authenticated` na
prática de escrita da aplicação (a tabela é escrita só via trigger sob a policy de `pmoc_equipment`).

**AC-5 — RLS por papel.** Given a tabela `pcm_equipment`, When lida, Then exige `pcm` in
(`leitura`,`escrita`); `superadmin` bypass. Testado por efeito (pgTAP).

## Casos de borda
- Equipamento PMOC importado do Auvo (`auvoEquipmentId` setado) → espelha normalmente; `pcm_equipment`
  não guarda `auvo_equipment_id` diretamente (o vínculo Auvo já está em `pmoc_equipment`, evita
  duplicar chave — quem precisa do Auvo id segue via `pmoc_equipment_id`).
- `brand`/`model` ambos nulos → `name` do espelho cai pro `tag` (nunca fica vazio).

## Fora de escopo
- UI própria para `pcm_equipment` — é inventário de leitura interna (infraestrutura pra consolidação
  futura cross-disciplina); sem tela dedicada nesta story.
- Espelhamento de disciplinas além de climatização (elétrica/hidráulica/SPCI/civil/SPDA) — só existe
  fonte de dado (`pmoc_equipment`) para climatização hoje; as demais entram quando a disciplina
  correspondente ganhar cadastro próprio.
- Sincronizar `pcm_equipment` com o Auvo — é tabela interna, não tem descriptor no registry.

## Rastreabilidade
- Migration: `supabase/migrations/0100_E01-S04_pcm_equipment_mirror.sql`.
- pgTAP: `supabase/tests/pcm_equipment_mirror.test.sql`.
- Nenhuma mudança de código de aplicação — wizard de cadastro já existente em `PmocPage.tsx` cobre AC-2/AC-3 do lado do usuário.
