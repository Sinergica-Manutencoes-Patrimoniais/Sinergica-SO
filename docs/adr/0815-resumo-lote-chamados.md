---
name: "docs-adr-0815-resumo-lote-chamados-md"
description: "Documento Sinérgica SO: ADR-0815 — Resumo de OS do Chamado em lote"
alwaysApply: false
---

# ADR-0815 — Resumo de OS do Chamado em lote

Status: proposta, gate desligado, não homologada. O feed gerencial contém páginas e filtros de OS; somar as linhas visíveis produz contagem incompleta. Para até 100 IDs de Chamado, consulta única e set-based agrega todas as OS não excluídas por Chamado, considerando vínculo direto e ponte singular legada, sem duplicar a mesma OS.

O Cliente deriva do Chamado; exige `chamado.encerrar` no Cliente, como a leitura 0312. Chamado sem acesso, inexistente, excluído ou com vínculo cruzado/inconsistente não retorna resultado. A contagem não indica encerramento do Chamado; status desconhecido impede classificar etapas mistas. Zero OS não gera indicador. Consulta usa gate privado iniciado desligado, sem escritas operacionais ou Auvo; retorno não contém dados sensíveis de OS. Erro, carregamento, dado ausente ou lote incompleto não podem ser exibidos como zero nem como progresso integral.

O resumo é fotografia transacional de uma consulta, não garante que Chamado esteja concluído ou seu estado atual; invalidação após mudança, expiração, autorização, desempenho com múltiplos Clientes, conflito dos vínculos legados e revisão adversarial são necessários antes de ativar. Não habilita fluxo 1:N nem elimina índice legado. Rollback operacional: desligar gate; nenhuma OS alterada.

O Kanban consome lotes de até 100 IDs sob `VITE_SSO_RESUMO_CHAMADOS_ENABLED`, desligada por padrão; não usa as páginas parciais como base da contagem. Enquanto consulta, feed ou atualização de status estiverem em andamento, e após erro ou ausência de resposta para um Chamado, o indicador fica oculto. Atualizações locais reconsultam; intervalo de 30 segundos limita, mas não elimina, defasagem por mudanças externas. Teste sintético cobriu gate fechado, duas OS de um Chamado, Cliente sem concessão e vínculo divergente; migration, gate e fixtures foram revertidos. Testes de desempenho, corrida de autorização, RPC em CI e jornada ponta a ponta continuam pendentes.
