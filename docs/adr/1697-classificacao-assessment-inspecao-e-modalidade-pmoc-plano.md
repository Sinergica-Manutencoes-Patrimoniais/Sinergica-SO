---
name: "docs-adr-1697-classificacao-assessment-inspecao-e-modalidade-pmoc-plano-md"
description: "Documento Sinérgica SO: ADR-1697 — Assessment classificado como Inspeção 'Diagnóstico Inicial do Cliente' e PMOC como modalidade do Plano de Manutenção (E01-S190)"
alwaysApply: false
---

# ADR-1697 — Assessment vira tipo de Inspeção e PMOC vira modalidade do Plano (E01-S190)

**Status:** aceita · **Data:** 2026-11-24 · **Story:** E01-S190 · **Tier:** arquitetural
**Motivo do tier:** classificação de dado em produção (~4 mil OS, 1.840 migrations aplicadas).

## Contexto

Pacote Consolidado de 13/11/2026 e resposta 26 do Fabrício (17/11):

> "Assessment **não existirá** como módulo independente. Diagnóstico inicial será uma Inspeção do
> tipo Inicial ou Implantação. PMOC será uma **modalidade do Plano de Manutenção** com requisitos
> legais e documentais próprios."
>
> Assessment vira Inspeção do tipo **"Diagnóstico Inicial do Cliente"**, também aplicável à
> implantação inicial. PMOC vira modalidade do Plano, podendo ter **visão filtrada**, mas **não**
> módulo nem cadastro independentes.

Resposta 27 impõe a restrição dura que acompanha a decisão: a unificação é **de menu e jornada,
não de modelo**. Nada de tabela genérica, nada de fusão de entidades.

### Inventário real do que existe hoje (levantado antes de escrever SQL)

**Assessment — já é uma Inspeção.** Não existe tabela `assessment`. O que existe:

| Objeto | Onde nasceu | O que é |
|---|---|---|
| `pcm.inspecoes.e_assessment boolean not null default false` | `0137_E01-S90` | marcador do assessment |
| `pcm.inspecoes.motivo_assessment text` (`inicio`/`alteracao_contrato`/`anual`) | `0137_E01-S90` | motivo |
| `pcm.inspecoes.tipo_inspecao_id uuid` → `pcm.tipos_inspecao(id)` (FK `not valid`, validada em `0092`) | `0091_E01-S73` | **o campo de tipo que já existia e estava vazio nos assessments** |
| `pcm.tipos_inspecao` (`id`, `nome`, `norma_tecnica`, `descricao`, `ativo`, soft delete) | `0091_E01-S73` | catálogo de tipos |
| `pcm.inspecao_itens` (+ `destino`, `destino_responsavel`, `auvo_questao_chave`, `midias`) | `0019`, `0137`, `0174`, `0179` | itens e evidências |
| `pcm.chamados.origem_inspecao_item_id` | `0137`/`0138` | rastro item → Chamado |
| `comercial.propostas.assessment_id` → `pcm.inspecoes(id)` + triggers `s181_*` | `0958`, `1162`–`1166` | vínculo pré-venda |
| `pcm.inspecoes.auvo_task_id` / questionário | `0165`, `0170` | origem Auvo |

**Consequência decisiva:** classificar Assessment como Inspeção **não move um único registro**. O
assessment já É uma linha de `pcm.inspecoes`; o que falta é preencher `tipo_inspecao_id`, que hoje
é nulo. É literalmente a operação mais aditiva possível.

**PMOC — NÃO é um Plano de Manutenção.** O que existe:

| Objeto | Onde nasceu | O que é |
|---|---|---|
| `pcm.pmoc_properties`, `pmoc_equipment`, `pmoc_contracts`, `pmoc_schedules`, `pmoc_records`, `pmoc_microbio_analysis`, `pmoc_nonconformity_log` | `0023_E01-S03` | cadastro e execução PMOC, **ancorados em `pmoc_properties.client_id`**, sem nenhuma FK para `pcm.planos_manutencao` |
| `pcm.planos_manutencao` (`id`, `cliente_id`, `nome`, `estado`, `revisao`) | `0260_E01-S165` | o Plano |
| `pcm.plano_versoes`, `pcm.rotinas_manutencao` (`plano_id`, `rotina_logica_id`, alvo) | `0261_E01-S165` | versões e rotinas |
| `pcm.rotina_origem_geracao` (`rotina_logica_id`, `alvo_tipo`, `alvo_id`, `origem in ('plano','pmoc')`) | `0337_E01-S166` | **declaração explícita, feita pelo PCM, de que um ciclo é de origem PMOC** |
| `pcm.sso_vinculos_ciclo_pmoc` (`plano_id`, `contrato_pmoc_id`, `agendamento_id`…) | `1631_E01-S166` | ponte Plano ↔ PMOC, atrás de gate fechado |

