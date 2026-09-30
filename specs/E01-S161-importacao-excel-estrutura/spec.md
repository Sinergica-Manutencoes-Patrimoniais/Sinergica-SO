---
name: E01-S161-importacao-excel-estrutura
description: Exportar e importar a estrutura do cliente (Áreas, Locais, Sistemas, Componentes) por Excel, com simulação (dry-run) campo a campo, erros bloqueantes, confirmação e relatório por linha — tudo no browser reusando os casos de uso.
alwaysApply: true
---

# Spec — E01-S161 Importação/exportação da estrutura via Excel

> **Status:** aprovado · **Tier:** pequeno (alto) — sem migration
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md) (D8)
> **Depende de:** E01-S159 (e, portanto, S154–S157). Pedido original do Lucas: 2026-09-25.
> Planilha de exemplo: [`exemplo-planilha.xlsx`](./exemplo-planilha.xlsx).

## Resumo
Na aba Estrutura da Visão 360, o usuário **exporta** uma planilha com a estrutura atual do
cliente, edita (criar, editar, excluir linhas), **importa** de volta, vê uma **simulação** do que
vai mudar, e só então **executa**. No fim, recebe um relatório linha a linha.

## Layout da planilha (contrato)
Abas e colunas **nesta ordem**, com cabeçalho na linha 1. Na leitura, o cabeçalho é comparado sem
acento, sem caixa e sem espaços nas pontas.

| Aba | Colunas |
|---|---|
| `Leia-me` | texto de instruções (ignorada na importação) |
| `Áreas` | Ação · Id · Nome · Sigla · Ordem |
| `Locais` | Ação · Id · Área · Local pai · Nome · Sigla · Tipo de Local · Ordem |
| `Sistemas` | Ação · Id · Identificador · Nome · Categoria · Área · Local · Descrição |
| `Componentes` | Ação · Id · Identificador · Nome · Categoria · Área · Local · Sistema · Observações |
| `Listas` | Categorias (nome, sigla) e Tipos de Local do cliente, para consulta (ignorada na importação) |

Regras de valor:
- **Ação**: `CRIAR`, `EDITAR`, `EXCLUIR` (sem caixa, trim). Vazio = linha ignorada.
- **Id**: uuid vindo da exportação. Obrigatório em EDITAR/EXCLUIR, proibido em CRIAR.
- **Área**: nome da Área do cliente.
- **Local** e **Local pai**: caminho **dentro da Área**, com níveis separados por ` > ` (ex.:
  `2º Andar > Shaft`). Vazio = sem Local / Local raiz.
- **Categoria**: nome de uma categoria existente no catálogo (a planilha **não** cria categoria).
- **Sistema** (Componentes): nome de um Sistema do mesmo cliente (existente ou criado na mesma
  planilha). Vazio = sem Sistema.
- **Identificador**: em CRIAR, vazio = gerado (S157) e preenchido = manual. Em EDITAR, a coluna é
  **ignorada** (identificador é fixo; ver AC-5).
- **Sigla**: 3 caracteres. Vazia em CRIAR = sugerida automaticamente (`sugerirSiglaUnica`).
- Comparação de nomes (Área, Local, Sistema, Categoria, Tipo de Local): trim, espaços internos
  colapsados, **sem caixa**, **com** acento.

## Critérios de aceite

### AC-1: Exportar
- **Dado** a aba Estrutura de um cliente (qualquer usuário com `pcm` leitura)
- **Quando** clica "Exportar Excel"
- **Então** baixa `estrutura-<sigla-ou-nome-do-cliente>-<AAAA-MM-DD>.xlsx` no layout acima, com
  **todos** os registros ativos do cliente, Ação vazia e Id preenchido
- **E** Locais saem ordenados por profundidade (pai antes do filho), para a planilha reimportar
  sem ajuste.

### AC-2: Reimportar sem mudar nada = nada acontece
- **Dado** o arquivo recém-exportado, sem edição
- **Quando** é importado
- **Então** a simulação mostra 0 alterações e o botão "Executar" fica desabilitado.

### AC-3: Simulação (dry-run)
- **Dado** uma planilha editada
- **Quando** é importada
- **Então** **nada é gravado**. A tela mostra, por aba, uma tabela com: nº da linha, Ação,
  Resultado (`CRIAR` | `EDITAR` | `EXCLUIR` | `SEM MUDANÇA` | `ERRO` | `AVISO`) e Detalhes
  - EDITAR: uma linha por campo alterado no formato `campo: antes → depois`;
  - CRIAR: identificador que será gerado (prévia com `-##` quando depende do sequencial) e as
    siglas que serão criadas automaticamente (`Sigla da Área «Torre A»: TOA (sugerida)`);
  - ERRO: a mensagem literal da tabela de erros;
- **E** um resumo no topo: `N criar · N editar · N excluir · N erros · N avisos`.

### AC-4: Erros bloqueiam
- **Então** com pelo menos 1 `ERRO`, "Executar" fica desabilitado, com o texto "Corrija os erros
  na planilha e importe de novo."

