---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Memória e "alma" por cliente para o Zé

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 2. Ver `product.md` e `design.md`.

## Resumo
O Zé usa **um único prompt base** e **consome** a "alma" (particularidades de comunicação) e a
**memória** (janela crua ~1 mês + resumo rolante ~2–3 meses) de cada cliente como contexto em
runtime, com isolamento estrito entre clientes. Chamados continuam no banco como rastreio durável e
são consultados sob demanda, fora da memória de conversa.

## Critérios de aceite

### AC-1: Prompt base único + alma do cliente
- **Dado** um cliente com "alma" cadastrada
- **Quando** o Zé responde a esse cliente
- **Então** o contexto do modelo = prompt base único + alma daquele cliente; **e** clientes sem alma
  usam só o prompt base (sem erro).

### AC-2: Injeção de memória (janela crua)
- **Dado** conversas recentes do cliente (~último mês)
- **Quando** o Zé monta o contexto
- **Então** inclui a janela crua recente daquele cliente.

### AC-3: Resumo rolante 2–3 meses
- **Dado** conversas que saíram da janela crua
- **Quando** o job de resumo roda
- **Então** elas são consolidadas em um resumo (~2–3 meses) por cliente, e o conteúdo cru antigo é
  descartado conforme a política de retenção.

### AC-4: Isolamento entre clientes (segurança)
- **Dado** dois clientes distintos
- **Quando** o Zé responde ao cliente A
- **Então** nenhuma parte da alma/memória do cliente B entra no contexto de A.

### AC-5: Chamados consultados sob demanda, não na memória
- **Dado** um pedido do tipo "últimos N chamados"
- **Quando** o Zé precisa desse dado
- **Então** ele consulta `pcm.chamados` no banco (ferramenta/tool), sem depender da memória de conversa.

### AC-6: Alma editável na UI do cliente
- **Dado** o cadastro/resumo do cliente
- **Quando** o operador edita a "alma"
- **Então** a alteração é persistida e passa a valer nas próximas respostas do Zé para esse cliente.

## Casos de borda e erros
- Cliente novo (sem histórico) → só prompt base + alma vazia; Zé responde sem quebrar.
- Falha do job de resumo → mantém último resumo válido; não perde a janela crua.
- Contexto excede budget → prioriza alma + janela crua mais recente; trunca resumo, com log.

## Fora de escopo
- Trigger de quando responder (E02-S25) e abertura de chamado (E02-S23).
- RAG/embeddings (adiado — só se evals exigirem, ADR futuro).

## Rastreabilidade
- Product: `./product.md` · Design: `./design.md`
- Código: `features/atendimento/`, `supabase/functions/pcm-ze-agent/`; leitura `pcm.chamados`.
- Feature de IA/LLM → trilha `ia/` (prompt versionado + eval + injection) com `@prompt-engineer`.
- ADRs: **ADR-0015** (estratégia de memória textual vs. RAG); relaciona ADR-0011 (tenancy/cliente_id).
