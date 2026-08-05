---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Ferramenta: cadastro item-cêntrico (cada item é um registro)

> **Fonte da verdade.** Origem: Lucas (2026-08-04, item 2). "Como precisamos trackear cada item,
> adicionar vários itens no mesmo cadastro não tem sentido — cada chave de fenda tem o seu cadastro."
> Decisão travada: **cadastro item-cêntrico reusando o rastreio de unidades que já existe; sem
> migração destrutiva.**

## Contexto de código
- Hoje o modelo é 2 camadas: `FerramentaItem` (**tipo**, com `quantidadeTotal`/`quantidadeMinima`)
  + `FerramentaUnidadeItem` (`ferramenta_unidades`, E01-S63: cada **unidade física** já tem `codigo`,
  status disponível/atribuída/baixada, atribuição a técnico, baixa, reserva — E01-S64).
- O rastreio por item **já existe** (unidades). O incômodo é o **cadastro**: pede `quantidadeTotal`
  (`FerramentaFormData`, `validarFerramenta`), tratando a ferramenta como estoque agregado, não como
  itens individuais. `FerramentasPage.tsx` reflete isso.
- Alocação a técnico/cliente (E01-S106/S113) e reserva (E01-S64) dependem de unidades — **preservar**.

## Resumo
O cadastro passa a ser **por item físico**: cada ferramenta cadastrada é uma unidade rastreável, com
seu próprio código/identificação. O antigo "tipo + quantidade" deixa de ser digitado — o
agrupamento por tipo/categoria vira opcional (categoria já existe). Reusa a tabela de unidades; nada
de migração destrutiva (dados atuais continuam válidos).

## Critérios de aceite

### AC-1: Cadastrar um item físico por vez
- **Dado** a tela de Ferramentas (com escrita)
- **Quando** o operador cadastra uma ferramenta
- **Então** cria **um item físico** (uma unidade) com identificação própria (código/patrimônio),
  sem campo de "quantidade" — cada chave de fenda é um registro.

### AC-2: Rastreio individual preservado
- **Dado** um item cadastrado
- **Quando** o operador o atribui/devolve/baixa/reserva
- **Então** funciona por item (reusa `ferramenta_unidades`), status individual — nada de contagem agregada.

### AC-3: Agrupamento por tipo/categoria opcional
- **Dado** vários itens do mesmo tipo (ex.: 5 chaves de fenda Phillips)
- **Quando** listados
- **Então** dá pra agrupar/filtrar por categoria/tipo, mas cada um é um registro distinto (a
  "quantidade" vira a **contagem** de itens ativos, nunca um número digitado).

### AC-4: Dados existentes continuam válidos
- **Dado** ferramentas cadastradas no modelo antigo (tipo + quantidade + unidades)
- **Quando** a nova UI carrega
- **Então** os itens/unidades existentes aparecem corretamente, sem perda; a quantidade agregada
  antiga é derivada da contagem de unidades (não editável como número solto).

## Casos de borda e erros
- Código duplicado: bloquear/avisar (código de item deve ser único por escopo).
- Alocação a cliente/técnico e reserva (E01-S106/S113/S64) continuam funcionando sobre o item.
- Sync Auvo de ferramenta (`employeesStock`, agregado por técnico — E01-S63 AC-7): a divergência
  segue comparando contagem PCM (agora nº de itens) vs Auvo, só alerta de leitura.

## Fora de escopo
- Migração destrutiva/colapso das tabelas (decisão explícita: reusar unidades, não achatar).
- Importar em lote muitos itens de uma vez (cadastro é 1 a 1; import em massa é outra story se pedido).
- Kits (E01-S66) — se existirem, continuam como agrupamento, fora deste escopo.

## Rastreabilidade
- Código: `pages/FerramentasPage.tsx` (form item-cêntrico), `domain/ferramentas.ts` /
  `domain/ferramenta-unidades.ts`, `application/*ferramenta*`, `infrastructure/supabase-ferramentas-adapter.ts`
  / `supabase-ferramenta-unidades-adapter.ts`. Migration só se precisar tornar `codigo` obrigatório/único
  ou marcar `quantidadeTotal` como derivado (aditivo, sem destruir dado).
- Estende/preserva: E01-S30/S63/S64/S65/S66/S106/S113 (ferramentas/unidades/reserva/alocação).
- ADRs relacionados: —
