---
name: spec
description: Contrato — fluidez e performance do board de Chamados/OS.
alwaysApply: true
---

# Spec — Fluidez e performance de Chamados

> **Fonte da verdade.** Status: aprovado · Tier: arquitetural

## Resumo
O board de Chamados/OS passa a carregar itens ativos em páginas pequenas, com cache, cancelamento,
detalhes sob demanda e feedback imediato, sem perder histórico nem segurança.

## Critérios de aceite

### AC-1: Abertura focada em itens ativos
- **Dado** o operador abrindo Chamados sem filtro salvo
- **Quando** a primeira página é consultada
- **Então** o pseudofiltro `Ativos` exclui `finalizado` e `cancelado`
- **E** esses status continuam acessíveis pelo filtro de histórico

### AC-2: Paginação estável por visão
- **Dado** mais itens que o limite da visão
- **Quando** o operador aciona “Carregar mais”
- **Então** Lista carrega 50, Kanban 30 por coluna, Backlog 50 e Agenda 200 por intervalo
- **E** itens com mesmo timestamp não duplicam nem somem entre páginas

### AC-3: Carga crítica mínima
- **Dado** uma entrada fria em Chamados
- **Quando** conteúdo útil aparece
- **Então** existem no máximo duas consultas de negócio críticas: feed e KPIs
- **E** catálogos, detalhe, histórico e anotações não são carregados antes de sua abertura

### AC-4: Busca e filtros sem resposta obsoleta
- **Dado** busca por número, título ou cliente, ou mudança sucessiva de filtros
- **Quando** o operador altera valores em sequência
- **Então** busca espera 250 ms, requests anteriores são cancelados e somente a última resposta vence

### AC-5: Atualização preserva contexto
- **Dado** conteúdo já exibido
- **Quando** filtro/refetch inicia
- **Então** conteúdo anterior permanece visível com indicador “Atualizando…”
- **E** erro preserva dados, explica a falha e oferece retry
- **E** carga fria usa skeleton sem deslocamento de layout relevante

### AC-6: Consultas limitadas por visão
- **Dado** Lista, Kanban, Timeline, Calendário ou Backlog
- **Quando** a visão carrega
- **Então** consulta somente status/intervalo e colunas necessários àquela visão
- **E** Calendário indexa itens por dia uma vez, sem varrer o array para cada célula

### AC-7: Comandos fluidos e consistentes
- **Dado** uma mudança de status individual ou em lote
- **Quando** o operador confirma
- **Então** status individual atualiza otimisticamente e reverte se falhar
- **E** lote usa uma chamada e retorna sucesso/erro por item

### AC-8: Segurança preservada
- **Dado** usuário sem `pcm:leitura`
- **Quando** consulta view ou funções novas
- **Então** nenhuma linha é exposta
- **E** usuário com leitura não recebe permissão de escrita adicional

### AC-9: Budgets de performance
- **Dado** fluxo medido no ambiente-alvo
- **Quando** gates executam
- **Então** query crítica `<100 ms`, API p95 `<500 ms`, feedback `<100 ms`, conteúdo útil p95
  `<1,5 s`, INP `<200 ms`, payload inicial `<150 KB` e crescimento do bundle gzip `<=20 KB`

### AC-10: Compatibilidade e rollback
- **Dado** migration aplicada antes do frontend
- **Quando** frontend anterior é redeployado
- **Então** continua funcionando porque nenhuma tabela, função ou contrato antigo foi removido

## Casos de borda e erros
- Cursor aponta para item removido/alterado: próxima página usa valores do cursor, sem depender de
  existência da linha anterior.
- Filtro retorna zero: exibe estado vazio, não erro.
- AbortError: não mostra alerta ao usuário.
- Falha parcial no lote: itens bem-sucedidos permanecem atualizados; falhas seguem selecionadas.
- Card movido para coluna ainda não carregada: remove da origem, insere/atualiza destino e invalida.
- Chamado convertido durante leitura: read model não exibe Chamado aberto e OS ao mesmo tempo.

## Fora de escopo
- Code splitting/rotas (E00-S21), virtualização, RUM externo, feature flag e mudança de domínio.
- Remover `fn_kpis_ordens_servico` ou adapters legados necessários ao rollback.
- Otimizar outras telas/listas do sistema.

## Rastreabilidade
- Product: `./product.md`
- Design: `./design.md`
- ADR: `../../docs/adr/0021-read-model-paginado-operacao.md`
- Relacionado: E01-S44 e E00-S21.
