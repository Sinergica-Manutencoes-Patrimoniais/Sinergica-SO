---
name: spec
description: Contrato — editor de proposta comercial com 4 tipos, composição por itens, cálculo ao vivo com bloqueio abaixo do piso e versionamento por snapshot.
alwaysApply: true
---

# Spec — E03-S04 · Editor de proposta

> **Fonte da verdade.** Status: pronto para implementar · Tier: **pequeno**
> Depende de **E03-S03** (motor de preço) e **E03-S01** (oportunidades).
> 4 tipos de proposta = decisão 3 do PO (`../E03-S01-fundacao-comercial/product.md`).

## Resumo
Cria `comercial.propostas`, `proposta_itens` e `proposta_versoes`, e o editor onde a proposta é
montada: escopo, composição (MO por nível + materiais + veículo), cálculo ao vivo mostrando
custo/preço/piso/desconto, e o ciclo de status. Cada alteração relevante gera **snapshot
append-only** — a proposta enviada nunca muda debaixo do cliente.

## Critérios de aceite

### AC-1: Schema com RLS FORCE
- **Dado** as migrations aplicadas (`propostas`, `proposta_itens`, `proposta_versoes` — contrato
  em `design.md` §2.3)
- **Quando** um usuário sem `comercial` consulta
- **Então** zero linhas; `leitura` lê; `escrita`/superadmin faz CRUD — provado por pgTAP.
  `proposta_versoes` é **append-only**: policies negam UPDATE e DELETE para todos, inclusive
  superadmin (padrão de `financeiro.lancamentos_eventos`, E04-S07)

### AC-2: Criar proposta a partir de uma oportunidade
- **Dado** uma oportunidade aberta
- **Quando** o usuário com `escrita` cria uma proposta escolhendo o tipo
  (`levantamento`/`volante`/`residente`/`simples`)
- **Então** nasce em `rascunho`, vinculada àquela oportunidade, com `versao_atual = 1` e o primeiro
  snapshot em `proposta_versoes`

### AC-3: Composição calcula ao vivo
- **Dado** uma proposta em `rascunho`
- **Quando** o usuário adiciona/edita itens (MO por nível com quantidade de horas, materiais do
  catálogo, veículo)
- **Então** custo total, preço sugerido, **piso** e **desconto máximo** são recalculados na tela a
  cada mudança, usando o domínio da S03 — sem duplicar fórmula aqui

### AC-4: Preço abaixo do piso é bloqueado no banco
- **Dado** uma proposta com piso calculado
- **Quando** alguém tenta salvar `preco_centavos < piso_centavos`
- **Então** a escrita é **rejeitada pelo banco** (check ou trigger), não só pela UI; usuário
  `superadmin` pode forçar, e nesse caso um evento é gravado registrando quem autorizou

### AC-5: Alteração gera nova versão
- **Dado** uma proposta com `versao_atual = N`
- **Quando** o usuário altera composição, escopo ou preço e salva
- **Então** `versao_atual` vira `N+1` e um snapshot completo (`payload jsonb`) é gravado em
  `proposta_versoes` com autor e data; as versões anteriores continuam legíveis

### AC-6: Ciclo de status respeitado
- **Dado** uma proposta em determinado status
- **Quando** o usuário tenta mudar de status
- **Então** só as transições do blueprint são aceitas:
  `rascunho → em_revisao → aprovada → enviada → aceita | recusada | cancelada`;
  transição inválida é recusada com mensagem clara (validado no domínio **e** no banco)

### AC-7: Proposta enviada é imutável
- **Dado** uma proposta com status `enviada`, `aceita`, `recusada` ou `cancelada`
- **Quando** alguém tenta editar composição ou preço
- **Então** a edição é bloqueada; para mudar, é preciso **duplicar** a proposta em nova versão de
  rascunho — a peça que o cliente recebeu nunca muda retroativamente

### AC-8: Tipo determina a composição oferecida
- **Dado** o tipo escolhido
- **Quando** o editor abre
- **Então**: `volante` pede técnicos × frequência; `residente` pede nível + cobertura;
  `levantamento` referencia um Assessment (`assessment_id`, preenchido na S05 — aqui só o campo);
  `simples` é formulário livre. Todos convergem para os mesmos itens e o mesmo motor de preço

### AC-9: Validade da proposta
- **Dado** uma proposta com `valido_ate` no passado
- **Quando** ela é exibida
- **Então** aparece marcada como **expirada** e não pode ser aceita — sem job de expiração, a
  regra é avaliada na leitura

## Casos de borda e erros
- **Proposta sem nenhum item** → pode ficar em `rascunho`, mas não avança para `em_revisao`.
- **Material desativado depois de entrar na proposta** → o item permanece com o custo que foi
  congelado no snapshot; a proposta não muda sozinha.
- **Parâmetros de preço alterados depois da proposta enviada** → proposta enviada não recalcula
  (AC-7); rascunho recalcula.
- **Desconto exatamente igual ao máximo** → permitido (`preco = piso`).
- **Duas propostas abertas na mesma oportunidade** → permitido; a oportunidade mostra todas.
- **Alíquota mudou entre rascunho e envio** → o snapshot guarda a alíquota usada, para auditoria.

## Fora de escopo
- **PDF e envio ao cliente** — é a S06.
- **Levantamento em campo** — é a S05 (aqui só o campo `assessment_id`).
- **Geração de conteúdo por LLM** — o blueprint prevê rascunho por IA; **não entra no V1**,
  vira story própria se fizer falta.
- **Contrato** — é a S07.
- **DOCX** (non-goal do épico).

## Rastreabilidade
- Épico: `../E03-S01-fundacao-comercial/product.md` (decisões 3, 4, 8) · `design.md` §2.3
- Motor de preço: `../E03-S03-precificacao-catalogo/spec.md`
