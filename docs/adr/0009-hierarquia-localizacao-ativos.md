---
name: adr-0009-hierarquia-localizacao-ativos
description: Decisão para hierarquia de ativos — estender pcm.equipamentos (não criar tabela nova) e empurrar Sistema ao Auvo como Equipment.
alwaysApply: false
---

# ADR-0009 — Hierarquia de localização de ativos: estender Equipamentos e Sistema como Equipment Auvo

> **ADRs são imutáveis.** Não edite; se mudar de ideia, crie um novo que o substitua.

**Status:** Aceito
**Data:** 2026-07-17
**Decisores:** Lucas (PO), @architect, @pm
**Relacionados:** ADR-0005 (outbox sync Auvo), ADR-0006 (PCM origina equipamentos), E01-S29, E01-S76

## Contexto
No PCM os ativos (`pcm.equipamentos`, ~2000+ linhas de produção sincronizadas do Auvo) são planos: cada
equipamento liga-se só a um cliente e a única informação espacial é `localizacao text` (texto livre). Uma
empresa de manutenção predial precisa organizar ativos por onde estão instalados
(`Cliente > Área > Local > Item`) e agrupar ativos que formam um sistema funcional
("Sistema de Hidrante Torre A"). O PO decidiu ainda que Sistemas devem receber um código do Auvo para o
técnico referenciar o conjunto no campo.

Duas decisões difíceis de reverter surgem: (a) **onde** guardar os itens (estender a tabela existente ou
criar uma nova); (b) **como** o Sistema chega ao Auvo (Product `/products` ou Equipment `/equipments`).

## Decisão
1. **Estender `pcm.equipamentos` in-place** com `local_id`, `tipo` (`equipamento`|`componente`) e
   `parent_item_id` — NÃO criar `pcm.itens`. A tabela já tem o pipeline de sync Auvo (descriptor
   `pcmTable:'equipamentos'`, trigger de outbox) e dados de produção; colunas aditivas nullable/default são
   seguras (FK `NOT VALID`→`VALIDATE`). O conceito passa a se chamar "Item" na UI/domínio; o nome físico da
   tabela permanece para preservar o pipeline e os consumidores existentes (Visão 360, E01-S16).
2. **Sistema vai ao Auvo como Equipment (`/equipments`), push-only e `writeEnabled:false`** até teste de
   contrato real. Motivo: um Sistema é um ativo associado ao cliente que deve aparecer no seletor de
   equipamento da tarefa no campo; o "código" é o `identifier`/id do equipamento Auvo. O descriptor
   `sistemas` reusa o motor genérico `pcm-auvo-push`, sem `webhookEntity` nem `cronSchedule` (PCM é dono do
   Sistema; evita colisão com o inbound Equipment(27)).
3. **Local é árvore** (`parent_id` self-ref) com `area_id` denormalizado e trigger de validação
   (`fn_locais_valida_hierarquia`: sem ciclo, subárvore numa Área só). **Área é sempre presente**;
   `item.local_id` é nullable (backfill gradual, sem auto-parse do texto legado).

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| Estender `pcm.equipamentos` + Sistema como Equipment (escolhida) | Preserva pipeline Auvo e 2000+ linhas; Sistema associa ao cliente e aparece na tarefa | Tabela `equipamentos` passa a guardar componentes também (naming); risco de linha-fantasma no pull de Equipment | **Escolhida** — menor risco, atende a dor operacional |
| Tabela `pcm.itens` nova | Nome limpo | Migrar 2000+ linhas + refazer todo o pipeline/descriptor Auvo | Rejeitada — custo e risco altos, sem ganho funcional |
| Sistema como Product `/products` | Campo `code` nativo | Não associa cliente nem aparece na tarefa de campo; `/productcategories` 404 na conta | Rejeitada — não atende o uso de campo |
| Local plano (1 nível) | Modelo simples | Não representa andar>sala>ambiente de prédios reais | Rejeitada — PO escolheu árvore |

## Consequências
**Positivas:**
- Ativos organizados por localização física real; Sistemas agrupam itens (N:N) e ganham código Auvo.
- Zero migração de dados; pipeline Auvo de equipamentos intacto.
- Item resolve breadcrumb Cliente>Área>Local e sistemas de que participa.

**Negativas / trade-offs aceitos:**
- `pcm.equipamentos` guarda dois tipos (`equipamento`/`componente`); o nome da tabela não reflete mais só "equipamento".
- **Pré-condição do flip `writeEnabled:true` de Sistemas:** o Sistema empurrado como Equipment volta no
  pull/webhook de Equipment(27) e criaria linha-fantasma em `pcm.equipamentos`. Mitigação obrigatória antes
  de ligar a escrita: excluir do upsert de equipment os `auvo_equipment_id` presentes em `pcm.sistemas`.
- Gravar na conta Auvo real só após teste de contrato campo-a-campo (mesma disciplina de E01-S47).
