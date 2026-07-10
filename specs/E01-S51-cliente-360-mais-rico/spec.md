---
name: spec
description: Contrato — cliente-360 mais rico (contatos, grupos, financeiro honesto).
alwaysApply: true
---

# Spec — Cliente-360 mais rico

> **Fonte da verdade.** Status: rascunho · Tier: Arquitetural (ver `design.md`)
> Feedback de teste manual do Lucas (2026-07-09, ponto 8): "traga proposta" pra deixar o cliente-360 mais
> rico — cenário-guia: gestor recebe ligação de síndico, quer tudo em 5 segundos. Escopo cortado (ver
> `design.md`) pro que não exige confirmar campo novo contra a API Auvo real — sem acesso a ela nesta
> sessão.

## Resumo
`pcm.clientes.detalhes jsonb` guarda o array completo de `contacts` do Auvo (hoje só o primeiro vira
colunas). Aba Resumo ganha cards de Contatos (múltiplos) e Grupos (`pcm.cliente_grupos`, já existe, nunca
exibido). Aba Financeiro troca o placeholder por `status_comercial` + OS por categoria nos últimos 12
meses (proxy operacional local, sem inventar dado financeiro que não existe).

## Critérios de aceite

### AC-1: Contatos múltiplos visíveis
- **Dado** um cliente com mais de um contato no Auvo (`detalhes.contacts` com >1 item)
- **Quando** a aba Resumo carrega
- **Então** o card Contatos lista todos, não só o principal (já mostrado em "Comunicação")

### AC-2: Grupos visíveis
- **Dado** um cliente associado a 1+ grupos em `pcm.cliente_grupos`
- **Quando** a aba Resumo carrega
- **Então** o card Grupos mostra os nomes; falha ao buscar grupos não derruba o resto da página
  (isolada, mesmo padrão de equipamentos/qualidade)

### AC-3: Financeiro honesto
- **Dado** a aba Financeiro
- **Quando** aberta
- **Então** mostra `status_comercial` em destaque + série de OS por categoria dos últimos 12 meses, sem
  afirmar ter dado de contrato/faturamento que não existe

### AC-4: Sem campo especulativo
- **Dado** qualquer chave nova em `detalhes`
- **Quando** implementada
- **Então** só usa campos já confirmados contra a API real em sessões anteriores (`contacts`) — nenhum
  nome de campo novo adivinhado

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Popular `cidade`/`estado`/`cep` — nome de campo Auvo não confirmado nesta sessão.
- Coordenadas, `customFields`, grupos/tags brutos do payload Auvo.
- Dado financeiro real (contrato/valor/inadimplência) — bounded context próprio (Financeiro).

## Rastreabilidade
- Design: `./design.md`
- Arquivos-âncora: ver `design.md`.
