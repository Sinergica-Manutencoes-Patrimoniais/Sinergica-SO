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
_15 concluídas no histórico · maior ID usado: E00-S25_

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

### E01 — PCM · Operação
_75 concluídas no histórico · maior ID usado: E01-S162_

| ID | Título | Owner | Status | Spec |
|----|--------|-------|--------|------|
| E01-S02 | Abertura de chamado via Agente Zé | Codex | Implementação local parcial (Fluxo A) —… | [spec](../../specs/0002-abertura-chamado-ze/spec.md) |
| E01-S04 | PMOC — Inventário de equipamentos de climatização (cadastro + wizard) | Claude (sessão Lucas) | Implementado localmente (2026-07-20). C… | [spec](../../specs/E01-S04-inventario-climatizacao/spec.md) |
| E01-S07 | Hub de OS — Fila unificada de Ordens de Serviço (C1/C2/P1/P2/IN, SLA, prioridade) | Claude (sessão Lucas) | Implementado (2026-07-20). Resolve a De… | [spec](../../specs/E01-S07-hub-de-os/design.md) |
| E01-S13 | Import inicial de clientes Auvo → PCM (bootstrap, direção invertida do fluxo padrão PCM→A… | Claude (sessão Lucas) | Implementado — migration 0014 (GRANT se… | [spec](../../specs/E01-S13-import-inicial-clientes-auvo/spec.md) |
| E01-S02 | Abertura de chamado via Agente Zé — WhatsApp → OS direto (status='solicitacao', origem='z… | Codex | Implementação local parcial (Fluxo A) —… | [spec](../../specs/0002-abertura-chamado-ze/spec.md) |
| E01-S14 | para cliente já existente (pcm.clientes) pedindo serviço extra-contratual | Codex → E09-S09 | RESOLVIDA POR OUTRA VIA — descoberto na… | [spec](../../specs/E01-S14-fluxo-b-orcamento/design.md) |
| E01-S15 | Enriquecer webhook de OS (estende E01-S10) — capturar relato do usuário, anexos/fotos, qu… | Codex | Implementado localmente — migration 001… | [spec](../../specs/E01-S15-webhook-os-rico/spec.md) |
| E01-S16 | decisão do usuário (2026-07-04): Auvo continua dono do dado de equipamento, PCM NÃO dupli… | Codex | Implementado localmente — migration 001… | [spec](../../specs/E01-S16-relacionamento-equipamento-auvo-pcm/spec.md) |
| E01-S17 | Painel financeiro/tickets do cliente na Visão 360 (fase 2 já prevista em E01-S12 §4) — es… | Codex | Bloqueado / não implementado por decisã… | [spec](../../specs/E01-S17-visao-360-financeiro-tickets-auvo/spec.md) |
| E01-S18 | Abertura manual de OS no PCM — tela/modal inspirada no PCM antigo, com campos selecionáve… | Codex | Implementado localmente — botão "Nova O… | [spec](../../specs/E01-S18-abertura-manual-os-pcm/spec.md) |
| E01-S03b | sem spec.md/tasks.md | Codex → Claude (sessão… | Reconciliado (2026-07-20) — spec.md/tas… | [spec](../../specs/E01-S03-pmoc-schema/design.md) |
| E01-S22 | Motor de sync Auvo (write path) — outbox transacional pcm.auvo_sync_outbox + drain genéri… | Claude (sessão Lucas) | Implementado localmente (branch feat/E0… | [spec](../../specs/E01-S22-motor-sync-auvo-write/product.md) |
| E01-S23 | Motor de sync Auvo (read path) — dispatcher de webhook genérico (User/Customer/Equipment/… | Codex | Implementado localmente — registry ganh… | [spec](../../specs/E01-S23-motor-sync-auvo-read/product.md) |
| E01-S24 | Tipos de Tarefa (cron) — primeira entidade do catálogo, valida o motor ponta a ponta | Codex | Implementado localmente — migration 002… | [spec](../../specs/E01-S24-catalogo-tipos-tarefa/spec.md) |
| E01-S25 | Segmentos + Palavras-chave (cron) | Codex | Implementado localmente — migration 002… | [spec](../../specs/E01-S25-catalogo-segmentos-palavras-chave/spec.md) |
| E01-S26 | Categorias (produto + equipamento) (cron) | Codex | Implementado localmente — migration 002… | [spec](../../specs/E01-S26-catalogo-categorias/spec.md) |
| E01-S27 | Grupos de Clientes (cron, sem PATCH) + Clientes CRUD (webhook Customer) — primeiro write-… | Codex | Implementado localmente — migration 003… | [spec](../../specs/E01-S27-clientes-crud-grupos/spec.md) |
| E01-S28 | Funcionários (webhook User) — promove pcm.tecnicos_cache para tabela editável, com criaçã… | Codex | Implementado localmente — migration 003… | [spec](../../specs/E01-S28-funcionarios/spec.md) |
| E01-S33 | Tickets (webhook Ticket) | Claude (sessão Lucas) | Implementada localmente — pcm.tickets,… | [spec](../../specs/E01-S33-tickets/spec.md) |
| E01-S34 | Reconciliação Auvo→PCM — liga o pg_cron real das 9 entidades com cronSchedule (era metada… | Claude (sessão Lucas) | Achado durante teste manual do PR #30 (… | [spec](../../specs/E01-S34-reconciliacao-sync-auvo-pcm/product.md) |
| E01-S35 | BLOQUEIA toda a integração Auvo. | Claude (sessão Lucas) | Implementado localmente (código) — as 1… | [spec](../../specs/E01-S35-deploy-edge-functions-auvo/design.md) |
| E01-S36 | Write path instantâneo PCM→Auvo (todas as entidades) — flip writeEnabled (só com mapeamen… | Claude (sessão Lucas) | Parcialmente implementado. Migration 00… | [spec](../../specs/E01-S36-write-path-instantaneo-auvo/design.md) |
| E01-S46 | Banner de transparência "escrita local ainda não vai pro Auvo" em Ferramentas/Categorias… | Claude (sessão Lucas) | Implementado. Novo BannerEscritaAuvoPen… | [spec](../../specs/E01-S46-banner-escrita-auvo-pendente/spec.md) |
| E01-S47 | Verificar contrato Auvo real e habilitar escrita (funcionário → ferramenta → categoria →… | Codex (sessão 2026-07-1… | Implementada parcialmente com contrato… | [spec](../../specs/E01-S47-habilitar-escrita-real-auvo/spec.md) |
| E01-S51 | Cliente-360 mais rico — nova pcm.clientes.detalhes jsonb (mesmo padrão do auvo_detalhes d… | Claude (sessão Lucas) | Escopo cortado em runtime (mesma causa… | [spec](../../specs/E01-S51-cliente-360-mais-rico/design.md) |
| E01-S52 | GPS da equipe — pull GET /gps → pcm.gps_posicoes (retenção 7d) + card "Equipe agora" no d… | Codex + Claude (sessão… | Implementado localmente (migration 0078… | [spec](../../specs/E01-S52-gps-equipe/spec.md) |
| E01-S53 | Tier arquitetural — design.md + ADR antes de codar; bloqueada em credencial de API | Codex | Design pronto — design.md + ADR-0008 (d… | [spec](../../specs/E01-S53-preventivo-service-orders/spec.md) |
| E01-S54 | Custo real da OS — espelhos pcm.despesa_tipos/pcm.despesas (/expenses+/expensetypes, writ… | Codex + Claude (sessão… | Implementado localmente (migration 0079… | [spec](../../specs/E01-S54-custo-real-despesas/spec.md) |
| E01-S55 | Pesquisa de satisfação — espelho pcm.satisfacao_respostas (/satisfactionsurveys), nota mé… | Codex + Claude (sessão… | Implementado localmente (migration 0080… | [spec](../../specs/E01-S55-pesquisa-satisfacao/spec.md) |
| E01-S56 | Catálogo de questionários — espelho pcm.questionarios (/questionnaires, read-only), check… | Codex + Claude (sessão… | Implementado localmente e contrato veri… | [spec](../../specs/E01-S56-catalogo-questionarios/spec.md) |
| E01-S57 | Criação de tarefa rica — pcm-auvo-create-task passa a enviar anexo de contexto (histórico… | Codex | Parcial — gerador puro de contexto/prod… | [spec](../../specs/E01-S57-criacao-tarefa-rica/spec.md) |
| E01-S58 | Reconciliação de tarefas excluídas — GET /tasks/GetDeletedTasks no sync cancela OS locais… | Codex + Claude (sessão… | Implementado localmente e contrato veri… | [spec](../../specs/E01-S58-reconciliacao-tarefas-excluidas/spec.md) |
| E01-S59 | Refino de densidade operacional — compacta shell, inputs, KPIs e painéis PCM; ocupa corre… | Codex | Implementado localmente e QA autenticad… | [spec](../../specs/E01-S59-refino-densidade-operacional/spec.md) |
| E01-S60 | Acabamento visual transversal V1 — primitives compartilhadas, Login, shell responsivo, PC… | Codex + Claude (sessão… | Implementado e verificado — gates reexe… | [spec](../../specs/E01-S60-acabamento-visual-v1/spec.md) |
| E01-S61 | Kanban — arrastar card entre colunas muda status de verdade (HTML5 Drag and Drop nativo,… | Claude (sessão Lucas) | Implementado. OsKanbanView.tsx ganha dr… | [spec](../../specs/E01-S61-kanban-drag-drop/spec.md) |
| E01-S64 | Reserva de ferramenta por data/período (unidade específica ou genérica), com detecção de… | Claude (sessão Lucas) | Implementado localmente — pcm.ferrament… | [spec](../../specs/E01-S64-ferramentas-reserva/spec.md) |
| E01-S65 | Cadastro rico de ferramenta — mais fácil, com valor/custo/código Auvo visíveis + imagem.… | Claude (sessão Lucas) | Implementado localmente (caminho conser… | [spec](../../specs/E01-S65-ferramentas-cadastro-rico/spec.md) |
| E01-S68 | Fix crítico do sync de tarefas. | Claude (sessão Lucas) | Código implementado localmente (tasks 1… | [spec](../../specs/E01-S68-fix-sync-tarefas/spec.md) |
| E01-S69 | OS clicável e editável | Claude (sessão Lucas) | Implementado localmente — NovaOrdemServ… | [spec](../../specs/E01-S69-os-clicavel-editavel/spec.md) |
| E01-S70 | Todas as abas do Auvo no PCM | Claude (sessão Lucas) | Implementado localmente — montarDetalhe… | [spec](../../specs/E01-S70-abas-ricas-auvo/spec.md) |
| E01-S71 | Imagem e anexos de equipamentos | Claude (sessão Lucas) | Implementado localmente — migration 008… | [spec](../../specs/E01-S71-imagem-equipamentos/spec.md) |
| E01-S74 | Serviço → Auvo (write path) | Claude (sessão Lucas) | Implementado localmente — teste de cont… | [spec](../../specs/E01-S74-servico-write-auvo/spec.md) |
| E01-S84 | Kanban de OS: colunas customizáveis | Claude (sessão Lucas) | "preventiva", "preventiva" é coluna vir… | — |
| E01-S99 | Chamado como ID único — remover numeração própria de OS | Claude (sessão Lucas) | Implementado localmente (2026-07-28). C… | [spec](../../specs/E01-S99-chamado-id-unico-remove-os/product.md) |
| E01-S100 | Categoria "Atendimento Emergencial" — SLA 2h | Claude (sessão Lucas) | Implementado localmente (2026-07-28). t… | [spec](../../specs/E01-S100-sla-atendimento-emergencial/spec.md) |
| E01-S101 | Tela de abertura de chamado com campos da OS + 3 datas | Claude (sessão Lucas) | Implementado localmente (2026-07-28). M… | [spec](../../specs/E01-S101-abertura-chamado-campos-os/spec.md) |
| E01-S102 | Filtro por cliente na tela de Chamados | Claude (sessão Lucas) | Implementado localmente (2026-07-28). t… | [spec](../../specs/E01-S102-filtro-cliente-chamados/spec.md) |
| E01-S103 | Responsável pelo cliente no cadastro | Claude (sessão Lucas) | Implementado localmente (2026-07-28). M… | [spec](../../specs/E01-S103-responsavel-cliente/spec.md) |
| E01-S104 | Board semanal de agenda do técnico | Claude (sessão Lucas) | Implementado localmente (2026-07-28). M… | [spec](../../specs/E01-S104-agenda-tecnico-board/spec.md) |
| E01-S106 | Ferramenta alocável em um cliente | Claude (sessão Lucas) | Implementado localmente (2026-07-28). M… | [spec](../../specs/E01-S106-ferramenta-alocavel-cliente/spec.md) |
| E01-S107 | Local do Chamado/OS: seleção da lista do cliente + "Outro" | Claude (sessão Lucas) | Implementado localmente (2026-07-29). S… | [spec](../../specs/E01-S107-local-selecao-lista-cliente/spec.md) |
| E01-S108 | Fix: modal perde dados ao trocar de aba/tela do PCM | Claude (sessão Lucas) | Implementado localmente (2026-07-29). N… | [spec](../../specs/E01-S108-fix-modal-perde-dados-troca-aba/spec.md) |
| E01-S110 | Todas as listagens/seletores de cliente mostram só Ativos | Claude (sessão Lucas) | Implementado localmente (2026-07-29). A… | [spec](../../specs/E01-S110-filtro-ativos-listagens-cliente/spec.md) |
| E01-S111 | Contatos completos do cliente | Claude (sessão Lucas) | Implementado (2026-07-29). Migrations 0… | [spec](../../specs/E01-S111-contatos-completos-cliente/spec.md) |
| E01-S112 | Agenda do Técnico: horário de início e fim | Claude (sessão Lucas) | Implementado (2026-07-29). Migration 01… | [spec](../../specs/E01-S112-agenda-tecnico-horario-inicio-fim/spec.md) |
| E01-S119 | Anotações do Chamado | Codex | Implementado localmente (2026-07-29). M… | [spec](../../specs/E01-S119-anotacoes-chamado/spec.md) |
| E01-S113 | "Ferramentas por Técnico" vira hub único (técnico + cliente) | Claude (sessão Lucas) | Implementado localmente (2026-07-29). Q… | [spec](../../specs/E01-S113-ferramentas-hub-tecnico-cliente/spec.md) |
| E01-S153 | Fix modal Estrutura (Portal) + OS escolhe Equipamento (Alvo) + flip Sistema→Auvo | Claude (sessão Lucas) | Implementado localmente (2026-09-24). M… | — |
| E01-S157 | Siglas + identificador de ativo | Codex | Em validação (2026-09-30) — aguarda db-tests, E2E e AC-10 no Auvo | [spec](../../specs/E01-S157-siglas-identificador-ativo/spec.md) |
| E01-S158 | Descrição completa no Auvo | Codex | Migration `0223` e Edge Functions Auvo em produção; db-tests e E2E autenticado pendentes | [spec](../../specs/E01-S158-descricao-completa-auvo/spec.md) |
| E01-S159 | Cadastro completo na Visão 360 | Codex | Implementado localmente; E2E autenticado pendente | [spec](../../specs/E01-S159-cadastro-ativos-visao-360/spec.md) |
| E01-S160 | Aba Árvore na Visão 360 | Codex | Implementada localmente; teste de componente verde, E2E autenticado pendente | [spec](../../specs/E01-S160-arvore-ativos-360/spec.md) |
| E01-S161 | Importação/exportação da estrutura via Excel | Codex | Implementada localmente; E2E autenticado pendente | [spec](../../specs/E01-S161-importacao-excel-estrutura/spec.md) |
| E01-S114 | Nav: "Backlog GUT"/"Ordens de Serviço" viram submenu de "Chamados" | Claude (sessão Lucas) | Implementado localmente (2026-07-29). P… | [spec](../../specs/E01-S114-nav-chamados-submenu-backlog-os/spec.md) |
| E01-S115 | Limpar dados de teste E2E do banco | — (livre) | Feito (2026-07-29). Inventário revisado… | [spec](../../specs/E01-S115-limpar-dados-teste-e2e/spec.md) |
| E01-S118 | Operação unifica Chamados no board | Claude (sessão Lucas) | Implementado localmente (2026-07-29). B… | [spec](../../specs/E01-S118-operacao-unifica-chamados-board/spec.md) |
| E01-S117 | Operação (Kanban): Chamado e OS são o mesmo item | Claude (sessão Lucas) | Implementado localmente (2026-07-29). r… | [spec](../../specs/E01-S117-kanban-operacao-chamado-os-unificado/spec.md) |
| E01-S116 | Ordens de Serviço: botão "Ver Chamado" no painel de detalhe | Claude (sessão Lucas) | Implementado localmente (2026-07-29). c… | [spec](../../specs/E01-S116-kanban-os-abre-chamado/spec.md) |
| E01-S120 | ID do Auvo visível na tela do Chamado/OS | Codex | Implementado localmente (2026-08-06). D… | [spec](../../specs/E01-S120-auvo-id-tela-chamado/spec.md) |
| E01-S121 | Editar campos da OS no modal + re-sincronizar com o Auvo | Claude (sessão Lucas) | Descoberta desbloqueada (2026-08-06). L… | [spec](../../specs/E01-S121-editar-campos-sync-auvo/spec.md) |
| E01-S122 | Tooltips explicando os badges do cliente | Codex | Parcial local (2026-08-06). Tooltips de… | [spec](../../specs/E01-S122-tooltip-badges-cliente/spec.md) |
| E01-S123 | Saúde Auvo: drill-down dos erros | Codex | Implementado localmente (2026-08-06). D… | [spec](../../specs/E01-S123-saude-auvo-drilldown-erros/spec.md) |
| E01-S124 | Mover Chamado (Solicitação)→Corretiva converte em OS | Codex | Implementado localmente (2026-08-06). C… | [spec](../../specs/E01-S124-mover-chamado-corretiva-converte-os/spec.md) |
| E01-S125 | Abertura de OS no Auvo sob demanda | Codex | Implementado localmente (2026-08-06). M… | [spec](../../specs/E01-S125-abertura-os-auvo-sob-demanda/product.md) |
| E01-S126 | Relatório de planejamento/execução (dia/técnico/cliente) | Codex | Implementado localmente (2026-08-06). T… | [spec](../../specs/E01-S126-relatorio-planejamento-execucao/spec.md) |
| E01-S127 | Guia SO atualizado (todos os módulos) | Codex | Implementado localmente (2026-08-06). P… | [spec](../../specs/E01-S127-guia-so-atualizado/spec.md) |
| E01-S129 | Release do PCM para produção (checklist/hardening) | Claude (sessão Lucas) | Produção aplicada (2026-08-06). Migrati… | [spec](../../specs/E01-S129-release-pcm-producao/spec.md) |
| E01-S131 | Ferramenta: cadastro item-cêntrico | Codex | Implementado localmente (2026-08-06). U… | [spec](../../specs/E01-S131-ferramenta-cadastro-item-centrico/spec.md) |
| E01-S133 | Redesign do relatório de apontamento de horas | Codex | Implementado localmente (2026-08-06). R… | [spec](../../specs/E01-S133-apontamento-horas-redesign/spec.md) |
| E01-S134 | Relatório diário da operação (Fabricio) | Codex | Implementado localmente (2026-08-06). T… | [spec](../../specs/E01-S134-relatorio-diario-operacao/spec.md) |
| E01-S135 | Relatório do cliente (HTML + PDF + Portal) | Codex | Implementado localmente (2026-08-06). O… | [spec](../../specs/E01-S135-relatorio-cliente-html-pdf-portal/spec.md) |
| E01-S136 | Dashboard PCM vira cockpit "bom dia" | Codex | Implementado localmente (2026-08-06). B… | [spec](../../specs/E01-S136-dashboard-cockpit-bom-dia/spec.md) |
| E01-S137 | Ferramentas por Técnico rico | Codex | Implementado localmente (2026-08-06). L… | [spec](../../specs/E01-S137-ferramentas-por-tecnico-rico/spec.md) |
| E01-S138 | Funcionário: perfil completo | Codex | Implementado localmente (2026-08-06). P… | [spec](../../specs/E01-S138-funcionario-detalhe-completo/spec.md) |
| E01-S139 | Identidade visual nos PDFs de relatório | Claude (sessão Lucas) | Implementado localmente (2026-08-07). H… | [spec](../../specs/E01-S139-identidade-visual-pdf/spec.md) |
| E01-S141 | Relatório de Inspeção: item vira Chamado pendente | Claude (sessão Lucas) | Superada por E01-S143 (2026-08-10) — Lu… | [spec](../../specs/E01-S141-inspecao-item-vira-chamado/spec.md) |
| E01-S145 | Fluidez e performance de Chamados/OS | Codex | Implementado localmente (2026-08-10). M… | [spec](../../specs/E01-S145-fluidez-performance-chamados/product.md) |

### E02 — Atendimento · Zé
_6 concluídas no histórico · maior ID usado: E02-S34_

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
