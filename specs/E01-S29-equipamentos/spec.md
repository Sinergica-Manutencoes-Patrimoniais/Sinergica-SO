---
name: spec
description: Contrato (BLOQUEADO) — CRUD de Equipamentos no PCM, promovendo pcm.equipamentos_cache. Contradiz a decisão registrada em E01-S16; precisa de confirmação do PO antes de qualquer código.
alwaysApply: true
---

# Spec — Equipamentos

> **Fonte da verdade.** Status: **⛔ BLOQUEADO — não implementar sem confirmação explícita do PO**
> Endpoint: `/equipments`. Webhook `Equipment` (entity=27).

## Por que está bloqueado
Em 2026-07-04, ao implementar `E01-S16`, o Lucas decidiu explicitamente (registrado em
`specs/E01-S16-relacionamento-equipamento-auvo-pcm/spec.md` e `docs/STATE.md`, **não** formalizado
como ADR):

> "O que for sobre o Auvo precisa ficar no Auvo, isso evita dados duplicados; só fica no PCM
> aquilo que não tem no Auvo — no PCM é feito o relacionamento entre o Auvo e outras informações
> do PCM." Ou seja: `pcm.equipamentos_cache` NÃO deveria ganhar
> identificador/categoria/garantia — só o vínculo (`pcm.os_equipamentos_auvo`, `E01-S16`).

O plano da épica "PCM como front-end completo do Auvo" propõe exatamente o oposto para
Equipamentos: promover `pcm.equipamentos_cache` (hoje cache mínimo read-only, `0012`) para uma
tabela CRUD completa, com o Auvo webhook `Equipment` alimentando de volta. **Isso reverte a
decisão de `E01-S16` para esta entidade especificamente** — pode ser a decisão certa agora que o
usuário quer o PCM como front-end completo (o motivo original de "evitar duplicação" ainda é
válido, mas o objetivo mudou: antes era "não duplicar", agora é "não abrir o Auvo"), mas é uma
mudança de rumo que só o Lucas pode confirmar, não algo para um agente assumir sozinho.

## O que fazer antes de qualquer código
1. Levantar com o Lucas/Fabrício: **Equipamentos devem virar CRUD completo no PCM (revertendo
   `E01-S16`), ou o padrão de `E01-S16` continua valendo** (PCM só guarda o vínculo, consulta o
   Auvo sob demanda pra exibir identificador/categoria/garantia, sem espelhar/editar)?
2. Se a resposta for "sim, reverter": registrar uma **ADR nova** (`docs/adr/0006-...`,
   formalizando a decisão pela primeira vez, já que `E01-S16` nunca virou ADR) explicando o
   porquê da mudança de rumo, e SÓ ENTÃO escrever `product.md`/`spec.md` completos desta story
   (o rascunho abaixo assume essa resposta, mas não é definitivo).
3. Se a resposta for "não, mantém `E01-S16`": esta story fecha como "não implementada por
   decisão de produto" (mesmo tratamento dado a `E01-S17` no ROADMAP) — o Fabrício continua
   consultando identificador/categoria/garantia do equipamento só na Visão 360 (leitura sob
   demanda, já existente), nunca edita equipamento pelo PCM.

## Rascunho de AC (só ativa SE a resposta da pergunta 1 for "reverter E01-S16")
> Não implementar a partir daqui sem a ADR da etapa 2 acima.

- Promover `pcm.equipamentos_cache` → `pcm.equipamentos` (mesmo padrão de `E01-S28` para
  Funcionários): adicionar colunas (identificador, categoria, garantia — exatamente os campos que
  `E01-S16` disse para NÃO duplicar), relaxar as policies deny de `0012`.
- `POST /equipments/` tem `externalId` — idempotência real, sem mitigação extra.
- `PATCH`/`DELETE` existem; `active` existe (`deleteStrategy` padrão `'soft-patch'`, sem
  `deactivatePatch` customizado).
- Webhook `Equipment` (entity=27) — tempo real, dispatcher de `E01-S23` já cobre.
- `pcm.os_equipamentos_auvo` (`E01-S16`) continua existindo — o vínculo OS↔equipamento não muda,
  só o cache de atributos do equipamento em si passa a ser espelhado e editável.

## Rastreabilidade
- Decisão a revisar: `specs/E01-S16-relacionamento-equipamento-auvo-pcm/spec.md`,
  `docs/STATE.md` (entrada 2026-07-04)
- Tabela a promover (se aprovado): `supabase/migrations/0012_E01-S11_cache_tecnicos_equipamentos.sql`
- Design/Domínio do motor: `../E01-S22-motor-sync-auvo-write/{design.md,domain.md}`
