---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Import Excel: coluna "Ocorrência" é foto, não relato

> **Fonte da verdade.** Origem: Lucas (2026-08-10, item 4). "No arquivo da inspeção a coluna
> ocorrência é o link público da imagem do Auvo, ela precisa ser exibida." Confirmado por ele: a
> coluna "Ocorrência" do export do Auvo guarda o(s) link(s) público(s) da foto (ex.:
> `https://auvo-producao.s3.amazonaws.com/anexos_tarefas/<uuid>.jpg;https://...jpg`, separados por
> `;`), não o texto da inconformidade.

## Contexto de código
- `domain/inspecao-excel.ts` `parsearPlanilhaLevantamento` (E01-S105): detecta colunas por nome de
  cabeçalho normalizado. Bug: `relatoIndex` inclui `"ocorrencia"` como alias
  (`["relato", "descricao", "ocorrencia", "inconformidade"]`), então a coluna "Ocorrência" (foto)
  é lida como texto de relato — a URL vira `descricaoTecnica`/`relatoOriginal`, nunca chega a
  `fotoUrls`. `fotosIndex` (`["foto", "imagem", "anexo"]`) não reconhece "ocorrencia".
- `fotosDoTexto(valor)` já faz o trabalho certo pra extrair múltiplas URLs separadas por
  `;`/`,`/quebra de linha — só nunca é chamado sobre a coluna certa.
- Downstream (sem mudança): `ItemInspecaoCard` (`pages/InspecoesPage.tsx`) já renderiza
  `item.fotoUrl`/`item.fotoUrls` quando preenchidos (E01-S97) — corrigindo o parser, a foto passa a
  aparecer sozinha, sem trabalho de UI adicional.

## Resumo
Troca os aliases de coluna: "ocorrencia" sai do grupo de relato/descrição e entra no grupo de
fotos. Planilhas cuja coluna "Ocorrência" contém link de imagem passam a alimentar `fotoUrls`
corretamente; o relato/descrição continua vindo de "relato"/"descricao"/"inconformidade" (sem
"ocorrencia" competindo pelo mesmo índice).

## Critérios de aceite

### AC-1: Coluna "Ocorrência" vira foto
- **Dado** uma planilha com coluna de cabeçalho contendo "ocorrencia" cujas células são URL(s)
  `http(s)://` separadas por `;`
- **Quando** `parsearPlanilhaLevantamento` processa a planilha
- **Então** essas URLs aparecem em `itensBrutos[].fotoUrls`, não em `relatoOriginal`/`descricaoTecnica`.

### AC-2: Relato continua vindo de coluna de texto
- **Dado** a mesma planilha, com outra coluna de cabeçalho "relato"/"descricao"/"inconformidade"
- **Então** o texto dessa coluna continua indo pra `relatoOriginal`/`descricaoTecnica`, sem mudança.

### AC-3: Sem coluna de relato reconhecível
- **Dado** uma planilha onde a única coluna reconhecida é "ocorrencia" (agora roteada pra foto)
- **Então** o parser lança o erro já existente ("Planilha sem coluna de relato/descrição da
  ocorrência") em vez de usar a URL como texto — falha explícita é melhor que importar lixo.

### AC-4: Item exibe a foto
- **Dado** um item importado com `fotoUrls` preenchido a partir da coluna "Ocorrência"
- **Então** o card do item na tela de Inspeções mostra a foto (miniatura/capa), sem mudança de UI
  necessária (já existia desde E01-S97).

## Fora de escopo
- Mudar o parser de PDF (`extrairTextoPdfOuTexto`) — só afeta o caminho XLS.
- Detectar URL por conteúdo independente do nome da coluna — a correção é só no mapeamento de
  aliases; se aparecer uma variação de nome de coluna ainda não coberta, é ajuste futuro pontual.

## Rastreabilidade
- Código: `domain/inspecao-excel.ts` (`coluna(header, [...])` — `relatoIndex`/`fotosIndex`).
- Reusa: E01-S97 (`fotoUrls` no item), E01-S105 (parser/pipeline de import).
- ADRs relacionados: —
