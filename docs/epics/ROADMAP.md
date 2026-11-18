---
name: roadmap-epicos
description: Painel de épicos e stories em aberto do Sinérgica SO (compacto). Histórico completo em docs/epics/historico/.
alwaysApply: false
---

# Roadmap — stories em aberto

> Gerado por roadmap-compactar (2026-09). **Não leia inteiro:** `grep -n "E0N-S0N" docs/epics/ROADMAP.md` e leia só a linha da story.
> Escopo e AC vivem no `spec.md` da story, nunca aqui (uma linha curta por story).
> Stories concluídas e detalhes históricos: `docs/epics/historico/ROADMAP-ate-2026-09.md` (cópia verbatim do ROADMAP anterior).
> Sessões paralelas: marque o **owner** antes de codar. Uma story, um owner por vez.

## Épicos

| ID | Módulo / Contexto | Status | Owner atual |
|----|-------------------|--------|-------------|
| E00 | Shell & Infra (autenticação, layout, deploy) | Em andamento | — |
| E01 | PCM · Operação | Planejado | — |
| E02 | Atendimento · Zé | Em andamento | Claude (sessão Lucas) |
| E03 | Comercial | Especificado por completo — product+design do épico e 14 stories com spec.md+tasks.md prontos para implementar | Claude (sessão Lucas, 2026-08-10) |
| E04 | Financeiro | Em andamento — S01 (fundação) implementada e em produção; S02-S13 especificadas | Claude (sessão Lucas) |
| E05 | Operação · Estoque | Planejado | — |
| E06 | Marketing | Planejado | — |
| E07 | Growth | Planejado | — |
| E08 | Gestão · Cockpit | Planejado | — |
| E09 | Área do Cliente (Portal do Cliente) | Especificado (11 stories; S01 fundação design-first) | — |

## Stories em aberto por épico

