---
name: spec
description: "Plano PMOC criado à mão pelo PCM a partir de um Contrato PMOC existente — executa a resposta (b) do cliente à pergunta aberta da ADR-1697 §3."
alwaysApply: false
---

# E01-S203 — Plano PMOC criado à mão pelo PCM

## Por que esta story existe

A E01-S190 descobriu, antes de escrever SQL, que **PMOC não é um Plano de Manutenção**: as tabelas
`pcm.pmoc_properties/equipment/contracts/schedules/records` (`0023_E01-S03`) se ancoram em
`pmoc_properties.client_id` e **não têm uma única chave estrangeira** para `pcm.planos_manutencao`
(`0260_E01-S165`). As únicas pontes são `pcm.rotina_origem_geracao.origem = 'pmoc'` (`0337`) e
`pcm.sso_vinculos_ciclo_pmoc` (`1631`).

O Pacote Consolidado manda PMOC virar **modalidade do Plano** — o que a migration `1869` fez. Mas
converter os Contratos PMOC existentes em Planos seria **criar registro**, não classificar, e a
resposta 27 do cliente proíbe fundir entidades. A E01-S190 parou e perguntou, registrando a dúvida
na **ADR-1697 §3**:

> Para um Contrato PMOC existente, o Plano correspondente deve ser (a) criado por migração de
> conteúdo, (b) criado manualmente pelo PCM, ou (c) não criado?

**O cliente respondeu em 24/11: (b).** Esta story implementa a resposta (ADR-1698).

## Acceptance Criteria

- **AC-1:** existe uma forma explícita e aditiva de registrar que um Plano (modalidade `pmoc`)
  corresponde a um Contrato PMOC. O reuso de `pcm.sso_vinculos_ciclo_pmoc` é **avaliado e a
  conclusão é registrada** antes de criar qualquer tabela.
- **AC-2:** **dois Planos para o mesmo Contrato PMOC são recusados**, com erro nomeado
  (`contrato_pmoc_ja_tem_plano`) — nunca duplicata silenciosa. A unicidade vale dos dois lados: um
  Plano também não corresponde a dois Contratos.
- **AC-3:** o PCM cria o Plano a partir do Contrato por uma RPC mediada, que **herda o que é
  derivável** — Cliente (do imóvel PMOC), nome (do imóvel), imóvel, ART, vigência, periodicidades
  do cronograma e contagem de equipamentos ativos. O que `pcm.planos_manutencao` não tem coluna
  para guardar fica no vínculo e na auditoria, não em schema inventado.
- **AC-4:** a criação é **idempotente por `request_id`**: repetir o mesmo pedido devolve o mesmo
  recibo e não cria um segundo Plano; o mesmo `request_id` com outro conteúdo é
  `request_id_conflitante`.
- **AC-5:** a criação **nunca acontece sozinha**. Exige ator autenticado, confirmação humana
  explícita (`criacao_nao_confirmada` sem ela) e não é executável por `service_role` nem por
  `anon`. **Nenhuma migration cria Plano em massa** — isso seria a alternativa (a), recusada.
- **AC-6:** autorização por capacidade e gate **já existentes** (`plano.gerir` via
  `pcm.sso_conferir_pmoc_mediado`), com `audit.events` em toda criação. Sem gate novo, sem
  capacidade nova, sem livro de idempotência novo.
- **AC-7:** existe um indicador que responde *"quantos Contratos PMOC ainda não têm Plano?"*, por
  Cliente, incluindo os contratos órfãos (imóvel sem Cliente) contados à parte — sem eles o
  indicador nunca chegaria a zero de verdade.
- **AC-8:** criar o Plano **não altera, não move e não encerra** o Contrato PMOC, e **não gera
  Rotina, ocorrência, OS nem tarefa no Auvo**. O Contrato continua sendo a execução legal.
- **AC-9:** pedir o Contrato de outro Cliente, um contrato soft-deleted ou um contrato de imóvel
  sem Cliente é **negado com erro próprio**, nunca devolvido vazio nem redirecionado.
- **AC-10:** migration **aditiva**: sem `DROP`, sem apagar linha, sem editar migration aplicada,
  com reverso declarado no cabeçalho. RLS FORCE em toda tabela tocada.
- **AC-11:** **PMOC continua no menu.** `VIEWS_CONSOLIDADAS` segue contendo apenas `assessment`;
  o teste de E01-S190 que trava isso permanece verde.

## Alcance no front — obrigatório nesta story

- **AC-F1:** caminho nomeado — dentro de **Planos de Manutenção** (Visão do Cliente), a lista dos
  Contratos PMOC pendentes, com a ação "Criar Plano para este Contrato" e uma confirmação antes de
  criar.
- **AC-F2:** `VITE_SSO_PLANO_PMOC_MANUAL_ENABLED` declarada no registro de flags, em
  `.env.example` e em `netlify.toml`, com valor explícito `false`. `flagLigada()` continua o único
  ponto que lê `import.meta.env.VITE_SSO_*`.
- **AC-F3:** com a flag **desligada** a tela de Planos é exatamente a de antes, acrescida de uma
  frase que diz que o recurso existe e ainda não foi ativado.
- **AC-F4:** **cinco estados, cinco frases diferentes**: desligado · gate fechado · sem permissão ·
  "nenhum Contrato PMOC pendente" · "este Cliente não tem Contrato PMOC". Nenhum `return null`
  silencioso. Cada recusa nomeada da RPC vira português na tela.
- **AC-F5:** dado de servidor só por TanStack Query, com `retry: false` (gate fechado e falta de
  capacidade são erros permanentes) e invalidação das chaves após criar.

## Success Criteria

- **SC-001:** pgTAP prova permitido **e** negado, incluindo gate fechado com erro nomeado.
- **SC-002:** está provado por teste que a migration **não criou Plano nenhum** e que o Contrato
  PMOC permanece intacto depois da criação manual.
- **SC-003:** dois Planos para o mesmo Contrato são recusados; o segundo clique com o mesmo
  `request_id` devolve o mesmo Plano.
- **SC-004:** o indicador anda no mesmo clique: 2 pendentes antes, 1 depois.

## Fora de escopo

- **Migração de conteúdo** (alternativa (a)): criar Rotina por equipamento × tipo de visita, migrar
  cronograma PMOC para ciclos do Plano, mover laudos ou ARTs. Recusado pela decisão (b).
- **Tirar PMOC do menu.** Enquanto houver Contrato sem Plano, isso é perda de alcance (AC-7 de
  E01-S190). A retirada é outra story, com o indicador desta em zero.
- Criar automaticamente o vínculo de ciclo de `1631` para o Plano novo — ele exige versão aprovada
  e rotina, que o Plano recém-criado ainda não tem. Próxima fatia.
- Corrigir Contratos PMOC cujo imóvel não tem Cliente: aqui eles são **contados e explicados**, não
  consertados. Correção de cadastro é trabalho do módulo PMOC.
- Desfazer uma conversão (vínculo é append-only) e conversão em lote.
