---
name: E01-S158-descricao-completa-auvo
description: Descrição do Equipment no Auvo passa a ser o nome completo do ativo (Cliente - Área - Locais - Categoria - Nome), calculado por trigger em auvo_descricao, sem backfill.
alwaysApply: true
---

# Spec — E01-S158 Descrição completa no Auvo

> **Status:** aprovado · **Tier:** pequeno
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md)
> (D6, "Regra de ouro", "Ordem dos triggers") · **Depende de:** E01-S155, E01-S156.

## Resumo
O campo **Descrição** do Equipment no Auvo passa a trazer o nome completo do Componente/Sistema,
por exemplo `Guainumbí - Torre A - 2º Andar - Shaft - Elétrica - Quadro de Distribuição de Circuitos 01`.

## Critérios de aceite

### AC-1: Função de montagem
- **Dado** `pcm.fn_montar_descricao_auvo(p_cliente_id uuid, p_area_id uuid, p_local_id uuid, p_categoria_id uuid, p_nome text) returns text` (`stable`)
- **Então** devolve as partes não nulas, nesta ordem, unidas por `' - '`:
  1. `pcm.clientes.nome` do cliente;
  2. nome da Área **efetiva** (a Área do local, se houver local; senão `p_area_id`);
  3. nomes da cadeia de Locais, da raiz até `p_local_id` (mesma CTE recursiva de
     `fn_montar_localizacao_hierarquica`);
  4. `pcm.equipamento_categorias.nome`;
  5. `p_nome`.
- **E** com tudo null exceto o nome → só o nome.

| cliente | área | locais | categoria | nome | resultado |
|---|---|---|---|---|---|
| Guainumbí | Torre A | 2º Andar > Shaft | Elétrica | Quadro de Distribuição de Circuitos 01 | `Guainumbí - Torre A - 2º Andar - Shaft - Elétrica - Quadro de Distribuição de Circuitos 01` |
| Guainumbí | — | — | Segurança | Alarmes | `Guainumbí - Segurança - Alarmes` |
| Guainumbí | Garagem | — | — | Portão 1 | `Guainumbí - Garagem - Portão 1` |
| — | — | — | — | Bomba | `Bomba` |

### AC-2: Coluna recalculada por trigger
- **Então** `pcm.equipamentos.auvo_descricao` e `pcm.sistemas.auvo_descricao` (text, nullable)
  existem
- **E** os triggers `trg_equipamentos_texto_auvo` / `trg_sistemas_texto_auvo`
  (`before insert or update of nome, <coluna cliente>, area_id, local_id, categoria_id`) preenchem
  a coluna. Pelo nome, rodam **depois** de `normalizar_posicao` e `recalcular_localizacao` (tabela
  de ordem no design)
- **E** **não há backfill**: linhas antigas ficam com `null` até serem tocadas.

### AC-3: Rename propaga
- **Quando** o nome de uma Área ou de um Local muda
- **Então** `auvo_descricao` dos Componentes e Sistemas afetados é recalculado dentro das funções
  de propagação existentes (`fn_areas_propagar_localizacao`, `fn_locais_propagar_localizacao`),
  com o mesmo alcance que a E01-S155 definiu para `auvo_localizacao`.
- **E** rename de **cliente** ou de **categoria** **não** propaga (fora de escopo).

### AC-4: Enviado ao Auvo
- **Então** `equipamentosDescriptor.toAuvo` manda `description: row.auvo_descricao ?? row.nome`
- **E** `sistemasDescriptor.toAuvo` manda `description: row.auvo_descricao ?? row.descricao ?? row.nome`
- **E** `fromAuvo` **não** lê `description` para `auvo_descricao` (a coluna é só de saída).

### AC-5: Visível no SO
- **Dado** o drawer de detalhe (`DrawerDetalheAtivo.tsx`) e a lista de Componentes da 360
- **Então** mostra a linha "Nome completo (Auvo)" com `auvo_descricao`, ou "—" quando null.

## Casos de borda e erros
- Nome muito longo: não trunca. Se o Auvo recusar tamanho, o erro aparece em `auvo_sync_error`
  (comportamento atual do sync) e vira achado para o Lucas.
- `app.auvo_sync_write='true'` (inbound): o trigger recalcula mesmo assim (coluna local; o enqueue
  continua suprimido).

## Fora de escopo
- Backfill das ~2000 linhas.
- Propagar rename de cliente/categoria.
- Mudar `location` (continua `auvo_localizacao`).

## Rastreabilidade
- Migration: `NNNN_E01-S158_descricao_completa_auvo.sql`.
- Código: `supabase/functions/_shared/auvo/registry/{equipamentos,sistemas}.ts` (+ testes Deno),
  `features/pcm/{domain/equipamentos,domain/sistemas,infrastructure/supabase-equipamentos-adapter,infrastructure/supabase-sistemas-adapter}.ts`,
  `features/pcm/components/DrawerDetalheAtivo.tsx`.
