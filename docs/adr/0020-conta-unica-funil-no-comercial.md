---
name: adr-0020-conta-unica-funil-no-comercial
description: ADR — a Conta (lead, prospecto, cliente ativo, cliente antigo) é uma linha única em pcm.clientes; o funil comercial vive em comercial.oportunidades. Revoga entidade_tipo 'comercial_lead' do ADR-0007.
alwaysApply: false
---

# ADR-0020 — Conta única: identidade no PCM, funil no Comercial

## Status
Aceita — 2026-08-10. Decidida com o PO (Lucas) ao abrir o épico E03.
**Substitui parcialmente** o [ADR-0007](0007-base-unica-contatos-relacionamento.md) no ponto em que
ele previa `comercial.leads` como entidade paralela a `pcm.clientes`.

## Contexto

Hoje existem **dois lugares para "lead"**, sem reconciliação entre eles:

| Onde | O que tem | Quem escreve | UI |
|------|-----------|--------------|-----|
| `pcm.clientes` com `tipo='lead'` | cadastro completo: nome, CNPJ, endereço, contatos, grupos, `detalhes jsonb`, marcação | cadastro manual / import Auvo | sim — filtro "Leads" na Lista de Clientes, badge, Visão 360 |
| `comercial.leads` | `score` 0-100, `resumo`, `conversa_id`, `origem_ref`, `contato_id` | agente comercial do Atendimento (E02-S09, em produção) | nenhuma |

Um lead que chega pelo WhatsApp cai em `comercial.leads`; um lead cadastrado à mão cai em
`pcm.clientes`. Mesma entidade de negócio, dois donos, zero reconciliação.

O PO descreveu a intenção assim: *"a base de clientes é a mesma; o que difere é que no PCM
exibimos os clientes ativos, e no CRM tem os ativos — para ter visão 360 dele também — e a mesma
visão para clientes antigos e leads."*

Há ainda dois documentos em conflito:
- `ESCOPO-MESTRE.md:328` — "leads/prospects que hoje convivem no cadastro de clientes do PCM
  migram para o Comercial".
- `ADR-0007` — "`pcm.clientes` segue como fonte de verdade do condomínio/cliente", e
  `relacionamento.vinculos.entidade_tipo ∈ ('pcm_cliente','comercial_lead')` codifica duas
  entidades separadas.

## Decisão

**A Conta é uma linha única em `pcm.clientes`, do primeiro contato até o encerramento.**
Lead, prospecto, cliente ativo e cliente antigo são a **mesma linha** em momentos diferentes do
ciclo — nunca registros distintos, nunca cópia na promoção.

**A identidade fica no PCM; o funil fica no Comercial** (regra R3 do [ADR-0019](0019-propriedade-de-dados-r1-r2-r3.md)):

```
pcm.clientes  ─── a CONTA (Shared Kernel)
   identidade: nome, CNPJ, endereço, contatos, grupos, auvo_id, detalhes
   ▲
   │ cliente_id (FK — referência, sem colunas comerciais)
   │
comercial.oportunidades  ─── o FUNIL (enriquecimento do Comercial)
   etapa, score, origem, valor estimado, responsável, motivo de perda,
   conversa_id, data de fechamento
```

Decorrências:

1. **`comercial.leads` é absorvida.** `score`, `resumo`, `conversa_id`, `origem_ref` migram para
   `comercial.oportunidades`. Cada lead existente ganha (ou reusa) uma linha em `pcm.clientes`.
2. **`pcm.clientes.tipo` e `status_comercial` são depreciados** e migram para o Comercial —
   são conceito de funil dentro da tabela da operação (violação de R3, migration `0022_E01-S12`).
3. **O PCM filtra pela coluna que já é dele: `ativo`.** Não precisa saber o que é lead.
4. **O Comercial não filtra nada** — lista toda Conta, com a etapa do funil ao lado. É a "visão
   360 de ativos, antigos e leads" pedida pelo PO.
5. **A Visão 360 é reusada, não reconstruída.** Ela já lê `pcm.clientes` e agrega OS, backlog,
   equipamentos, qualidade, grupos e assessment. O Comercial acrescenta a aba de funil/propostas.
6. **Lead não vai para o Auvo.** Conta com `auvo_id null` não é sincronizada — o sync continua
   empurrando só quem tem contrato/OS, sem regra nova.
7. **`relacionamento.vinculos.entidade_tipo = 'comercial_lead'` é revogado.** Todo vínculo de
   contato aponta para `'pcm_cliente'`. Migration de conversão no E03.

## Alternativas consideradas

- **Comercial dono do lead até fechar** (lead vive em `comercial.leads`, vira `pcm.clientes` na
  assinatura). Segue `ESCOPO-MESTRE:328` ao pé da letra. **Rejeitada**: a promoção por cópia perde
  o rastro pré-venda (proposta, levantamento e conversas de WhatsApp passariam a apontar para um
  ID morto), e obrigaria a reconstruir a Visão 360 dentro do Comercial. `ESCOPO-MESTRE:328` é
  reinterpretado como intenção de **UX** — o lead passa a ser gerido na tela do Comercial —, não
  como exigência de tabela separada.
- **Nova tabela `comercial.contas` como base única, `pcm.clientes` virando view.** Rejeitada:
  mexe na tabela com 35 FKs de 4 contextos, incluindo sync Auvo e portal, em produção.
- **Manter `tipo`/`status_comercial` em `pcm.clientes` e só criar o funil ao lado.** Foi a
  recomendação inicial desta sessão, **descartada pelo próprio R3** — deixaria conceito comercial
  sob custódia do PCM e manteria dois lugares para dizer a mesma coisa.

## Consequências

**Positivas**
- Uma Conta, um histórico: a conversa de WhatsApp que originou o lead continua ligada à mesma
  entidade depois que ele vira cliente com OS e contrato.
- Visão 360 vale para lead, ativo e antigo sem código novo de agregação.
- Comercial e PCM param de duplicar cadastro.

**Negativas / custo aceito**
- Migration de dados em produção: converter `comercial.leads` em Conta + Oportunidade, e
  `tipo`/`status_comercial` em etapa de funil. Reversível, com as colunas antigas mantidas por um
  ciclo antes do drop.
- `pcm.clientes` passa a guardar linhas que ainda não são "clientes". A tabela mantém o nome
  (renomear é risco alto), mas o conceito na linguagem ubíqua passa a ser **Conta** —
  registrado no glossário.
- O Atendimento (E02-S09) precisa passar a escrever em `comercial.oportunidades` via a interface
  do Comercial, em vez de inserir direto em `comercial.leads`.

## Ver também
- [ADR-0019 — Propriedade de dados: R1/R2/R3](0019-propriedade-de-dados-r1-r2-r3.md)
- [ADR-0007 — Base única de contatos e relacionamento](0007-base-unica-contatos-relacionamento.md) (parcialmente substituído)
- `specs/E03-S01-fundacao-comercial/design.md`
