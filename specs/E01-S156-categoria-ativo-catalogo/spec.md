---
name: E01-S156-categoria-ativo-catalogo
description: Categoria de Componente e Sistema passa a vir do catálogo pcm.equipamento_categorias (espelhado com o Auvo), com sigla de 3 caracteres, 6 categorias semente e criação pela UI.
alwaysApply: true
---

# Spec — E01-S156 Categoria de ativo como catálogo

> **Status:** aprovado · **Tier:** pequeno · Iniciativa: Cadastro de ativos v2
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md)
> (D4, "Algoritmo de sigla", "Regra de ouro", "Ordem dos triggers")

## Resumo
Componente e Sistema passam a ter **categoria obrigatória escolhida do catálogo**
`pcm.equipamento_categorias`. O catálogo já é sincronizado com as categorias de Equipment do Auvo
(pull diário e criação pelo SO). O catálogo ganha **sigla**, 6 categorias semente e criação rápida
dentro do modal.

## Contexto para quem implementa
- O catálogo e o sync **já existem**: tabela `pcm.equipamento_categorias` (`0029`), descriptor
  `equipamentoCategoriasDescriptor` (`registry/categorias.ts`, `writeEnabled:true`, cron 6h) e tela
  genérica `CatalogoSimplesPage.tsx` (rótulo "Categorias de Equipamento").
- Hoje `pcm.equipamentos.categoria` é **texto livre**, enviado ao Auvo como `category`. Esse
  contrato com o Auvo **não muda**: o texto continua existindo, preenchido por trigger a partir do
  catálogo.
- As categorias atuais do Auvo (ex.: "Quadro Elétrico") **convivem** com as 6 novas. A
  higienização é trabalho futuro do Lucas.
- Esta story cria `features/pcm/domain/siglas.ts` (algoritmo **completo** do design), que a
  E01-S157 reusa.

## Critérios de aceite

### AC-1: Algoritmo de sigla
- **Dado** `sugerirSigla`, `sugerirSiglaUnica` e `validarSigla` em `domain/siglas.ts`
- **Quando** executados com **cada linha** da tabela "Casos de ouro" do design.md
- **Então** devolvem exatamente a `sigla` e o `numeroFinal` da tabela
- **E** `validarSigla(" ele ")` → `"ELE"`; `validarSigla("EL")` e `validarSigla("EL-1")` lançam
  "Sigla deve ter exatamente 3 letras ou números."
- **E** `sugerirSiglaUnica("Sala 01", new Set(["S01"]), { manterNumero: true })` → `"S02"`.

### AC-2: Catálogo com sigla
- **Dado** `pcm.equipamento_categorias`
- **Então** existe a coluna `sigla text` com `check (sigla ~ '^[A-Z0-9]{3}$')` (nullable, porque
  categorias vindas do Auvo chegam sem sigla) e índice único
  `uq_equipamento_categorias_sigla (sigla) where deleted_at is null and sigla is not null`
- **E** a sigla **não** é enviada ao Auvo (descriptor inalterado).

### AC-3: Seis categorias semente
- **Dado** a migration aplicada
- **Então** existem, sem duplicar nome já existente (comparação `lower(unaccent(nome))`, ou
  `lower(nome)` se `unaccent` não estiver disponível):

| nome | sigla |
|---|---|
| Elétrica | ELE |
| Hidráulica | HID |
| Transporte Vertical | TRV |
| Climatização | CLI |
| Segurança | SEG |
| PCI (Prevenção e Combate a Incêndio) | PCI |

- **E** categoria que **já existia** com esse nome só recebe a sigla (se estiver null)
- **E** os inserts enfileiram a criação no Auvo pelo trigger normal (desejado: o Auvo passa a ter
  essas categorias).

### AC-4: Componente e Sistema apontam para o catálogo
- **Dado** as tabelas
- **Então** `pcm.equipamentos.categoria_id` e `pcm.sistemas.categoria_id` existem (FK para
  `pcm.equipamento_categorias`, criada `not valid` e validada em migration separada), e
  `pcm.sistemas.categoria text` existe
