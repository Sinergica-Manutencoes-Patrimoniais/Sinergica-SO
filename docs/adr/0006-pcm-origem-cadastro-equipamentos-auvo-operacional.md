---
name: adr-0006-pcm-origem-cadastro-equipamentos-auvo-operacional
description: Decisão para Equipamentos: PCM origina cadastro/comandos e sincroniza com Auvo; Auvo segue autoridade operacional.
alwaysApply: false
---

# ADR-0006 — PCM origina cadastro de Equipamentos; Auvo segue autoridade operacional

**Status:** Aceito
**Data:** 2026-07-07
**Decisores:** Lucas, @architect, @pm
**Relacionados:** ADR-0001, E01-S16, E01-S22, E01-S23, E01-S29

## Contexto
Em `E01-S16`, a decisão de produto foi não duplicar dados intrínsecos de equipamento no PCM:
o Auvo era dono do equipamento e o PCM guardava apenas o vínculo OS ↔ `auvo_equipment_id`.

A nova épica "PCM como front-end completo do Auvo" muda a necessidade operacional: Fabrício deve
conseguir trabalhar no PCM sem abrir o Auvo para cadastros e ajustes do dia a dia. Ao mesmo tempo,
não queremos criar duas fontes de verdade concorrentes para a realidade de campo.

`ADR-0001` já definiu esse padrão para OS: o PCM origina a decisão/comando, o Auvo executa e mantém
a realidade operacional. Equipamentos passam a seguir o mesmo desenho.

## Decisão
1. **PCM é a origem dos comandos de cadastro de Equipamentos**: criar, editar e desativar começam
   na interface PCM quando o usuário tem `pcm:escrita`.
2. O PCM envia Equipamentos ao Auvo com idempotência por `externalId = <id_do_equipamento_no_pcm>`.
3. O Auvo continua sendo a **autoridade operacional/de campo**: mantém seu `equipmentId`, aparece
   nos fluxos de task/execução, e devolve alterações por webhook `Equipment`.
4. `pcm.os_equipamentos_auvo` continua representando vínculo OS ↔ equipamento. O cadastro do
   equipamento fica em `pcm.equipamentos`; o vínculo não vira ficha técnica duplicada.
5. `pcm.equipamentos_cache` pode ser promovida/renomeada para `pcm.equipamentos` ou deprecada em
   favor de uma tabela nova compatível. A implementação deve preservar consumidores existentes
   da Visão 360/E01-S16.

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| PCM origina comandos, Auvo segue operacional | Usuário trabalha em um só lugar; mantém separação de comando vs campo; idempotência por `externalId` | Exige sync bidirecional e promoção de RLS | **Escolhida** — é o padrão já aceito para OS e atende a épica |
| Manter E01-S16 estrito (só vínculo no PCM) | Menos schema local; menor risco de divergência | Obriga usuário a abrir o Auvo para cadastro/edição; quebra objetivo da épica | Rejeitada para esta fase |
| Auvo exclusivo, PCM apenas consulta sob demanda | Evita persistência local de cadastro | Tela fica dependente de disponibilidade/latência do Auvo; menos auditável | Rejeitada — PCM precisa operar como front-end principal |
| Dual source livre (ambos editam sem regra clara) | Flexível | Conflito operacional e auditoria fraca | Rejeitada — divergência inevitável |

## Consequências
**Positivas:**
- Fabrício cadastra e mantém Equipamentos dentro do PCM.
- Retentativas de criação não duplicam Equipamentos no Auvo por causa de `externalId`.
- O vínculo OS ↔ equipamento de `E01-S16` permanece limpo e separado do cadastro.

**Negativas / trade-offs aceitos:**
- `pcm.equipamentos_cache` deixa de ser read-only; RLS precisa ser relaxada deliberadamente e
  testada.
- Pode haver divergência temporária enquanto outbox/webhook convergem.
- Consumidores antigos do cache precisam ser compatibilizados durante a promoção da tabela.