### E00 — Shell & Infra
_15 concluídas no histórico · maior ID usado: E00-S28_
| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E00-S25 | Workflow enxuto — ROADMAP compacto, Spec Kit, gates só nos afetados | Claude (sessão Lucas) | Em andamento | [spec](../../specs/E00-S25-workflow-enxuto/spec.md) |
| E00-S09 | Grupos e permissões por módulo — fundação: schema, resolver, hook JWT, Edge Function de g… | Claude (sessão Lucas) | PR #9 aberto — db-tests (pgTAP) achou e… | [spec](../../specs/E00-S09-grupos-permissao-modulo/spec.md) |
| E00-S10 | Grupos e permissões por módulo — UI administrativa (grupos, usuários) e gating de sidebar | Claude (sessão Lucas) | PR #9 aberto (bundle com E00-S09) — lin… | [spec](../../specs/E00-S10-grupos-permissao-ui/spec.md) |
| E00-S11 | Guarda-corpos de Edge Functions + saúde de sync — gate no CI (função sem declaração/invok… | Claude (sessão Lucas) | Implementado localmente — scripts/check… | [spec](../../specs/E00-S11-guarda-edge-functions/spec.md) |
| E00-S14 | Tokens semânticos e erradicação de cor hardcoded | Claude (sessão Lucas) | Spec escrita (2026-08-07) | [spec](../../specs/E00-S14-tokens-semanticos/spec.md) |
| E00-S15 | Biblioteca de primitivas UI | Claude (sessão Lucas) | Spec escrita (2026-08-07) | [spec](../../specs/E00-S15-primitivas-ui/spec.md) |
| E00-S16 | Feedback: toast + diálogo de confirmação | Claude (sessão Lucas) | Spec escrita (2026-08-07) | [spec](../../specs/E00-S16-feedback-toast-dialog/spec.md) |
| E00-S20 | Materiais, profundidade e chrome | Claude (sessão Lucas) | Parcial (2026-08-18). AC-1/2/3 (4 degra… | [spec](../../specs/E00-S20-materiais-profundidade/spec.md) |
| E00-S21 | Rotas reais e wayfinding | Claude (sessão Lucas) | design.md escrito e pronto pra review (… | [spec](../../specs/E00-S21-rotas-wayfinding/design.md) |
| E00-S22 | Tema escuro real e acessibilidade | Claude (sessão Lucas) | Parcial (2026-08-18). AC-2 (prefers-col… | [spec](../../specs/E00-S22-dark-mode-acessibilidade/spec.md) |
| E00-S23 | Gesto do drawer móvel, interrompível | Claude (sessão Lucas) | Lote 2. Não implementado (2026-08-18):… | [spec](../../specs/E00-S23-gesto-drawer/spec.md) |
| E00-S26 | Capacidades sensíveis ponta a ponta (planejar, validar, aprovar, cancelar, exportar, ver custo, administrar) | — | Especificada (2026-11-17) — BL 005 do Pacote Consolidado. Tier arquitetural | [spec](../../specs/E00-S26-capacidades-sensiveis/spec.md) |
| E00-S27 | Revogação imediata de acesso — sessão, cache e JWT carimbado | — | Especificada (2026-11-17) — BL 006 do Pacote Consolidado. **Exposição de segurança aberta hoje.** Depende de E00-S26 | [spec](../../specs/E00-S27-revogacao-imediata/spec.md) |
| E01-S190 | Onda Zero: navegação consolidada (Assessment, PMOC, Clientes e Estrutura) | Claude (sessão Lucas) | **Desbloqueada em 2026-11-17** (respostas 26/27 do Fabrício) — pronta para implementar | [spec](../../specs/E01-S190-onda-zero-navegacao/spec.md) |
| E01-S191 | Jornada vertical do piloto Guainumbi ponta a ponta, com evidência e rollback | — | Especificada — implementação não iniciada (2026-11-13) | [spec](../../specs/E01-S191-piloto-vertical-guainumbi/spec.md) |
| E01-S192 | Agenda com alocações e Preventivas com jornada visível (diagnóstico primeiro) | — | Especificada — implementação não iniciada (2026-11-13) | [spec](../../specs/E01-S192-agenda-preventivas-visiveis/spec.md) |
| E01-S193 | Backlog como escopo validado que antecede Chamado e OS | Claude (sessão Lucas) | Especificada (2026-11-17) — BL 002. Tier arquitetural (dado em produção) | [spec](../../specs/E01-S193-backlog-antecede-chamado/spec.md) || E01-S194 | Kanban operacional aprovado — Campo a conciliar, Demanda e Validação PCM como etapas | — | Especificada (2026-11-17) — BL 007. Depende de E01-S193 e E00-S26 | [spec](../../specs/E01-S194-kanban-operacional-aprovado/spec.md) |
| E01-S195 | Deslocamento: enquadramento residencial × operacional e impacto na jornada | — | Especificada (2026-11-17) — BL 009 | [spec](../../specs/E01-S195-deslocamento-enquadramento/spec.md) |
| E01-S196 | Gatilho único do Auvo — criação manual vira contingência auditada | — | Especificada (2026-11-17) — resto do BL 004 (o acionador entrou na 1844). Tier arquitetural | [spec](../../specs/E01-S196-gatilho-unico-auvo/spec.md) |
| E01-S197 | Pendências técnicas agrupadas por ativo, sem perder o achado individual | — | Especificada (2026-11-17) — BL 008. Depende de E01-S193 | [spec](../../specs/E01-S197-pendencias-agrupadas-ativo/spec.md) |
| E01-S198 | API de domínio sobre o staging | — | Especificada (2026-11-17) — BL 014, P2. Tier arquitetural. Depende de E00-S26/S27 | [spec](../../specs/E01-S198-api-dominio-staging/spec.md) |

### E02 — Atendimento · Zé
_6 concluídas no histórico · maior ID usado: E02-S43_

| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E02-S01 | Fundação: atendimento.conversas/atendimento.mensagens + Zé integrado como agente do Inbox… | Claude (sessão Lucas) | Implementada localmente | [spec](../../specs/E02-S01-atendimento-fundacao/product.md) |
| E02-S02 | Inbox de Conversas (UI, WhatsApp-only) — lista + chat + perfil do contato, toggle IA/huma… | Claude (sessão Lucas) | Implementada localmente | [spec](../../specs/E02-S02-atendimento-inbox/product.md) |
| E02-S03 | Dashboard de Atendimento (KPIs/SLA/filas) | Claude (sessão Lucas) | Implementada localmente | [spec](../../specs/E02-S03-atendimento-dashboard/product.md) |
| E02-S04 | Multi-canal: Instagram + Messenger — Inbox humano, sem IA (decisão do Lucas) | Codex | Implementada localmente — modelo/UX pre… | [spec](../../specs/E02-S04-atendimento-multicanal/product.md) |
| E02-S05 | Config: canais + tags | Claude (sessão Lucas) | Implementada localmente — atendimento.t… | [spec](../../specs/E02-S05-atendimento-config-canais-tags/product.md) |
| E02-S06 | Config: IA + Personas + Base de Conhecimento — atendimento.personas multi-persona (chamad… | Claude (sessão Lucas) | Implementada localmente | [spec](../../specs/E02-S06-atendimento-personas/product.md) |
| E02-S07 | Config: Flow-builder visual (@xyflow/react) — roteiro de qualificação do agente comercial | Claude (sessão Lucas) | Implementada localmente — decisão do Lu… | [spec](../../specs/E02-S07-atendimento-flow-builder/product.md) |
| E02-S08 | Base única de Contatos e Timeline de Relacionamento — contato/identidade/vínculo transver… | Codex | Implementada localmente — schema relaci… | [spec](../../specs/E02-S08-relacionamento-contatos/product.md) |
| E02-S09 | Agente comercial — qualifica contato novo via instância WhatsApp separada, cria comercial… | Codex | Implementada em produção — persona come… | [spec](../../specs/E02-S09-agente-comercial-whatsapp/product.md) |
| E02-S10 | Métricas server-side de Atendimento — Edge Function atendimento-metrics computa SnapshotA… | Codex | Implementada localmente — RPC server-si… | [spec](../../specs/E02-S10-metricas-server-side-atendimento/design.md) |
| E02-S11 | Painel operacional completo (paridade heziomos) — KPI strip de 6 cards, Saúde da fila (ag… | Codex | Implementada localmente — KPIs, aging,… | [spec](../../specs/E02-S11-painel-operacional-completo/spec.md) |
| E02-S12 | Widgets analíticos avançados do painel — volume/dia, SLA & entrega, heatmap por hora, thr… | Codex | Implementada localmente — séries, SLA,… | [spec](../../specs/E02-S12-widgets-analiticos-atendimento/spec.md) |
| E02-S13 | IA | Codex | Implementada localmente — identidade, m… | [spec](../../specs/E02-S13-config-aba-ia/spec.md) |
| E02-S14 | Operação | Codex | Implementada localmente — regras, limit… | [spec](../../specs/E02-S14-config-aba-operacao/spec.md) |
| E02-S15 | Conhecimento / Base RAG | Codex | Implementada localmente — CRUD, busca p… | [spec](../../specs/E02-S15-config-conhecimento-rag/spec.md) |
| E02-S16 | Meta | Codex | Código implementado localmente — conexã… | [spec](../../specs/E02-S16-config-canais-meta/spec.md) |
| E02-S17 | Coment. IG + Opt-outs | Codex | Implementada localmente — automações IG… | [spec](../../specs/E02-S17-config-automacao-igcomments-optouts/spec.md) |
| E02-S18 | Scoring + Clusters | Codex | Implementada localmente — configuração,… | [spec](../../specs/E02-S18-config-scoring-clusters/spec.md) |
| E02-S19 | Evolution | Codex | Implementada localmente; UAT Evolution… | [spec](../../specs/E02-S19-config-aba-evolution/spec.md) |
| E02-S20 | Fluxos | Codex | Implementada localmente; pgTAP/UAT pend… | [spec](../../specs/E02-S20-fluxos-node-graph/spec.md) |
| E02-S21 | Inbox rico | Codex | Implementada localmente; pgTAP/UAT Evol… | [spec](../../specs/E02-S21-inbox-rico/spec.md) |
| E02-S22 | Evolution multi-instância pronta para operação | Codex | Código/gates merge-ready — 0149 fecha a… | [spec](../../specs/E02-S22-atendimento-evolution-multiinstancia/product.md) |
| E02-S23 | Zé abre N chamados a partir do contexto (WhatsApp), com confirmação antes de gravar | Claude (sessão Lucas) | Implementado localmente (2026-07-28). M… | [spec](../../specs/E02-S23-ze-abre-chamado-contexto/spec.md) |
| E02-S24 | Memória e "alma" por cliente para o Zé (MVP textual) | Claude (sessão Lucas) | Implementado parcialmente (2026-07-28).… | [spec](../../specs/E02-S24-ze-memoria-alma-cliente/product.md) |
| E02-S25 | Trigger de resposta automática do Zé | Claude (sessão Lucas) | Schema + lógica pura implementados (202… | [spec](../../specs/E02-S25-ze-trigger-resposta-automatica/spec.md) |
| E02-S26 | Agente entrevistador de cadastro cliente/estrutura + "Editar com IA" | — (livre) | Só schema (2026-07-28), migration 0160.… | [spec](../../specs/E02-S26-agente-entrevistador-cadastro/product.md) |
| E02-S27 | Configurar Evolution no SO (URL + chave) + expor webhook | Codex | Implementado localmente (2026-08-06). U… | [spec](../../specs/E02-S27-fix-cadastro-evolution-api/spec.md) |
| E02-S30 | Comunicação com MCPs — agente ganha acesso a servidor(es) MCP como ferramenta | Claude (sessão Lucas) | Design escrito (2026-08-07). Implementa… | [spec](../../specs/E02-S30-mcp-tool-calling/product.md) |
| E02-S35 | Canal Evolution confiável: servidor atestado (SSRF), matriz de compatibilidade, instância e token por canal no Vault, estados e saúde | — | Spec+plan+tasks escritos (2026-11-12). Tier arquitetural: exige ADR 1686 | [spec](../../specs/E02-S35-canal-evolution-confiavel/spec.md) |
| E02-S36 | Webhook Evolution por canal: canal no caminho, segredo próprio em tempo constante, idempotência (canal, evento, id) | — | Spec+plan+tasks escritos (2026-11-12). Tier arquitetural: exige ADR 1687. Depende de S35 | [spec](../../specs/E02-S36-webhook-evolution-por-canal/spec.md) |
| E02-S37 | Mídia recebida: imagem, vídeo, documento, figurinha e avisos visíveis; proxy de anexo autenticado; transcrição uma vez só | — | Spec+plan+tasks escritos (2026-11-12). Tier arquitetural. Depende de S36 | [spec](../../specs/E02-S37-midia-recebida-evolution/spec.md) |
| E02-S38 | Citação e reação na conversa | — | Spec+plan+tasks escritos (2026-11-12). Depende de S37 | [spec](../../specs/E02-S38-citacao-e-reacao/spec.md) |
| E02-S39 | Mensagem do aparelho tira o Zé — inclui AC-0: diagnosticar por que a mensagem do celular não aparece hoje | — | Spec+plan+tasks escritos (2026-11-12). Tier arquitetural: exige ADR 1688. Depende de S36 | [spec](../../specs/E02-S39-aparelho-tira-o-ze/spec.md) |
| E02-S40 | Foto do WhatsApp do contato no atendimento | — | Spec+plan+tasks escritos (2026-11-12). Depende de S36 | [spec](../../specs/E02-S40-foto-do-contato/spec.md) |
| E02-S41 | Visão de conversa nova: workspace, fila com escopo, timeline tipada, contexto do cliente | — | Spec+design+plan+tasks escritos (2026-11-12). Tier arquitetural; design.md com 3 questões em aberto para o Lucas. Depende de S37 e S38 | [spec](../../specs/E02-S41-visao-de-conversa/spec.md) |
| E02-S42 | Retirar a rota de prévia simulada `/preview-s41` do build de produção | — | Especificada — implementação não iniciada (2026-11-13) | [spec](../../specs/E02-S42-remover-preview-simulado/spec.md) |
| E02-S43 | MCP controlado sobre a API de domínio | — | Especificada (2026-11-17) — BL 015, P2. **Bloqueada**: exige E01-S198 homologada. Substitui o design parado de E02-S30 | [spec](../../specs/E02-S43-mcp-controlado/spec.md) |

### E03 — Comercial
_7 concluídas no histórico · maior ID usado: E03-S14_

| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E03-S01 | Fundação do Comercial + Conta única | — | Pronta para implementar — 10 AC, 13 tas… | [spec](../../specs/E03-S01-fundacao-comercial/product.md) |
| E03-S02 | Funil (Kanban) + etapas configuráveis | — | Pronta para implementar — 7 AC, 9 tasks | [spec](../../specs/E03-S02-funil-kanban-etapas/spec.md) |
| E03-S03 | Parâmetros de precificação + catálogo de materiais + motor de preço | — | Pronta para implementar — 9 AC, 10 task… | [spec](../../specs/E03-S03-precificacao-catalogo/spec.md) |
| E03-S04 | Editor de proposta | — | Pronta para implementar — 9 AC, 10 tasks | [spec](../../specs/E03-S04-editor-proposta/spec.md) |
| E03-S05 | Levantamento de pré-venda | Claude (sessão Lucas) | Implementado (2026-08-11). Migrations 0… | [spec](../../specs/E03-S05-levantamento-pre-venda/spec.md) |
| E03-S06 | Proposta: PDF + aprovação no portal | Claude (sessão Lucas) | Implementado (2026-08-11). Migrations 0… | [spec](../../specs/E03-S06-proposta-pdf-portal/spec.md) |
| E03-S07 | Contratos | Claude (sessão Lucas) | Implementado (2026-08-11). Migrations 0… | [spec](../../specs/E03-S07-contratos/spec.md) |

### E04 — Financeiro
_12 concluídas no histórico · maior ID usado: E04-S13_

| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E04-S02 | Import de extrato OFX — parser puro (fixtures reais), dedupe por FITID, regras de classif… | Claude (sessão Lucas) | Implementado e em produção (2026-07-21)… | [spec](../../specs/E04-S02-import-ofx/spec.md) |

### E05 — Operação · Estoque
_0 concluídas no histórico · maior ID usado: E05-S00_

### E06 — Marketing
_0 concluídas no histórico · maior ID usado: E06-S00_

### E07 — Growth
_0 concluídas no histórico · maior ID usado: E07-S00_

### E08 — Gestão · Cockpit
_0 concluídas no histórico · maior ID usado: E08-S00_

### E09 — Área do Cliente (Portal do Cliente / Portal do Síndico)
_10 concluídas no histórico · maior ID usado: E09-S11_

| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E09-S11 | Deploy separado do portal | Codex | Código/build isolado concluído; deploy… | [spec](../../specs/E09-S11-portal-deploy-separado/design.md) |

## Como abrir uma nova story

1. Pegue o próximo ID livre do épico (maior ID usado acima + 1) e adicione a linha nesta tabela com **owner**.
2. Rode `node scripts/nova-story.mjs` ou crie `specs/E0N-S0N-<nome>/` pelo fluxo Spec Kit (`speckit-specify`).
3. Ao concluir, remova a linha daqui (a story fica no git e no `spec.md`).
