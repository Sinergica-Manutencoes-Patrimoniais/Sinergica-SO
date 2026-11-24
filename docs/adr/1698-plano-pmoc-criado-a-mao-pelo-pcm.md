---
name: "docs-adr-1698-plano-pmoc-criado-a-mao-pelo-pcm-md"
description: "Documento Sinérgica SO: ADR-1698 — o Plano de um Contrato PMOC existente é criado à mão pelo PCM, caso a caso (resposta (b) à pergunta aberta da ADR-1697 §3) (E01-S203)"
alwaysApply: false
---

# ADR-1698 — Plano PMOC criado à mão pelo PCM (E01-S203)

**Status:** aceita · **Data:** 2026-11-24 · **Story:** E01-S203 · **Tier:** arquitetural
**Motivo do tier:** schema novo com dado de produção adjacente (~4 mil OS, contratos PMOC vivos) e
decisão de modelo irreversível na prática (quem cria Plano cria registro).

**Esta ADR não edita a ADR-1697: ela a responde.** A convenção do projeto é nunca editar uma ADR
existente; esta é a outra ADR que a sucede no ponto que ficou aberto.

## Contexto

A ADR-1697 (E01-S190) classificou Assessment como Inspeção e deu ao Plano de Manutenção a
modalidade `pmoc` (migration `1869`, view `pcm.planos_pmoc`). Ao fazer isso, ela registrou um
achado que recortou o escopo e deixou uma pergunta textual na §3:

> Para um Contrato PMOC que já existe hoje — com imóvel, ART, inventário de equipamentos de AR e
> cronograma de 12 visitas emitido —, o Plano de Manutenção correspondente deve ser **(a)** criado
> por uma migração de conteúdo, **(b)** criado pelo PCM manualmente, caso a caso, ou **(c)** não
> criado, ficando o Contrato PMOC como a execução legal e o Plano como o escopo contratual?

O achado por trás da pergunta continua válido e foi reconferido antes de escrever SQL:
`pcm.pmoc_properties/equipment/contracts/schedules/records` (`0023_E01-S03`) se ancoram em
`pmoc_properties.client_id` e **não têm uma única FK** para `pcm.planos_manutencao` (`0260`). As
únicas pontes existentes são `pcm.rotina_origem_geracao.origem = 'pmoc'` (`0337`) e
`pcm.sso_vinculos_ciclo_pmoc` (`1631`).

**O cliente respondeu em 24/11: (b) — criado à mão pelo PCM.**

## Decisão

### 1. O Plano PMOC de um Contrato existente nasce de um clique do PCM, nunca de migration

A migration `1871` instala a máquina (vínculo, RPC de criação, indicador de progresso) e **não
cria um único Plano**. A alternativa (a) — migração de conteúdo — fica explicitamente recusada:
não existe função total de `pmoc_contracts` para `planos_manutencao` (um tem imóvel, ART, CREA,
responsável técnico e 12 visitas; o outro tem cliente, versões aprovadas e rotinas com alvo em
sistemas/equipamentos/grupos), e inventá-la seria criar registro travestido de classificação.

A criação é humana por construção, com três travas e não só com uma recomendação:
`auth.uid()` obrigatório e igual ao ator; `p_confirma_criacao` obrigatoriamente `true`
(`criacao_nao_confirmada`); e `execute` **revogado de `service_role`**, que é o papel de todo job
e Edge Function deste repo. Um pgTAP prova as três.

### 2. Vínculo próprio e mínimo — `pcm.sso_vinculos_plano_contrato_pmoc`

Avaliar primeiro o reuso de `pcm.sso_vinculos_ciclo_pmoc` (`1631`) era obrigatório, e o resultado
foi **não serve**, por quatro razões de modelo:

1. ela **exige que o Plano já exista** (FKs para `planos_manutencao` e para uma `plano_versoes`
   em estado `aprovado`) — e o problema desta story é que o Plano ainda não existe;
2. exige `proposta_id` (`sso_propostas_mapeamento_pmoc`) e `decisao_id` com decisão
   `validada_pcm`: maquinário de mapeamento de ciclo, sem o que mapear antes de haver rotina;
