---
name: E01-S155-posicao-flexivel-ativos
description: Componente e Sistema posicionáveis em Cliente, Área ou Local — cliente obrigatório no SO, área derivada do local, localização Auvo e breadcrumb/Board coerentes.
alwaysApply: true
---

# Spec — E01-S155 Posição flexível de Componente e Sistema

> **Status:** aprovado · **Tier:** arquitetural (schema em produção + payload Auvo)
> Produto: [`product.md`](./product.md) · Design: [`design.md`](./design.md) (D3, "Regra de ouro",
> "Ordem dos triggers") · ADR-0022

## Resumo
Componente e Sistema passam a poder ser pendurados em **qualquer nível**: só no Cliente, numa
Área, ou num Local (em qualquer profundidade). O cliente é obrigatório quando o cadastro é feito
pelo SO.

## Glossário desta story
- **Posição** de um ativo = (cliente, Área opcional, Local opcional). Com Local, a Área é **sempre**
  a do Local.
- **Área efetiva** = `area_id ?? (Área do local_id)`. Linhas legadas têm `local_id` sem `area_id`
  (não há backfill), então **toda** leitura que precisa da Área usa a Área efetiva.

## Critérios de aceite

### AC-1: Componente só na Área
- **Dado** o cliente Guainumbí com a Área "Garagem" sem nenhum Local
- **Quando** o usuário cria o Componente "Portão 1" com Área = Garagem e Local vazio
- **Então** a linha é gravada com `area_id` = Garagem, `local_id` = null, `client_id` = Guainumbí
- **E** `auvo_localizacao` = `"Garagem"`.

### AC-2: Local define a Área
- **Dado** o Local "Banheiro" (Área "Torre A")
- **Quando** um Componente é salvo com `local_id` = Banheiro e **qualquer** `area_id`, inclusive
  outra Área ou null
- **Então** o banco grava `area_id` = Torre A (trigger `trg_equipamentos_normalizar_posicao`)
- **E** na UI, escolher um Local preenche e trava a Área correspondente.

### AC-3: Sistema num Local
- **Dado** o Local "Térreo" (Área "Torre A")
- **Quando** o usuário cria o Sistema "Quadro de luz" com Local = Térreo
- **Então** grava `local_id` = Térreo e `area_id` = Torre A
- **E** `auvo_localizacao` = localização hierárquica do Térreo (mesmo formato do Componente, ex.:
  `"Torre A · Térreo"`, conforme `config.preferencia_localizacao_auvo`).

### AC-4: Só no cliente
- **Dado** o cliente Guainumbí
- **Quando** o usuário cria o Sistema "Alarmes" (ou um Componente) sem Área e sem Local
- **Então** grava com `area_id` = null, `local_id` = null e `auvo_localizacao` = null.

### AC-5: Cliente obrigatório no SO
- **Dado** o modal de Componente ou de Sistema
- **Quando** o usuário tenta salvar sem cliente
- **Então** aparece o erro "Cliente é obrigatório." (lançado por `validarEquipamento` /
  `validarSistema`) e nada é enviado ao banco
- **E** o `<select>` de cliente do Componente **não** tem mais a opção "Sem vínculo"
- **E** o banco **não** ganha `NOT NULL`/`CHECK` em `client_id` (o inbound do Auvo continua
  gravando sem cliente).

### AC-6: Divergência cliente × Área
- **Dado** o Componente do cliente X
- **Quando** alguém grava `area_id` (ou `local_id`) de uma Área do cliente Y
- **Então** o banco rejeita com `errcode 23514` e mensagem `posicao_cliente_divergente`
- **E** o adapter traduz para `Error("A Área/Local escolhido é de outro cliente.")`.
- **Exceção:** se o cliente da linha for null, o trigger **preenche** o cliente a partir da Área e
  não rejeita.

### AC-7: Localização Auvo recalculada
| Situação | `auvo_localizacao` esperado |
|---|---|
| Componente com Local | `fn_montar_localizacao_hierarquica(local_id)` (como hoje) |
| Componente só com Área | nome da Área |
| Sistema com Local | `fn_montar_localizacao_hierarquica(local_id)` |
| Sistema só com Área | nome da Área (como hoje) |
| Sem Área e sem Local | null |
| Rename de Área | propaga para Componentes **e** Sistemas com aquela Área efetiva |
| Rename de Local | propaga para Componentes **e** Sistemas naquele Local ou descendentes |

### AC-8: Breadcrumb e Board usam a Área efetiva
- **Dado** um Componente só com Área (sem Local)
- **Quando** o usuário abre o detalhe (drawer do Board ou tela de Componentes)
- **Então** o breadcrumb mostra `Cliente > Área` (hoje só mostraria o Cliente)
- **E** no Board da Área X, a coluna "Sem local" mostra **só** Componentes com Área efetiva = X e
  sem Local. Componentes sem Área **não** aparecem no Board. Hoje, todo Componente sem Local
  aparece em qualquer Área; esse comportamento muda.

## Matriz de decisão — trigger `normalizar_posicao`
| local_id | area_id enviado | cliente da linha | Área do local/área é do cliente? | Resultado | AC |
|---|---|---|---|---|---|
| null | null | qualquer | — | grava como veio | AC-4 |
| null | A | C | sim | grava | AC-1 |
| null | A | null | — | cliente := cliente da Área A | AC-6 |
| null | A | C | não | 23514 `posicao_cliente_divergente` | AC-6 |
| L | qualquer | C | sim | area_id := área de L | AC-2 |
| L | qualquer | C | não | 23514 | AC-6 |
| L | qualquer | null | — | area_id := área de L; cliente := cliente da Área | AC-2 |

## Casos de borda e erros
- Local/Área com `deleted_at` preenchido: o seletor da UI só lista ativos. O trigger não bloqueia
  (a FK aceita), porque apagar Área/Local já é bloqueado quando há filhos (comportamento atual).
- Linha legada com `local_id` e `area_id` null: continua válida. Ao ser editada, o trigger
  preenche `area_id`.
- **Inbound do Auvo** (`app.auvo_sync_write='true'`): o trigger roda também. Com `local_id` null e
  `area_id` null, não faz nada, então o inbound não é afetado.
- Mudar o cliente de um Componente que tem Área/Local de outro cliente: 23514. A UI limpa Área e
  Local quando o cliente muda (evita o erro).

## Fora de escopo
- Backfill de `area_id` nas linhas legadas (regra de ouro do design).
- Siglas, identificador, categoria, descrição (S156–S158).
- Criar Sistema/Componente dentro da 360 (S159). Aqui só os modais existentes mudam.
- Componente herdar a posição do Sistema.

## Rastreabilidade
- Design: `./design.md` (D3, triggers). Migrations novas: `NNNN_E01-S155_posicao_flexivel_ativos.sql`
  e `NNNN_E01-S155_validar_fk_posicao.sql`.
- Código: `features/pcm/domain/{equipamentos,sistemas,posicao-ativo,board-ativos}.ts`,
  `features/pcm/infrastructure/{supabase-equipamentos-adapter,supabase-sistemas-adapter}.ts`,
  `features/pcm/components/{EquipamentoModal,SeletorPosicao}.tsx`, `features/pcm/pages/SistemasPage.tsx`.
