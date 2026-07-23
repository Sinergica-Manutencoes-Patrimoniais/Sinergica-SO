---
name: design-E01-S85-sync-ativos-localizacao-auvo
description: Design — modelagem e sync PCM↔Auvo de localização (Área+Local+Sublocal concatenado) e de Sistema como equipamento agregado no Auvo.
alwaysApply: false
---

# Design — Sync de ativos PCM↔Auvo: localização + sistema

> **Tier arquitetural.** Decisão difícil de reverter (afeta o motor de sync e a conta Auvo real de
> produção). Aprovar antes de implementar. Ver `CLAUDE.md` §tier e ADR-0005/0006 (motor de sync).

## Problema
Fabrício modela ativos em árvore: **Cliente → Área → Local → (Equipamento | Componente)** e
**Área → Sistema** (Sistema = conjunto de Componentes; ex. "Sistema Hidrante" = hidrante 1º andar,
2º andar…). O Auvo **só entende "equipamento"** e uma **localização plana** (um campo de local).
Precisamos:
1. Cadastrar no Auvo a **localização** como concatenação `Área + Local + Sublocal`
   (ex.: "Torre A · 1º andar · Sala 001"), mantendo-a **espelhada**: criar/editar/mover Área, Local
   ou Sublocal no PCM reflete no Auvo.
2. Subir o **Sistema como um equipamento agregado único** no Auvo (não popular cada componente
   individual lá — "gera confusão"), além de subir os equipamentos/componentes que fazem sentido.

## Contexto atual (AS-IS)
- Hierarquia Área/Local/Sublocal de ativos já existe no PCM (E01-S76) + Board por local (E01-S78).
- Motor de sync genérico PCM→Auvo (outbox `pcm.auvo_sync_outbox`, `pcm-auvo-push`, entity registry
  com `AuvoEntityDescriptor`) — E01-S22/S23/S36. Equipamentos promovidos a `pcm.equipamentos`
  (E01-S29, ADR-0006, PCM é origem).
- `writeEnabled` das entidades hoje é `false` (estado seguro) até verificação de campo — E01-S36.

## Decisões
### D1 — Localização Auvo = string concatenada derivada da hierarquia PCM
O Auvo recebe a localização como **texto concatenado** (`Área · Local · Sublocal`), montado por uma
função pura de domínio a partir da hierarquia do PCM. O separador e a ordem são **configuráveis**
(pedido: "isso precisa poder ser ajustado"). PCM é a fonte; Auvo é espelho.

### D2 — Reflexo de edição/movimentação
Editar o nome de uma Área/Local/Sublocal, ou **mover** um item entre locais (Board, E01-S78/S79),
**re-enfileira** no outbox a atualização de localização dos equipamentos/sistemas afetados. Ou seja,
mudar "Sala 001" → "Sala 002" propaga para todos os ativos naquele sublocal. Trigger no PCM enfileira;
`pcm-auvo-push` faz o PATCH no Auvo (JSON Patch já suportado no motor).

### D3 — Sistema como equipamento agregado no Auvo
Cada **Sistema** vira **um** equipamento no Auvo (descriptor de equipamento, `writeEnabled` só após
verificação de campo). Os **componentes** do sistema continuam existindo no PCM; a decisão de subir
cada componente como equipamento no Auvo é **opt-in** — por padrão, sobe-se o sistema agregado + os
equipamentos "de verdade" (bomba, quadro, ar-condicionado), não cada hidrante individual. O vínculo
Sistema↔Componentes vive no PCM (é dado que o Auvo não tem).

### D4 — `writeEnabled` gated por verificação de campo (herda E01-S36)
Não ligar escrita real na conta Auvo de produção sem verificar campo a campo contra a API real
(mesma trava de E01-S36). Enquanto não verificado: dry-run/documentado.

## Alternativas descartadas
- **Localização estruturada no Auvo** — Auvo não expõe hierarquia; forçar quebraria (Fabrício: "dá
  muito B.O."). Descartado.
- **Cada componente como equipamento no Auvo** — polui e confunde ("hidrante individual gera
  confusão lá"). Descartado como default (fica opt-in).

## Impacto
- Novo/estendido descriptor no entity registry (localização + sistema).
- Trigger de re-enfileiramento em mudança de hierarquia/mover.
- ADR: registrar "Sistema sobe como equipamento agregado; componente não sobe por padrão" (atualiza
  linha de ADR-0006).

## Riscos
- Escrita malformada na conta real → mitigado por `writeEnabled` gated (D4).
- Propagação em massa (renomear área com N ativos) → enfileirar em lote, drain assíncrono.
