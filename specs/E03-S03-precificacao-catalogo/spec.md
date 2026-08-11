---
name: spec
description: Contrato — motor de precificação (custo → preço → piso → desconto máximo), parâmetros, níveis de técnico e catálogo de materiais.
alwaysApply: true
---

# Spec — E03-S03 · Precificação + catálogo de materiais

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> **Story-ilha:** tabelas próprias, domínio puro, não toca `comercial.oportunidades`.
> **Pode ser implementada em paralelo com a E03-S01**, em outra sessão, sem conflito.
> Fórmula e origem de cada entrada: `../E03-S01-fundacao-comercial/design.md` §3.

## Resumo
Cria o motor de precificação da Sinérgica: parâmetros de margem/overhead/veículo, tabela de níveis
de técnico, catálogo de materiais com markup, e o **domínio puro** que calcula
`custo → preço → piso → desconto máximo`. A alíquota de imposto e o custo de mão de obra são
**lidos do Financeiro**, nunca duplicados aqui.

## Critérios de aceite

### AC-1: Schema com RLS FORCE
- **Dado** as migrations aplicadas (`comercial.parametros_preco` singleton, `niveis_tecnico`,
  `materiais`)
- **Quando** um usuário sem `comercial` consulta qualquer uma
- **Então** zero linhas; `leitura` lê; `escrita`/superadmin faz CRUD — provado por pgTAP.
  `parametros_preco` aceita **exatamente uma linha** (`check (id = 1)`, padrão de
  `financeiro.config_impostos`)

### AC-2: Fórmula de preço
- **Dado** custo total C, margem M e alíquota A
- **Quando** o domínio calcula
- **Então** `Preço = C × (1 + M) ÷ (1 − A)`, `Piso = C ÷ (1 − A)` e
  `DescontoMáximo = 1 − (Piso ÷ Preço)` — funções puras em
  `features/comercial/domain/precificacao.ts`, com unit tests

### AC-3: Custo de mão de obra vem do Financeiro
- **Dado** níveis de técnico cadastrados e `financeiro.custos_funcionario` populada
- **Quando** o motor calcula o custo de MO de um nível
- **Então** usa a **média** do custo/hora dos funcionários daquele nível, lida por RPC do
  Financeiro (nunca `select` direto — R2 do ADR-0019)

### AC-4: Sem custo cadastrado, degrada com aviso honesto
- **Dado** `financeiro.custos_funcionario` **vazia** ou sem funcionário no nível
- **Quando** o motor calcula
- **Então** usa `niveis_tecnico.custo_mensal_referencia_centavos` como fallback e a tela exibe
  aviso de que o custo é estimado, **nunca erro nem número inventado**
  (mesmo padrão de `pcm.despesas` na E04-S06)

### AC-5: Alíquota é lida do Financeiro e mostrada na tela
- **Dado** `financeiro.config_impostos` configurada (fixa ou faixas de RBT12)
- **Quando** o motor calcula
- **Então** usa a alíquota efetiva vinda do Financeiro por RPC, e a tela **mostra qual alíquota foi
  aplicada e de onde veio**. Nenhuma alíquota é constante no código do Comercial

### AC-6: Aviso de imposto não confirmado
- **Dado** `financeiro.config_impostos` ainda com as faixas do seed original da E04-S10 (nunca
  editadas)
- **Quando** a tela de precificação carrega
- **Então** exibe aviso de que as faixas são sugestão e precisam de confirmação do contador —
  informativo, nunca bloqueante

### AC-7: Divisão por zero é impossível
- **Dado** uma alíquota configurada como 1 (100%) ou maior
- **Quando** o motor calcula
- **Então** retorna erro de domínio explícito ("alíquota inválida"), nunca `Infinity` ou `NaN`

### AC-8: Catálogo de materiais com markup
- **Dado** um usuário com `comercial='escrita'`
- **Quando** cadastra material (nome, unidade, custo de referência, markup)
- **Então** o material fica disponível para composição de proposta, com preço de venda derivado
  (`custo × (1 + markup)`); markup em branco herda
  `parametros_preco.markup_material_padrao_pct`

### AC-9: Premissa do INSS patronal é explícita
- **Dado** `parametros_preco.mo_inclui_inss_patronal`
- **Quando** o usuário abre a tela de parâmetros
- **Então** o campo é apresentado com explicação de que no **Anexo IV** o CPP fica fora do DAS e no
  **Anexo III** está dentro — declarando o que o custo cadastrado no Financeiro representa, para o
  encargo não ser contado duas vezes

## Matriz de decisão — origem do custo de MO

| `custos_funcionario` do nível | Resultado | Aviso na tela | AC |
|---|---|---|---|
| ≥ 1 funcionário com custo vigente | média dos custos/hora | nenhum | AC-3 |
| nenhum funcionário no nível | `custo_mensal_referencia_centavos` do nível | "custo estimado" | AC-4 |
| tabela vazia em produção | referência do nível | "custo estimado" | AC-4 |

## Casos de borda e erros
- **Margem 0** → preço = piso; desconto máximo = 0. Válido, não é erro.
- **Margem negativa** → recusada no domínio.
- **Alíquota 0** → válido (empresa fora do Simples); preço = `C × (1 + M)`.
- **Material com custo 0** → permitido (item de escopo sem custo), preço 0.
- **Nível desativado com material/proposta em uso** → desativar, nunca excluir.
- **Arredondamento** → tudo em centavos inteiros; arredondar só na exibição, nunca acumular float.

## Fora de escopo
- **Editor de proposta** — é a S04. Aqui só o motor e os cadastros.
- **Tabela fixa de preço por (técnicos × visitas)** — o blueprint previa; a decisão 4 do PO manda
  usar fórmula.
- **Alterar `financeiro.config_impostos`** — o Comercial só lê.
- **Comissionamento.**

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisões 4, 5, 12) · `design.md` §3 e §3.1
- Reuso: `financeiro.custos_funcionario` (E04-S06), `financeiro.config_impostos` (E04-S10)