- **E** o trigger `trg_equipamentos_categoria_sync` / `trg_sistemas_categoria_sync`
  (`before insert or update of categoria_id, categoria`) faz:
  1. `categoria_id` mudou e não é null → `categoria := nome` da categoria;
  2. `categoria_id` virou null e o `categoria` enviado não mudou → `categoria := null`;
  3. `categoria_id` é null e `categoria` não é null (ex.: inbound do Auvo) → procura categoria com
     `lower(nome) = lower(categoria)` e `deleted_at is null`; se achar, `categoria_id := id`.
- **E** o descriptor de **sistemas** passa a enviar `category: row.categoria` (o de equipamentos
  já envia).

### AC-5: Backfill sem PATCH
- **Dado** Componentes existentes com `categoria` texto igual (case-insensitive) ao nome de uma
  categoria do catálogo
- **Quando** a migration de backfill roda
- **Então** `categoria_id` é preenchido **dentro de** `set local app.auvo_sync_write = 'true'`
- **E** nenhuma linha nova aparece em `pcm.auvo_sync_outbox` por causa dele (verificável com
  `count(*)` antes e depois, na mesma transação do teste pgTAP).

### AC-6: Categoria obrigatória no SO
- **Dado** o modal de Componente ou de Sistema
- **Quando** o usuário salva sem categoria
- **Então** vê "Categoria é obrigatória." (de `validarEquipamento` / `validarSistema`, que agora
  exigem `categoriaId`)
- **E** o campo "Categoria" é um `<select>` com as categorias ativas do catálogo, em ordem
  alfabética, mostrando `Nome (SIG)` quando há sigla
- **E** o campo livre "Categoria" e o campo "Tipo" do Sistema **saem** da UI (colunas preservadas).
- **E** ao editar um registro legado sem `categoria_id` mas com texto, o modal mostra acima do
  select: `Categoria atual (fora do catálogo): «texto»`, e exige escolher uma.

### AC-7: Criar categoria pelo modal
- **Dado** o `<select>` de categoria
- **Quando** o usuário clica "+ Nova categoria"
- **Então** aparece um mini-form inline com Nome (obrigatório) e Sigla (pré-preenchida com
  `sugerirSiglaUnica(nome, siglasEmUso, { manterNumero: true })` ao sair do campo Nome, e
  editável)
- **E** "Criar" grava no catálogo (enfileira criação no Auvo), invalida a query do catálogo e
  seleciona a nova categoria
- **E** sigla duplicada → "Sigla já usada por outra categoria."

### AC-8: Tela de catálogo mostra sigla
- **Dado** `CatalogoSimplesPage` com tipo `equipamento_categorias`
- **Então** o rótulo vira **"Categorias de Ativo"**, a lista mostra a coluna Sigla e o form tem o
  campo Sigla (mesma sugestão do AC-7). Outros tipos de catálogo não mudam.

## Casos de borda e erros
- Categoria desativada (`deleted_at`) não aparece no select. Um registro que ainda aponta para ela
  mostra o aviso "fora do catálogo" (mesmo texto do AC-6).
- Duas categorias com o mesmo nome em caixas diferentes no Auvo: o passo 3 do trigger escolhe a de
  menor `created_at` (`order by created_at limit 1`).
- Mover um item legado sem categoria (Board, painel da 360) usa `atualizarPosicaoComponente`
  (E01-S155), que **não** passa por `validarEquipamento`, então não é bloqueado. A exigência de
  categoria vale só nos modais de criar/editar.
- Pull diário do Auvo que renomeia uma categoria: o texto `categoria` dos Componentes **não** é
  repropagado (fora de escopo). O vínculo `categoria_id` continua certo.

## Fora de escopo
- Higienizar/mesclar as categorias atuais do Auvo.
- Propagar rename de categoria para `categoria`/`auvo_descricao` dos ativos.
- Filtro por categoria na listagem (pode entrar na S159).

## Rastreabilidade
- Migrations: `NNNN_E01-S156_categoria_ativo_catalogo.sql`, `NNNN_E01-S156_validar_fk_categoria.sql`.
- Código: `features/pcm/domain/{siglas,catalogos-simples,equipamentos,sistemas}.ts`,
  `features/pcm/infrastructure/{supabase-catalogos-simples-adapter,supabase-equipamentos-adapter,supabase-sistemas-adapter}.ts`,
  `features/pcm/components/{EquipamentoModal,SeletorCategoria}.tsx`,
  `features/pcm/pages/{SistemasPage,CatalogoSimplesPage}.tsx`,
  `supabase/functions/_shared/auvo/registry/sistemas.ts`.