Não há, nem nunca houve, correspondência 1:1 entre `pcm.pmoc_contracts` e `pcm.planos_manutencao`.

## Decisão

### 1. Assessment → Inspeção do tipo "Diagnóstico Inicial do Cliente" (migration `1868`)

- `pcm.tipos_inspecao` ganha `chave text` com índice único parcial. Sem chave estável o catálogo
  só é endereçável por UUID gerado ou por `nome` (texto livre, editável pelo supervisor) — nenhum
  dos dois serve para uma migration, um teste ou um filtro de tela referenciarem o mesmo tipo.
- Nasce a linha de catálogo `chave = 'diagnostico_inicial_cliente'`,
  `nome = 'Diagnóstico Inicial do Cliente'`.
- **Backfill aditivo:** `update pcm.inspecoes set tipo_inspecao_id = <novo>` **somente onde
  `e_assessment` é verdadeiro E `tipo_inspecao_id is null`**. Nenhuma linha é criada, apagada ou
  movida; nenhum tipo já escolhido por alguém é sobrescrito; `e_assessment` e `motivo_assessment`
  **continuam existindo e preenchidos** (são o sinônimo histórico, não lixo a remover). Itens,
  mídias, `auvo_questao_chave`, `origem_inspecao_item_id` e `comercial.propostas.assessment_id`
  apontam para o mesmo `id` de antes — a identidade nunca muda, então nada precisa ser religado.
- Linhas com `deleted_at` **também** são classificadas: um assessment soft-deleted que volte não
  pode ressuscitar sem tipo.
- Cada linha classificada gera um `audit.events` com `action =
  'inspecao.classificada_diagnostico_inicial'` e `payload.tipo_anterior = null` — é o que torna o
  reverso exato em vez de aproximado.
- **A classificação vira regra, não mutirão:** trigger `before insert or update of e_assessment,
  tipo_inspecao_id` mantém a equivalência nos dois sentidos — assessment sem tipo recebe o tipo;
  inspeção criada com o tipo recebe `e_assessment = true`. Sem isso o backfill seria verdade por
  um dia e mentira no dia seguinte, e tirar Assessment do menu deixaria registros novos órfãos.
  O trigger **só preenche nulo**; nunca troca um tipo já escolhido nem desmarca `e_assessment`.

### 2. PMOC → modalidade do Plano de Manutenção (migration `1869`), com escopo recortado

- `pcm.planos_manutencao` ganha `modalidade text not null default 'padrao'` com
  `check (modalidade in ('padrao','pmoc'))` adicionado `not valid` e validado no mesmo arquivo.
- **Visão filtrada:** `pcm.planos_pmoc`, view com `security_invoker = true` — a RLS de
  `pcm.planos_manutencao` (`config.sso_autorizar_acao('plano.gerir', cliente_id)`) continua
  decidindo quem lê. View com `security_definer` seria um furo de isolamento por cliente.
- **Classificação aditiva:** vira `modalidade = 'pmoc'` o Plano que **o próprio PCM já declarou
  como PMOC**, por um dos dois caminhos que existem no modelo: uma rotina sua com
  `pcm.rotina_origem_geracao.origem = 'pmoc'`, ou um `pcm.sso_vinculos_ciclo_pmoc` apontando para
  ele. Não se adivinha nada por nome, por cliente nem por semelhança. Cada mudança vai para
  `audit.events` com `payload.modalidade_anterior`.

### 3. O que esta ADR **recusa** fazer, e a pergunta que fica aberta

**Os `pcm.pmoc_contracts` existentes NÃO viram linhas de `pcm.planos_manutencao`.**

Fazer isso não seria classificação, seria **criação de registro**: um `pmoc_contract` tem imóvel
(`pmoc_properties`), ART, CREA, responsável técnico e cronograma de 12 visitas; um
`planos_manutencao` tem cliente, versões aprovadas e rotinas com alvo em
`sistemas`/`equipamentos`/`grupos_quantitativos`. Não existe função total de um para o outro, e
inventá-la violaria o AC-2 da spec ("mantendo rotinas, ocorrências geradas e documentos
emitidos") e a própria restrição da resposta 27 (`pmoc_properties` e `pmoc_equipment` são
entidades distintas de Cliente e Componente — fundi-las seria exatamente a tabela genérica
proibida).