3. sua cardinalidade é **uma linha por ciclo/visita** — ela não pode, nem deve, impedir dois
   Planos para o mesmo Contrato;
4. `contrato_pmoc_id` é lá um dado derivado do agendamento, não a chave do vínculo.

O vínculo novo tem o mínimo: `contrato_pmoc_id` **único**, `plano_id` **único**, cliente, imóvel,
`request_id`, ator e a fotografia (`derivado`) do que foi herdado. É append-only (mesmo gatilho de
`0327` que `1631` usa), tem RLS FORCE e é lido pela mesma capacidade `plano.gerir`. Ele **não
substitui** o vínculo de ciclo: quando o Plano criado aqui ganhar rotinas, `1631` continua sendo o
caminho para amarrar cada vencimento a cada visita do cronograma PMOC.

### 3. PMOC e Plano continuam entidades distintas

Resposta 27 do Pacote Consolidado: a unificação é de menu e jornada, não de modelo. Criar o Plano
**não altera, não move e não encerra** o Contrato PMOC — ele continua sendo a execução legal, com
ART, laudo e cronograma. O pgTAP mede isso contando `pmoc_contracts` e `pmoc_schedules` antes e
depois.

### 4. PMOC continua no menu, e o indicador é o que permitirá um dia tirá-lo

`pcm.sso_listar_contratos_pmoc_sem_plano` e `pcm.sso_resumir_cobertura_plano_pmoc` respondem
"quantos Contratos PMOC ainda não têm Plano?", por Cliente. Sem esse número a conversão manual
seria trabalho sem fim visível. `VIEWS_CONSOLIDADAS` continua contendo apenas `assessment`; o
teste de E01-S190 que trava isso permanece verde.

O resumo inclui, à parte, a contagem **global** de Contratos PMOC cujo imóvel não tem Cliente
nenhum. Eles não aparecem em recorte algum por Cliente; sem esse número, "faltam zero contratos"
seria uma conta que nunca fecharia e a retirada do menu seria declarada cedo demais.

### 5. Reuso em vez de superfície nova

Nenhum gate, nenhuma capacidade e nenhum livro de idempotência novos:
`pcm.sso_conferir_pmoc_mediado(ator, cliente, false)` (`1630`) para gate + `plano.gerir`;
`pcm.plano_comandos` (`0260`) para a idempotência por `request_id`;
`pcm.sso_proteger_conferencia_levantamento()` (`0327`) para o append-only.

## Consequências

- Positiva: a decisão (b) fica executável hoje, com progresso medível, sem nenhuma criação de
  registro automática e sem fusão de entidade.
- Positiva: dois Planos para o mesmo Contrato passam a ser impossíveis, com erro nomeado
  (`contrato_pmoc_ja_tem_plano`) em vez de duplicata silenciosa.
- Negativa/aceita: o Plano criado nasce **vazio de rotinas** (rascunho, revisão 1). Montar a Rotina
  por equipamento × tipo de visita continua sendo trabalho do PCM, pelo fluxo de Plano que já
  existe — fazer isso automaticamente seria a alternativa (a) pela porta dos fundos.
- Negativa/aceita: enquanto a conversão não terminar, um Cliente pode ter Contrato PMOC e Plano
  PMOC convivendo. É exatamente o estado intermediário que a decisão (b) escolheu.
- Negativa/aceita: Contratos PMOC em imóvel sem Cliente ficam fora da conversão até alguém
  corrigir o cadastro no módulo PMOC. O erro é próprio (`contrato_pmoc_sem_cliente`) e a contagem
  aparece na tela, em vez de o contrato sumir em silêncio.

## Referências

`supabase/migrations/1871_E01-S203_plano_pmoc_do_contrato.sql` ·
`supabase/tests/E01-S203_plano_pmoc_manual.test.sql` ·
`specs/E01-S203-plano-pmoc-manual/` ·
ADR-1697 §3 (a pergunta) · ADR-1488 (vínculo de ciclo PMOC) · ADR-0039 (fundação do Plano) ·
`docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md` (respostas 26 e 27).
