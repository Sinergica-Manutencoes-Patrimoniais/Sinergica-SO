---
name: product-0002-abertura-chamado-ze
description: PRD-lite da abertura de chamado via Agente Zé — por quê e para quem. Puxe ao revisar escopo desta feature.
alwaysApply: false
---

# Product — Abertura de Chamado via Agente Zé

> Tier: arquitetural · Status: spec aprovada (aguarda implementação — Mês 2)

## Problema
Síndicos e zeladores abrem chamados via WhatsApp de forma desestruturada — sem confirmação formal,
sem número de protocolo, sem rastreio. O operador humano precisa monitorar o grupo 24h para não
perder uma solicitação. Chamados urgentes chegam à noite ou no fim de semana e só são vistos
horas depois.

**Evidência:** no PCM v2, 172 mensagens processadas pelo Zé demonstram alta adesão ao canal
WhatsApp; 517 OS abertas, parcela significativa via Zé após as correções de 17-18/06/2026.

## Para quem
- **Síndico/Zelador** — abre chamado sem instalar nenhum app, pelo WhatsApp que já usa.
- **Operador de escritório** — não precisa monitorar grupo 24h; chamado já chega estruturado.
- **Gestor** — visibilidade imediata de demandas com prioridade.

## Resultado esperado / métrica de sucesso
- **Métrica 1**: % de chamados abertos via Zé que chegam com 3 pontos (problema + local + urgência) na primeira mensagem do operador → alvo ≥95%.
- **Métrica 2**: Latência P95 de resposta do Zé < 10s.
- **Métrica 3**: Zero chamados duplicados (idempotência — um chamado aberto por conversa ativa).

## Goals
- Agente Zé recebe, entende e abre OS estruturada no PCM via WhatsApp, 24/7.
- Detecção determinística de menção antes de acionar o LLM (custo e latência).
- Modos de operação configuráveis por condomínio (off/monitor/active).
- Fila com agrupamento de rajadas de mensagens (3s) — sem processamentos duplicados.
- Loop de tool-calling com confirmação ao síndico.

## Non-goals
- Processamento de imagens enviadas pelo síndico (o Zé não analisa fotos — só texto).
- Resolução de chamados (o Zé só abre e consulta — não fecha).
- Integração com Auvo (o Zé cria a OS no PCM; o despacho para o Auvo é feature separada).

## Riscos / premissas
- Evolution API precisa de instância ativa e configurada — risco de desconexão.
- OpenRouter com modelo Gemini 2.5 Flash: latência depende de carga da API externa.
- Síndico pode tentar injetar prompt — defesa necessária (ver `ia/prompt-e-injection.md`).