**Pergunta de produto que falta responder, textualmente:**

> Para um Contrato PMOC que já existe hoje — com imóvel, ART, inventário de equipamentos de AR e
> cronograma de 12 visitas emitido —, o Plano de Manutenção correspondente deve ser **(a)** criado
> por uma migração de conteúdo, com uma Rotina por equipamento e por tipo de visita, **(b)**
> criado pelo PCM manualmente, caso a caso, usando o fluxo de Plano que já existe, ou **(c)** não
> criado, ficando o Contrato PMOC como a execução legal e o Plano como o escopo contratual, ligados
> apenas por `pcm.sso_vinculos_ciclo_pmoc`?

Enquanto isso não for respondido, **PMOC permanece no menu**: tirá-lo deixaria os imóveis,
contratos, laudos e análises microbiológicas de produção sem nenhuma porta de entrada, que é a
perda de alcance proibida pelo AC-7.

### 4. Menu (task 9) — só Assessment sai, e atrás de flag

- Árvore nova (`NAVEGACAO_SSO`, já atrás de `VITE_SSO_NAVEGACAO_POR_FUNCAO_ENABLED=false`): a
  entrada `trabalho.assessment` deixa de existir e `trabalho.inspecoes` declara
  `absorveu: ['assessment']`.
- Árvore vigente (`PCM_NAV`): o literal continua verbatim — ele **é** o menu publicado, e mexer
  nele sem flag quebraria a promessa de que com a flag desligada a navegação é a de hoje. A
  remoção acontece por `pcmNavConsolidado()`, aplicada pela `HomePage` quando
  `VITE_SSO_ASSESSMENT_COMO_INSPECAO_ENABLED` estiver ligada (`false` por padrão).
- `ROTAS_LEGADAS.assessment` passa a apontar para `inspecoes`: o favorito antigo cai na lista de
  Inspeções, onde o registro está (o adapter `listarInspecoes` nunca filtrou `e_assessment`, então
  os assessments já aparecem lá).
- A capacidade que só a tela de Assessment tem — **importar o questionário do Auvo** — ganha porta
  de entrada dentro de Inspeções (`onAbrirDiagnosticoInicial`), ligada pela mesma flag. Sem isso a
  remoção do menu seria perda de alcance disfarçada de reorganização.

## Reverso

Declarado no cabeçalho de cada migration e exato, não aproximado:

- `1868`: desfaz a classificação **só das linhas que ela mesma tocou**, lendo
  `audit.events` (`action = 'inspecao.classificada_diagnostico_inicial'`); depois remove o trigger,
  a linha de catálogo e a coluna `chave`. Nenhuma inspeção é apagada em nenhum passo.
- `1869`: devolve `modalidade` ao valor de `audit.events`
  (`action = 'plano.classificado_modalidade_pmoc'`), remove a view e a coluna.
- Front: desligar a flag (ou reverter `navegacao-sso.ts`) restaura o menu anterior — dado puro,
  sem efeito em banco.

## Consequências

- Positiva: Assessment deixa de ser um conceito paralelo **no dado**, não só no menu, e passa a
  ser pesquisável, filtrável e reportável como qualquer Inspeção, com o catálogo de tipos que o
  supervisor já administra.
- Positiva: o Plano passa a saber dizer que é PMOC, com visão filtrada que respeita a RLS.
- Negativa/aceita: PMOC continua no menu e a modalidade nasce quase sempre vazia, porque a
  classificação dos Contratos PMOC existentes depende da decisão de produto acima.
- Negativa/aceita: `e_assessment` e `tipo_inspecao_id` passam a ser duas representações do mesmo
  fato, mantidas coerentes por trigger. É dívida deliberada: apagar `e_assessment` exigiria
  reescrever `supabase-qualidade-adapter`, `supabase-cliente-360-adapter`, `0185_E03-S05` e a
  consulta de assessment vigente da Visão 360 — destrutivo, e esta story é aditiva.

## Referências

`supabase/migrations/1868_E01-S190_diagnostico_inicial_cliente.sql` ·
`supabase/migrations/1869_E01-S190_modalidade_pmoc_plano.sql` ·
`supabase/tests/E01-S190_classificacao_diagnostico_e_pmoc.test.sql` ·
`specs/E01-S190-onda-zero-navegacao/plan.md` (inventário) ·
`docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md` (respostas 26 e 27) ·
ADR-0039 (fundação do Plano) · ADR-1488 (vínculo de ciclo PMOC).
