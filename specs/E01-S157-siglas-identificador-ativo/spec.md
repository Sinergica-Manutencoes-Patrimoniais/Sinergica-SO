---
name: E01-S157-siglas-identificador-ativo
description: Siglas de 3 caracteres em Cliente/Área/Local e identificador de Componente/Sistema gerado na criação pelo SO (GUA-TOA-A02-SHA-ELE-QDC-01), fixo depois, com alteração manual confirmada (QR Code).
alwaysApply: true
---

# Spec — E01-S157 Siglas + identificador de ativo

> **Status:** aprovado · **Tier:** arquitetural
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md)
> (D5, "Algoritmo de sigla", "Identificador — composição e sequencial") ·
> [ADR-0022](../../docs/adr/0022-identificador-ativo-siglas-imutavel.md)
> **Depende de:** E01-S155 (posição) e E01-S156 (categoria + `domain/siglas.ts`).

## Resumo
Cliente, Área e Local ganham **sigla** de 3 caracteres. Todo Componente/Sistema **criado pelo SO**
nasce com identificador `CLI[-ARE][-LOC...]-CAT-NOM-NN`, que segue para o Auvo como `identifier`.
Depois disso o identificador é fixo. Mudar à mão exige confirmar o aviso de QR Code.

## Onde o identificador mora
| Ativo | Coluna | Vai ao Auvo como |
|---|---|---|
| Componente | `pcm.equipamentos.identificador` | `identifier` (descriptor já envia) |
| Sistema | `pcm.sistemas.codigo` | `identifier` (descriptor já envia) |

## Critérios de aceite

### AC-1: Siglas nos níveis (banco)
- **Então** existem as colunas `sigla text check (sigla ~ '^[A-Z0-9]{3}$')` (nullable) em
  `pcm.clientes`, `pcm.areas` e `pcm.locais`, com índices únicos parciais
  (`where deleted_at is null and sigla is not null`):
  - `uq_clientes_sigla (sigla)`;
  - `uq_areas_sigla (cliente_id, sigla)`;
  - `uq_locais_sigla (area_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), sigla)`.
- **E** não há backfill (siglas nascem null e são preenchidas por uso, AC-2/AC-3/AC-6).

### AC-2: Sigla na Estrutura (Área e Local)
- **Dado** `AreaModal`/`LocalModal` (`pages/EstruturaClientePage.tsx` ~L500/L568)
- **Quando** o usuário digita o Nome e sai do campo, num registro **sem sigla**
- **Então** o campo **Sigla** é preenchido com
  `sugerirSiglaUnica(nome, siglasDosIrmãos, { manterNumero: true })`. Irmãos: para Área, as Áreas
  do cliente; para Local, os Locais com a mesma Área e o mesmo `parent_id`
- **E** a sigla é editável, validada por `validarSigla`, e salva junto
- **E** sigla repetida entre irmãos → "Sigla já usada neste nível." (de 23505 ou checagem prévia)
- **E** a árvore da Estrutura mostra a sigla ao lado do nome (`Torre A · TOA`)
- **E** editar a sigla de um nível que já tem sigla mostra, abaixo do campo: "Mudar a sigla não
  altera identificadores já gerados."

### AC-3: Sigla do cliente
- **Dado** o modal "Editar cadastro" do cliente (`components/ClienteFormModal.tsx`, via 360)
- **Então** tem o campo **Sigla** com a mesma regra (sugestão com `manterNumero: true`, única
  global, mesmo aviso de mudança).

### AC-4: Composição do identificador (domínio puro)
- **Dado** `montarPrefixoIdentificador` em `domain/identificador-ativo.ts`
- **Então** para cada linha abaixo o resultado é exatamente o esperado:

| Cliente | Área | Locais (raiz→folha) | Categoria | Nome do ativo | prefixo | numeroDoNome |
|---|---|---|---|---|---|---|
| GUA | TOA | A02, SHA | ELE | Quadro de Distribuição de Circuitos 01 | GUA-TOA-A02-SHA-ELE-QDC | 01 |
| GUA | — | — | ELE | Quadro Geral | GUA-ELE-QUG | null |
| GUA | GAR | — | SEG | Portão 1 | GUA-GAR-SEG-POR | 01 |
| GUA | TOB | — | PCI | Sistema de Hidrante Torre A | GUA-TOB-PCI-SHT | null |
| GUA | TOA | TER, BAN | HID | Ar Condicionado 2 | GUA-TOA-TER-BAN-HID-ARC | 02 |

- **E** falta de qualquer sigla obrigatória (cliente, área presente, local presente, categoria)
  lança `SiglasFaltantesError` com a lista `{ nivel: 'cliente'|'area'|'local'|'categoria', id, nome }[]`.
- **E** `montarIdentificador(prefixo, nn)` → `${prefixo}-${nn}`.

### AC-5: Sequencial
- **Dado** a RPC `pcm.fn_proximo_sequencial_identificador(p_prefixo text) returns text` (contrato
  no design)
