---
name: adr-0019-propriedade-de-dados-r1-r2-r3
description: ADR — regras de propriedade de dados entre bounded contexts (R1 autoridade de escrita, R2 leitura por view/RPC, R3 enriquecimento no schema de quem enriquece) e pcm.clientes como Shared Kernel.
alwaysApply: false
---

# ADR-0019 — Propriedade de dados entre contextos (R1/R2/R3)

## Status
Aceita — 2026-08-10. Decidida com o PO (Lucas) ao abrir o épico E03 (Comercial).

## Contexto

O Sinérgica SO tem 132 tabelas em 8 schemas povoados. Ao abrir o épico Comercial, a pergunta
"quem detém o dado, quem consome e o que é tabela de enriquecimento" não tinha resposta escrita —
e a auditoria do schema real mostrou que a fronteira já estava furada em quatro pontos:

1. `pcm.clientes.tipo ∈ (cliente,lead)` e `status_comercial ∈ (ativo,inativo,prospecto)`
   (migration `0022_E01-S12`) — conceito de funil comercial morando na tabela da operação,
   criado antes de existir módulo Comercial.
2. Duas tabelas medem **satisfação do cliente com uma OS**: `pcm.satisfacao_respostas` (pesquisa
   vinda do Auvo, E01-S55) e `pcm.portal_satisfacao` (CSAT/NPS respondido no portal, E09). Fontes
   diferentes, mesmo conceito — o dashboard de qualidade reporta número diferente conforme a tela.
3. `comercial.leads` é escrita exclusivamente pelo agente do Atendimento (E02-S09). O Comercial
   nunca escreveu nela — o Atendimento é dono de facto de dado no schema alheio.
4. `atendimento.historico_chamado_snapshots` foi criada pelo PCM (E01-S89), dentro do schema do
   Atendimento. *(Reclassificada depois como **não sendo violação** — ver o corolário
   "épico de origem não determina propriedade".)*

Além disso, `ARCHITECTURE.md` descrevia um conjunto de tabelas que **não existe** (`pcm.visitas`,
`pcm.backlog_items`, `financeiro.faturas`, `comercial.proposals`…), então não servia de guia.

Sem regra explícita, cada épico decide sozinho onde põe a tabela, e a fronteira apodrece por
acúmulo — não por uma decisão ruim isolada.

## Decisão

### R1 — Dono é quem tem autoridade de escrita do ciclo de vida
Dono de uma entidade é o contexto que a **cria** e que **muda o estado** dela. Não é quem lê mais,
nem quem escreveu a migration, nem em qual schema a tabela caiu por conveniência.

Se dois contextos escrevem o mesmo estado, a fronteira está errada — não é caso de "compartilhar".

### R2 — Consumidor lê por view ou RPC publicada pelo dono
Nenhum contexto faz `select` direto em tabela de outro schema. O dono publica a interface (view ou
RPC `security definer` com guarda de permissão); o consumidor usa só ela.

FK cross-schema continua permitida para **referenciar** (guardar a chave e garantir integridade),
nunca para ler atributos.

Aplicação: **vale para consumidor novo**. Os consumidores existentes que leem direto (ex.: RPCs de
rentabilidade do Financeiro sobre `pcm.ordens_servico`/`pcm.despesas`, E04-S06) migram quando a
área for tocada — não há campanha de migração só por conformidade.

### R3 — Enriquecimento mora no schema de quem enriquece
Contexto que precisa de atributo novo sobre entidade de outro contexto **cria tabela própria com
FK** para a entidade do dono. Nunca adiciona coluna na tabela alheia.

Exemplo canônico: o funil comercial sobre uma Conta é `comercial.oportunidades (cliente_id)` —
não `pcm.clientes.status_comercial`.

### Corolário de R1 — canal de escrita não é propriedade
Um contexto pode **escrever** numa tabela de outro dono sem virar dono dela, quando é apenas um
**canal** de entrada para uma entidade cujo ciclo de vida pertence a terceiro.

Caso concreto: a Área do Cliente (E09) escreve `pcm.chamados_interacoes`, `pcm.os_notas`,
`pcm.portal_satisfacao` e as tabelas do Fluxo B. Essas tabelas descrevem **entidades do PCM**
(Chamado, OS) e têm `autor_tipo ∈ ('cliente','interno')` — o portal é um dos dois canais, o PCM
governa o ciclo de vida. **O schema está certo**; a análise inicial que classificou isso como
violação foi descartada (ver `specs/E03-S01-fundacao-comercial/design.md` §5.1).

