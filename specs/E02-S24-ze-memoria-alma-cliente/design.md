---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Memória e "alma" por cliente para o Zé

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** @prompt-engineer / @architect · **Revisores:** Lucas · **Data:** 2026-07-28

## Contexto da funcionalidade
O Zé (Atendimento, `features/atendimento/` + `supabase/functions/pcm-ze-agent/`) usa hoje um prompt
genérico. O negócio quer contexto por cliente sem multiplicar prompts. Ver `product.md`.

## Goals / Non-goals
**Goals**
- Composição de contexto em runtime: `prompt base único` + `alma(cliente)` + `memória(cliente)`.
- Retenção: janela crua ~1 mês; resumo rolante ~2–3 meses; descarte do antigo.
- Isolamento estrito por cliente.

**Non-goals**
- Prompt por cliente; fine-tuning; vector store dedicado (avaliar só se o resumo textual não bastar).

## Design proposto

### Composição do contexto (runtime)
```
system = PROMPT_BASE_ZE            (versionado em ia/)
       + ALMA_CLIENTE(cliente_id)  (características/preferências editáveis)
       + MEMORIA(cliente_id)       (resumo rolante 2–3 meses + janela crua ~1 mês)
```
- **Alma**: registro por cliente com traços de comunicação, preferências, observações
  (texto estruturado, editável na UI do cliente). É estável, muda pouco.
- **Memória**: duas camadas —
  - **Crua**: mensagens recentes (~1 mês / janela atual) lidas do histórico de atendimento.
  - **Resumo rolante**: sumário dos últimos ~2–3 meses, regenerado periodicamente por LLM; o que
    passa da janela vira resumo e o resumo antigo é descartado.

### Modelo de dados (proposto)
- `atendimento.cliente_alma` (cliente_id PK/FK, conteudo, updated_at).
- `atendimento.cliente_memoria_resumo` (cliente_id, periodo_inicio, periodo_fim, resumo, updated_at).
- Janela crua: derivada do histórico de mensagens já existente (E01-S89 / E02-S22) — não duplicar.
- **Chamados** permanecem em `pcm.chamados` (rastreio durável) e são consultados por ferramenta/tool
  do agente sob demanda ("últimos N chamados"), fora da memória de conversa.

### Geração do resumo rolante
- Job/edge function periódica: para cada cliente ativo, resumir mensagens que saíram da janela crua
  e mesclar no resumo; descartar cru antigo conforme retenção. Prompt versionado em `ia/`.

## Cobertura dos 5 eixos

### 1. Tech stack
OpenRouter (LLM) para resumo e resposta; Postgres para alma/resumo; Deno edge functions. Avaliar
**se** precisa de embeddings/vector — **decisão adiada**: começar com resumo textual (mais simples,
suficiente pelo escopo). Só subir para vector store se evals mostrarem necessidade → viraria ADR.

### 2. Arquitetura base
Novo material no bounded context **Atendimento**. Não cruza para PCM além de ler chamados via porta
(Conformist, como já faz o snapshot de histórico E01-S89). Isolamento por `cliente_id`.

### 3. Infra
Tabelas novas em schema `atendimento` com **RLS FORCE**. Job de resumo (cron/edge). Custo LLM do
resumo é limitado pela retenção. Secrets/OpenRouter via Vault (padrão do projeto).

### 4. Qualidade
- Evals (`ia/`): resposta usa alma+memória corretamente; **não** vaza contexto de outro cliente.
- Teste de isolamento (segurança): memória do cliente A nunca aparece no contexto do cliente B.
- Budget: tamanho de contexto injetado limitado (janela ~1 mês + resumo curto).

### 5. Observabilidade
Logar (sem PII sensível) qual versão de prompt + tamanho de contexto por resposta; métrica de custo
de resumo por cliente; alerta se o contexto exceder budget.

## Mapa de dependências
| Dependência              | Tipo    | Descrição                                  | Métodos / endpoints         |
|--------------------------|---------|--------------------------------------------|-----------------------------|
| OpenRouter               | REST    | LLM de resposta e de resumo rolante        | chat/completions            |
| Histórico de atendimento | interna | Fonte da janela crua (E01-S89 / E02-S22)   | snapshots/mensagens         |
| `pcm.chamados`           | interna | Consulta sob demanda (tool do agente)      | leitura por cliente         |

## Alternativas consideradas
| Alternativa                              | Prós | Contras | Por que (não) |
|------------------------------------------|------|---------|---------------|
| A (escolhida) prompt base + alma + resumo textual por cliente | simples, barato, alinhado ao pedido | resumo pode perder nuance | escolhida — MVP suficiente |
| B agente/prompt por cliente              | máxima personalização | inviável de manter; contradiz o pedido | rejeitada |
| C vector store (RAG) por cliente         | recall fino | complexidade/custo altos sem evidência de ganho | adiada — só se evals pedirem |

## Trade-offs e consequências
- Ganho: personalização barata e mantível. Custo: qualidade do resumo depende do prompt (versionar +
  avaliar). Dívida consciente: sem RAG no MVP.

## Riscos
| Risco                      | Descrição                              | Prob. × Impacto | Ações / mitigações                   |
|----------------------------|----------------------------------------|-----------------|--------------------------------------|
| Vazamento entre clientes   | memória de A no contexto de B          | baixo × alto    | isolamento por cliente_id + teste de segurança |
| Resumo perde informação    | rolling summary corta algo relevante   | médio × médio   | chamados no banco como verdade durável |
| Custo LLM do resumo        | muitos clientes ativos                 | médio × baixo   | retenção curta; frequência ajustável |

## Roadmap da feature
| Fase / onda | Entrega                                        | Quando | Depende de |
|-------------|------------------------------------------------|--------|------------|
| 1 (MVP)     | Alma editável + injeção de janela crua no contexto | próximo ciclo | E02-S22 |
| 2           | Resumo rolante automático + descarte por retenção  | depois | 1 |
| 3           | (condicional) RAG/embeddings se evals exigirem     | depois | 2 + ADR |

## Questões em aberto
- [ ] Formato da "alma": texto livre único ou campos estruturados? (Lucas / @prompt-engineer)
- [ ] Frequência do job de resumo (diário? semanal?). (Lucas)
- [ ] Confirmar retenção final: 1 mês cru + 2–3 meses resumo (Fabrício sinalizou "1 mês talvez baste").

> Decisão sobre estratégia de memória (textual vs. RAG) é difícil de reverter → **ADR-0015**.
