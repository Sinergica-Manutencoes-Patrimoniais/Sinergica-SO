---
name: E01-S160-arvore-ativos-360
description: Aba "Árvore" na Visão 360 — Cliente > Áreas > Locais com Sistemas (amarelo) e Componentes (laranja) pendurados na posição, recolhível, com busca; baseada no diagrama do Lucas.
alwaysApply: true
---

# Spec — E01-S160 Árvore de ativos na Visão 360

> **Status:** aprovado · **Tier:** pequeno
> Design: [`../E01-S155-posicao-flexivel-ativos/design.md`](../E01-S155-posicao-flexivel-ativos/design.md)
> **Depende de:** E01-S154 (1:N) e E01-S155 (posição, `areaEfetiva`, hooks de áreas/locais).
> **Referência visual:** diagrama "Cliente: Guainumbí" enviado pelo Lucas em 2026-09-29. Caixas
> brancas = estrutura; amarelas = Sistemas; laranjas = Componentes.

## Resumo
Nova aba **"Árvore"** na Visão 360 mostra o cliente inteiro como uma árvore recolhível: Áreas,
Locais, e os Sistemas e Componentes pendurados onde estão.

## Regras de montagem (domínio puro `domain/arvore-ativos.ts`)
```ts
type NoArvore =
  | { tipo: "cliente"; id; nome; filhos: NoArvore[]; total: number }
  | { tipo: "area"; id; nome; sigla: string | null; filhos; total }
  | { tipo: "local"; id; nome; sigla: string | null; filhos; total }
  | { tipo: "sistema"; id; nome; identificador: string | null; filhos; total }
  | { tipo: "componente"; id; nome; identificador: string | null; posicaoDivergente: string | null };
export function montarArvoreAtivos(input: {
  cliente: { id: string; nome: string };
  areas: Area[]; locais: Local[];
  sistemas: Sistema[]; componentes: EquipamentoItem[];
  membros: Array<{ sistemaId: string; itemId: string }>;
}): NoArvore
```
1. Raiz = cliente.
2. Filhos do **cliente**: Áreas (por `ordem`, depois `nome`), depois Sistemas sem Área e sem Local,
   depois Componentes sem Área efetiva, sem Local e sem Sistema.
3. Filhos de uma **Área**: Locais de nível 1 (`parentId` null) da Área, depois Sistemas com essa
   Área e sem Local, depois Componentes com essa Área efetiva, sem Local e sem Sistema.
4. Filhos de um **Local**: sublocais, depois Sistemas com esse `localId`, depois Componentes com
   esse `localId` e sem Sistema.
5. Filhos de um **Sistema**: **todos** os seus Componentes (via `membros`), independentemente da
   posição de cada um. Se a posição do Componente **não** for a do Sistema, `posicaoDivergente` =
   texto da posição do Componente (`Área > Local`), exibido como subtítulo.
6. Ordenação dentro de cada grupo: Locais por `ordem`, `nome`; Sistemas e Componentes por `nome`
   (`localeCompare` pt-BR).
7. `total` = número de Sistemas + Componentes na subárvore (um Componente dentro de Sistema conta
   **uma** vez).
8. Registros desativados (`ativo=false` ou `deleted_at`) não entram.
9. Nó sem filhos e sem ativos continua aparecendo (estrutura vazia é informação).

## Critérios de aceite

### AC-1: Montagem conforme o diagrama
- **Dado** a fixture do diagrama: cliente Guainumbí; Áreas Externo, Torre A, Torre B, Garagem;
  Externo > {Calçada, Canteiro}; Torre A > {Térreo > {Banheiro, Área Comum}, 1 andar > {Hall,
  Sala 01}, 2 andar > {Hall, Sala 01}, N andar > {Hall, Sala 01}}; Torre B > {Térreo, 1 andar};
  Sistema Alarmes (só cliente) com Câmera 1 e Detector 1; Sistema Incêndio (Torre B) com Hidrante 1
  e Hidrante 2; Sistema Quadro de luz (Local Térreo da Torre A); Componente Porta (Banheiro);
  Componentes Ar Condicionado 1 e 2 (Área Comum)
- **Quando** `montarArvoreAtivos` roda
- **Então** a árvore bate com as regras 1–7 (teste com snapshot estrutural por
  `tipo/nome/filhos`, **não** snapshot de string)
- **E** `total` da raiz = 3 Sistemas + 7 Componentes = 10.

### AC-2: Aba e visual
- **Dado** a Visão 360
- **Então** existe a aba **"Árvore"** (ícone `Network` do lucide), logo depois de "Ferramentas"
  (ou depois de "Sistemas", se a S159 ainda não estiver mergeada)
- **E** cada nó é uma linha com recuo de 20px por nível, chevron quando tem filhos, ícone por tipo
  e o `total` em badge quando > 0
- **E** cores por **tokens** (proibido hex): Área/Local neutros (`bg-card`, borda `border-line`);
  Sistema com `bg-warning-soft border-warning-line` (amarelo); Componente com fundo/borda derivados
  do token `orange` já existente em `index.css` (laranja)
- **E** o identificador aparece em fonte mono, menor, ao lado do nome, quando existir; a sigla de
  Área/Local aparece como `· TOA`.

### AC-3: Recolher, expandir e busca
- **Então** abre com cliente e Áreas expandidos, e Locais e Sistemas recolhidos
- **E** tem botões "Expandir tudo" e "Recolher tudo"
- **E** tem campo de busca: com ≥2 caracteres, mostra só os nós cujo nome ou identificador contém
  o termo (sem acento e sem caixa, com a mesma normalização do passo 1 do algoritmo de sigla) **e
  os ancestrais deles**, todos expandidos. Limpar a busca volta ao estado de expansão anterior.
- **E** a função de filtro é pura (`filtrarArvore(no, termo) → NoArvore | null`) e testada.

### AC-4: Clique
- **Quando** o usuário clica num Componente
- **Então** abre o `DrawerDetalheAtivo` já existente (o mesmo do Board)
- **Quando** clica num Sistema, Área ou Local
- **Então** só expande ou recolhe.

### AC-5: Desempenho
- **Dado** um cliente com 2000 Componentes
- **Então** a aba carrega com **no máximo 5 requests** (áreas, locais, sistemas, componentes,
  membros, via hooks da S155/S159) e só renderiza nós de ramos **expandidos** (nó recolhido não
  monta os filhos no DOM).

## Casos de borda e erros
- Membro que aponta para Componente desativado: ignorado.
- Sistema com Local de outra Área (dado inconsistente legado): segue a regra 4 pelo `localId`.
- Falha em qualquer das queries: a aba mostra o erro com "Tentar de novo"; as outras abas seguem
  funcionando.

## Fora de escopo
- Diagrama em caixas (organograma, como o print). Fica para uma v2 se o Lucas pedir.
- Editar ou arrastar pela árvore.
- Exportar a árvore (a exportação é a planilha da S161).

## Rastreabilidade
- Código: `features/pcm/domain/arvore-ativos.ts` (+ `.test.ts`),
  `features/pcm/components/ArvoreAtivos.tsx`, `features/pcm/pages/VisaoClientePage.tsx`,
  `features/pcm/application/ativos-cliente-queries.ts`.
