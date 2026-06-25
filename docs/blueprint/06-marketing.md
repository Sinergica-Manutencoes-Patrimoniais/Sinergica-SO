---
name: blueprint-marketing
description: Requirements do módulo Marketing (conteúdo multicanal). Puxe ao planejar specs de publicação ou automação de conteúdo.
alwaysApply: false
---

# Blueprint — Marketing

> Schema Postgres: `marketing` · Feature: `apps/web/src/features/marketing/`

## Problema
Produção de conteúdo era manual, inconsistente e desvinculada dos canais. Sem calendário editorial
ou métricas de alcance.

## Fluxos e regras de negócio

### Calendário editorial
- Planejamento de publicações por canal (Instagram, LinkedIn, WhatsApp broadcast).
- Status: rascunho → revisão → aprovado → agendado → publicado.

### Geração de conteúdo com IA
- Brief → LLM gera texto/legenda → gestor revisa → aprova → publica.
- Sugestão automática de pauta com base em datas relevantes (NBR, manutenções sazonais).

### Publicação
- Integração com Meta Graph API (Instagram/Facebook) e LinkedIn API (Mês 3+).
- WhatsApp broadcast via Evolution API para lista de clientes.

## Entidades
| Entidade | Descrição |
|----------|-----------|
| `Conteudo` | Peça de conteúdo (texto, imagem, vídeo) com canal e status |
| `Publicacao` | Agendamento e resultado de publicação em canal específico |
| `Campanha` | Agrupamento de conteúdos com objetivo e período |

## Métricas (Mês 3+)
- Alcance, engajamento e conversão por publicação.
- Leads gerados via conteúdo orgânico.
