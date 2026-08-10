---
name: spec
description: Contrato — funil comercial em Kanban com drag-and-drop, etapas configuráveis e motivo de perda obrigatório.
alwaysApply: true
---

# Spec — E03-S02 · Funil (Kanban) + etapas configuráveis

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S01** (schema `comercial`, oportunidades, etapas — já criadas lá).
> Contexto do épico: `../E03-S01-fundacao-comercial/product.md` e `design.md`.

## Resumo
Transforma a lista de oportunidades da S01 num **board Kanban** com colunas por etapa e
drag-and-drop, no mesmo padrão do Kanban de OS (E01-S61/S84). Toda mudança de coluna grava evento;
soltar numa etapa `perdida` abre o seletor de motivo antes de confirmar.

## Critérios de aceite

### AC-1: Board por etapa
- **Dado** etapas ativas e oportunidades em várias delas
- **Quando** o usuário com `comercial='leitura'` abre o Funil
- **Então** vê uma coluna por etapa ativa, na `ordem` configurada, com a cor da etapa, o total de
  oportunidades e a **soma dos valores estimados** no cabeçalho de cada coluna

### AC-2: Card com o essencial
- **Dado** uma oportunidade
- **Quando** aparece no board
- **Então** o card mostra nome da Conta, título, valor estimado, responsável, e — quando houver —
  `score` e `lead_tier`; clicar abre a Visão 360 da Conta na aba Comercial

### AC-3: Arrastar move de etapa
- **Dado** um usuário com `comercial='escrita'`
- **Quando** arrasta um card para outra coluna
- **Então** a etapa é atualizada, nasce a linha em `oportunidade_eventos` (AC-5 da S01) e o board
  reflete sem recarregar a página; com `leitura` o arrastar é desabilitado

### AC-4: Perda exige motivo antes de confirmar
- **Dado** um card sendo arrastado para uma coluna `tipo='perdida'`
- **Quando** o usuário solta
- **Então** abre um seletor de motivo; confirmando, a oportunidade move e grava `motivo_perda_id`
  e `fechada_em`; cancelando, **o card volta para a coluna de origem** e nada é gravado

### AC-5: Falha no servidor devolve o card
- **Dado** um card arrastado para outra coluna
- **Quando** a escrita falha (rede, RLS, trigger)
- **Então** o card **volta visualmente para a origem** e um toast explica o erro — a UI nunca
  mostra um estado que o banco não tem

### AC-6: CRUD de etapas e motivos
- **Dado** um usuário com `comercial='escrita'`
- **Quando** abre a configuração do funil
- **Então** cria/edita/reordena/desativa etapas (nome, ordem, cor, `tipo`) e motivos de perda;
  excluir etapa com oportunidade é bloqueado com mensagem que oferece **desativar**

### AC-7: O funil nunca fica sem etapa aberta
- **Dado** a configuração de etapas
- **Quando** o usuário tenta desativar a última etapa `tipo='aberta'`
- **Então** a ação é recusada com mensagem clara — sem etapa aberta não há onde nascer
  oportunidade nova

## Casos de borda e erros
- **Coluna vazia** → mostra estado vazio, mantém a coluna visível (é destino de arraste).
- **Etapa desativada com oportunidade dentro** → coluna aparece marcada como inativa, aceita tirar
  card mas não receber.
- **Board com muitas oportunidades** → coluna com scroll próprio; a página não rola horizontal
  inteira junto.
- **Dois usuários movendo o mesmo card** → última escrita vence; ao falhar por dado obsoleto,
  recarrega a coluna (AC-5).
- **Reordenar etapas** → a `ordem` é persistida; oportunidades não se movem.

## Fora de escopo
- Ordenação manual de cards **dentro** da coluna (não há campo de ordem por oportunidade).
- Automação por etapa (disparar e-mail/WhatsApp ao mover) — nada disso no V1.
- Previsão ponderada por etapa (`valor × probabilidade`).
- Filtros avançados do board — a Lista de Contas (S01) cobre busca.

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` · `design.md` §2.1
- Padrão de referência: E01-S61 (drag-and-drop de OS), E01-S84 (colunas customizáveis)
