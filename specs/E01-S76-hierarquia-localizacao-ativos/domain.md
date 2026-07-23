---
name: domain-E01-S76-hierarquia-localizacao-ativos
description: Modelo de domínio — Área, Local (árvore), Item, Sistema e invariantes.
alwaysApply: false
---

# Domain — Hierarquia de localização de ativos

Bounded context: **PCM / Operação**. Schema: `pcm`.

## Linguagem ubíqua
| Termo | Definição |
|-------|-----------|
| **Área** | Subdivisão macro de um cliente (Torre A, Torre B, Galpão). Pertence a um Cliente. |
| **Local** | Ponto físico dentro de uma Área, em **árvore** (3º andar > Sala 302 > Copa). Pertence a uma Área; pode ter Local pai. |
| **Item** | Ativo instalável. Registro em `pcm.equipamentos`. Tem um `tipo`. |
| **Equipamento** | Item do tipo `equipamento` (ar-condicionado, bomba d'água, hidrante, extintor). |
| **Componente** | Item do tipo `componente` (lâmpada, fechadura, compressor). Pode ser filho de um Equipamento. |
| **Sistema** | Agrupamento funcional transversal de Itens ("Sistema de Hidrante Torre A"). Recebe código do Auvo. |
| **Instalação** | Vínculo de um Item a um Local (`item.local_id`). |

## Entidades / Agregados
- **Cliente** (agregado existente, `pcm.clientes`) — raiz. Áreas e Sistemas pendem do Cliente.
- **Área** (`pcm.areas`) — entity; `cliente_id`, `nome`, `ordem`, `ativo`.
- **Local** (`pcm.locais`) — entity em árvore; `area_id`, `parent_id?`, `nome`, `tipo?`, `ordem`, `ativo`.
- **Item** (`pcm.equipamentos`, estendido) — entity; `client_id`, `local_id?`, `tipo`, `parent_item_id?`.
- **Sistema** (`pcm.sistemas`) — agregado; `cliente_id`, `area_id?`, `nome`, membros via `pcm.sistema_itens`, colunas de sync Auvo.
- **SistemaItem** (`pcm.sistema_itens`) — associação N:N Sistema↔Item.

## Invariantes (oráculos de teste)
1. **Local sem ciclo**: um Local não pode ser ancestral de si mesmo.
2. **Área consistente na subárvore**: se `local.parent_id` está setado, `parent.area_id == local.area_id`.
3. **Tipo de Item**: `tipo ∈ {'equipamento','componente'}`.
4. **Parent de Item mesmo cliente**: se `parent_item_id` setado, o pai pertence ao mesmo `client_id`.
   Recomendado: pai é do tipo `equipamento` (componente pendura em equipamento). Guard em app + nota.
5. **Membro de Sistema mesmo cliente**: todo Item em `sistema_itens` pertence ao `cliente_id` do Sistema.
6. **N:N Item↔Sistema**: um Item (ex.: hidrante) pode estar em vários Sistemas; `unique(sistema_id, item_id)`.
7. **Área sempre presente**: todo Local pertence a uma Área (não há Local direto sob Cliente).

## Eventos de domínio
- **SistemaCriado / SistemaAtualizado** → trigger `trg_sistemas_auvo_enqueue` insere no `pcm.auvo_sync_outbox`
  (op create/update); drenagem pelo motor `pcm-auvo-push` (dry-run enquanto `writeEnabled:false`).