- **Quando** já existem `GUA-TOA-A02-SHA-ELE-QDC-01` e `-03` (equipamentos ou sistemas, não
  deletados)
- **Então** devolve `'04'`. Sem nenhum → `'01'`. Prefixo fora do padrão → erro `prefixo_invalido`
- **E** existem os índices únicos parciais `uq_equipamentos_identificador_padrao` e
  `uq_sistemas_codigo_padrao` (design).

### AC-6: Criar pelo SO gera o identificador
- **Dado** o modal de **criação** de Componente ou Sistema com cliente, posição, categoria e nome
  preenchidos
- **Então** o campo "Identificador" mostra uma **prévia** (somente leitura) do prefixo +
  `NN` (ou `-##` enquanto o sequencial não foi reservado), recalculada a cada mudança desses campos
- **E** se faltar sigla em algum nível, aparece o bloco **"Siglas faltando"**, uma linha por nível
  (`Torre A → [TOA]`), pré-preenchido com a sugestão única e editável. Salvar grava essas siglas
  **antes** de criar o ativo
- **E** ao salvar: `NN = numeroDoNome ?? rpc(prefixo)`. Grava o ativo com o identificador. Se o
  insert falhar com 23505 **e** o `NN` veio da RPC, busca de novo e tenta **uma** vez mais
- **E** "Editar identificador" (link ao lado da prévia) permite digitar um valor manual (trim +
  uppercase, sem espaço, não vazio), que **substitui** a geração.

### AC-7: Número no nome em conflito
- **Dado** já existe `GUA-TOA-TER-BAN-HID-ARC-02`
- **Quando** o usuário cria "Ar Condicionado 2" no mesmo lugar e categoria
- **Então** o salvar falha com "O identificador GUA-TOA-TER-BAN-HID-ARC-02 já existe. Mude o número
  no nome ou edite o identificador." (sem retry, porque o número veio do nome).

### AC-8: Identificador fixo e alteração com aviso de QR
- **Dado** o modal de **edição** de qualquer Componente/Sistema (criado pelo SO ou vindo do Auvo)
- **Então** o identificador aparece **somente leitura**. Mudar nome, posição ou categoria **não**
  o altera
- **Quando** o usuário clica "Alterar identificador"
- **Então** abre `ConfirmDialog` com título "Alterar identificador?" e texto: "O identificador é
  usado no QR Code do Auvo. Etiquetas já impressas deixarão de corresponder a este ativo. Deseja
  continuar?"
- **E** só depois de confirmar o campo fica editável. O valor salvo segue ao Auvo pelo sync normal.

### AC-9: Itens criados no Auvo não são tocados
- **Dado** um Equipment criado no Auvo que chega pelo inbound
- **Então** `identificador` é o do Auvo, e o SO **nunca** gera nem sobrescreve (a geração só
  existe no caso de uso de **criação** do SO).

### AC-10: Auvo respeita o identifier enviado (verificação)
- **Dado** um Componente criado pelo SO num cliente de teste, depois do deploy
- **Quando** o outbox drena e o webhook/pull do Auvo volta
- **Então** o `identifier` no Auvo (GET `/equipments/{id}`) é igual ao identificador do SO, e a
  linha no SO **não** foi sobrescrita por outro valor.
- **Se falhar:** PARE, registre `SPEC_DEVIATION` e avise o Lucas. Não tente contornar.

## Casos de borda e erros
- Cliente sem categoria escolhida: a prévia mostra "Escolha a categoria para gerar o identificador".
- Nome só com número ("12"): a sigla do nome sai pela regra f (`012`), e `numeroDoNome` é null
  (regra f não separa número). Sequencial normal.
- Dois usuários criando com o mesmo prefixo ao mesmo tempo: 1 retry (AC-6). Se falhar de novo,
  mostra "Não foi possível reservar o identificador. Tente salvar de novo."
- Sigla faltando num nível que o usuário **não** tem permissão de editar: a mesma permissão
  `pcm:escrita` cobre tudo, então não acontece.
- Componente legado sem identificador, editado: continua sem. Não gera automaticamente (AC-8).

## Fora de escopo
- Gerar identificador para itens existentes (em lote ou automático).
- Recalcular identificador quando sigla, posição ou nome mudam.
- Impressão de QR Code / etiquetas.
- Unicidade cruzada equipamentos × sistemas por índice (a RPC cobre; risco aceito no design).

## Rastreabilidade
- Migrations: `NNNN_E01-S157_siglas_identificador_ativo.sql`.
- Código: `features/pcm/domain/{identificador-ativo,siglas}.ts`,
  `features/pcm/application/{identificador-ativo,identificador-ativo-gateway,equipamentos,sistemas}.ts`,
  `features/pcm/infrastructure/supabase-identificador-ativo-adapter.ts`,
  `features/pcm/components/{CampoIdentificador,EquipamentoModal,ClienteFormModal}.tsx`,
  `features/pcm/pages/{EstruturaClientePage,SistemasPage}.tsx`.
