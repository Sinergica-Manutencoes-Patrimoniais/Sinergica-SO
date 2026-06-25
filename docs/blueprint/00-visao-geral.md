---
name: blueprint-visao-geral
description: Visão geral de requirements do Sinérgica OS — todos os 9 módulos. Puxe ao planejar épicos ou revisar escopo.
alwaysApply: false
---

# Blueprint — Sinérgica OS: Visão Geral

> Este blueprint captura os requirements de alto nível de cada módulo, extraídos do PCM v2
> (legado) e das conversas com o cliente. A especificação executável (AC testáveis) fica em
> `specs/NNNN-*/` — o blueprint alimenta as features, não as substitui.

## Roadmap por módulo

| Mês | Módulo | Prioridade | Dependências |
|-----|--------|-----------|--------------|
| 2 | PCM / Operação | crítico | base de dados, Auvo |
| 2 | Atendimento (Zé) | crítico | PCM (OS), WhatsApp/Evolution |
| 2 | Comercial | alta | PCM (clientes) |
| 2 | Financeiro | alta | PCM (OS finalizadas) |
| 3 | Operação & Estoque | media | PCM (materiais de OS) |
| 3 | Marketing | media | standalone |
| 3 | Growth | media | standalone |
| 3 | Área do Cliente | alta | PCM (views) |
| 3 | Gestão (Cockpit) | alta | todos os outros |

## Arquivos de blueprint por módulo
- [01 — PCM / Operação](01-pcm-operacao.md)
- [02 — Atendimento (Zé/IA)](02-atendimento-ze.md)
- [03 — Comercial](03-comercial.md)
- [04 — Financeiro](04-financeiro.md)
- [05 — Operação & Estoque](05-operacao-estoque.md)
- [06 — Marketing](06-marketing.md)
- [07 — Growth](07-growth.md)
- [08 — Gestão (Cockpit)](08-gestao-cockpit.md)
- [09 — Área do Cliente](09-area-cliente.md)
- Integrações:
  - [Auvo](integracoes/auvo.md)
  - [WhatsApp / Evolution API](integracoes/whatsapp-evolution.md)
  - [OpenRouter / LLM](integracoes/llm-openrouter.md)

## Fluxo central da operação (PCM como hub)
```
Síndico/Zelador
  → WhatsApp (Zé) / Portal / Manual
      → OS criada no PCM [status: solicitacao]
          → Gestor atribui técnico [status: planejamento]
              → PCM cria task no Auvo (externalId idempotente)
                  → Técnico executa no app Auvo
                      → Auvo retorna via webhook (status, fotos, checklist, peças)
                          → PCM atualiza OS [status: finalizado]
                              → Relatório diário gerado e enviado ao síndico
                              → Custo consolidado no Financeiro
                              → Síndico vê histórico na Área do Cliente
```