O teste é sempre R1: *quem decide que a entidade nasce, muda de estado e morre?* Escrever um
atributo por um canal não responde essa pergunta.

### Corolário de R1 — épico de origem não determina propriedade
A story que criou a tabela pode pertencer a um épico e o dado pertencer a outro contexto. **O dono
é quem produz o dado**, não quem escreveu a migration.

Caso concreto: `atendimento.historico_chamado_snapshots` foi criada pela **E01-S89** (épico do PCM)
e por isso a auditoria a classificou como violação. Ao ler a migration de origem, ela já declarava
e justificava a escolha — *"tabela vive no schema de quem PRODUZ o dado (atendimento), com FK direta
pro schema pcm"*. O snapshot **é conversa de WhatsApp**: dado do Atendimento anexado a um Chamado.
Pelo R1 o Atendimento é dono e o schema estava certo desde o início. **Classificação revogada**
(E03-S13).

Este caso e o do portal (corolário anterior) são o mesmo aprendizado: a regra vale para reduzir
trabalho tanto quanto para gerar. Duas das quatro "violações" da auditoria inicial não
sobreviveram à leitura do código que as originou.

### `pcm.clientes` é Shared Kernel, não propriedade do PCM
A tabela recebe **35 FKs de 4 contextos** (PCM, Financeiro, Atendimento, Portal) e é referenciada
pelo sync do Auvo. Ela representa a **Conta** (a organização/condomínio), não um conceito
exclusivo da operação.

- Permanece **fisicamente em `pcm`** — mover uma tabela com 35 FKs em produção é risco
  desproporcional ao ganho de pureza.
- É declarada **Shared Kernel**: mudança de coluna é decisão cross-módulo, não do PCM sozinho.
- Ganha a view `relacionamento.contas` como **interface pública de leitura** (o contrato do R2).
  Consumidor novo lê a view; o PCM continua usando a tabela.

## Alternativas consideradas

- **Mover `pcm.clientes` para `relacionamento.contas` de fato.** Desenho mais limpo — a Conta é
  transversal como o Contato. Rejeitada pelo custo: 35 FKs, RLS, RPCs, sync Auvo, portal e todo o
  código do PCM apontando para o nome antigo, numa tabela crítica com dado de produção.
- **Manter `pcm.clientes` como propriedade exclusiva do PCM.** Mais simples, nada muda. Rejeitada
  porque mantém o Comercial dependendo de uma tabela cujo dono tem prioridades próprias, e não
  resolve a pergunta que originou este ADR.
- **Só documentar quem lê o quê, sem regra normativa.** Rejeitada: descreve o presente sem impedir
  a próxima violação.

## Consequências

**Positivas**
- Pergunta "onde ponho esta tabela?" passa a ter resposta mecânica (R1 → R3).
- O épico E03 nasce sem repetir o passivo, e E05..E08 herdam a regra.
- `ARCHITECTURE.md` passa a ter o mapa real (132 tabelas por dono e classe), derivado do schema.

**Negativas / custo aceito**
- O passivo acima **será corrigido junto do E03** (decisão do PO), o que aumenta o épico e mexe em
  coisa que hoje funciona em produção. Cada correção vira story com migration reversível própria,
  nunca um big-bang.
- O corolário "canal ≠ propriedade" abre espaço para abuso: qualquer escrita cross-schema pode ser
  justificada como "sou só um canal". Mitigação: o canal **nunca** cria a entidade nem muda o
  estado dela — se fizer isso, é dono e a fronteira está errada.
- R2 cria uma camada de view/RPC a manter. Mitigado por só valer para consumidor novo.

**Neutras**
- Nenhuma tabela é movida por este ADR. Ele define regra e classificação; as migrations vêm nas
  stories do E03.

## Ver também
- [ADR-0007 — Base única de contatos e relacionamento](0007-base-unica-contatos-relacionamento.md)
- [ADR-0020 — Conta única: identidade no PCM, funil no Comercial](0020-conta-unica-funil-no-comercial.md)
- `docs/ARCHITECTURE.md` § "Propriedade de dados" e § "Dados — schemas Postgres (mapa real)"