| Situação | Mensagem (ERRO) |
|---|---|
| Ação desconhecida | `Ação inválida: «X». Use CRIAR, EDITAR ou EXCLUIR.` |
| EDITAR/EXCLUIR sem Id, ou Id que não é deste cliente | `Id não encontrado neste cliente.` |
| CRIAR com Id | `Linha de CRIAR não pode ter Id.` |
| Nome vazio (CRIAR/EDITAR) | `Nome é obrigatório.` |
| Área inexistente (nem criada na planilha) | `Área «X» não existe.` |
| Caminho de Local não resolve | `Local «A > B» não existe na Área «X».` |
| Caminho casa com 2+ Locais | `Local «A > B» é ambíguo na Área «X».` |
| Categoria fora do catálogo | `Categoria «X» não existe. Cadastre em Categorias de Ativo.` |
| Categoria vazia (CRIAR/EDITAR de Sistema/Componente) | `Categoria é obrigatória.` |
| Tipo de Local inexistente | `Tipo de Local «X» não existe para este cliente.` |
| Sigla inválida | `Sigla deve ter exatamente 3 letras ou números.` |
| Sigla repetida entre irmãos (banco + planilha) | `Sigla «X» já usada neste nível.` |
| Sistema inexistente ou marcado para EXCLUIR | `Sistema «X» não existe.` |
| EXCLUIR Área/Local com filhos ou ativos ativos que não estão sendo excluídos | `Não é possível excluir: ainda tem Locais ou ativos.` |
| Mais de 2000 linhas com Ação | `Planilha com mais de 2000 alterações. Divida em partes.` |
| Aba obrigatória ausente ou cabeçalho diferente | `Aba «X» ausente ou com colunas diferentes do modelo.` |

| Situação | Mensagem (AVISO, não bloqueia) |
|---|---|
| EDITAR com Identificador diferente do atual | `Identificador não é alterado pela planilha (use a tela do ativo).` |
| EDITAR que muda posição/nome de ativo com identificador no padrão | `O identificador continua o mesmo (fixo).` |

### AC-5: Executar
- **Dado** uma simulação sem erros e com alterações
- **Quando** o usuário clica "Executar" e confirma o diálogo "Aplicar N alterações? Elas também
  serão enviadas ao Auvo."
- **Então** as alterações são aplicadas **uma por vez** (sequencial, nunca `Promise.all`, para não
  sobrecarregar o drain do Auvo), nesta ordem:
  1. siglas automáticas;
  2. Áreas CRIAR/EDITAR;
  3. Locais CRIAR/EDITAR, por profundidade crescente;
  4. Sistemas CRIAR/EDITAR;
  5. Componentes CRIAR/EDITAR, incluindo o vínculo com o Sistema;
  6. EXCLUIR, na ordem inversa (Componentes, Sistemas, Locais por profundidade decrescente, Áreas).
- **E** toda gravação passa pelos **casos de uso existentes** de `application/` (`criarArea`,
  `criarLocal`, `criarSistema`, `criarEquipamento`, `salvarComposicaoSistema`/`adicionarItem`,
  `desativar*` etc.). **Nunca** pelo adapter direto nem por SQL novo.
- **E** uma barra de progresso mostra `k de N`.
- **E** falha numa linha **não** interrompe: a linha fica `FALHOU` com a mensagem, e o resto segue.
  Linha que depende de uma que falhou (ex.: Local cujo pai falhou) fica `PULADA — depende da linha X`.
- **E** no fim, as queries da 360 são invalidadas.

### AC-6: Relatório
- **Então** a tela final lista cada linha com `OK` | `FALHOU` | `PULADA` e a mensagem
- **E** o botão "Baixar relatório" gera `.xlsx` com as mesmas abas + a coluna **Resultado**.

## Casos de borda e erros
- Arquivo que não é `.xlsx`/`.xls`: "Arquivo inválido. Use a planilha exportada pelo SO."
- Linha vazia no meio: ignorada.
- Mesmo registro em 2 linhas (mesmo Id): ERRO `Id repetido na planilha (linhas X e Y).`
- CRIAR de Local cujo pai é criado na **mesma** planilha: permitido (o planejamento resolve pela
  ordem de profundidade).
- Nome com espaços extras ou caixa diferente de um existente num CRIAR de Área: ERRO
  `Já existe uma Área «X».` (evita duplicata por digitação).
- SheetJS falha ao carregar (CDN fora): "Não foi possível carregar o leitor de planilhas."

## Fora de escopo
- Criar categoria ou Tipo de Local pela planilha.
- Alterar identificador pela planilha.
- Ferramentas na planilha.
- Importação em background/servidor (Edge Function). Tudo roda no browser.
- Desfazer uma importação.

## Rastreabilidade
- Código: `apps/web/src/lib/sheetjs.ts` (extraído de `InspecoesPage.tsx`),
  `features/pcm/domain/importacao-estrutura.ts` (+ `.test.ts`),
  `features/pcm/application/importacao-estrutura.ts` (+ `.test.ts`),
  `features/pcm/components/ImportacaoEstruturaModal.tsx`, `features/pcm/pages/EstruturaClientePage.tsx`.
