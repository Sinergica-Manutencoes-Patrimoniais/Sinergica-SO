# ADR-1363 — Inconsistência por item no quadro gerencial

**Estado:** proposta; não aplicada nem homologada.

## Contexto

A consulta do quadro gerencial recusa toda a página se um Chamado possui vínculo legado inconsistente. Com isso, um único cadastro impede a consulta dos demais Chamados da página.

## Decisão

Adicionar versão da consulta que preserva gate, capacidade, isolamento por Cliente e paginação existentes. Para cada Chamado, verificar as mesmas inconsistências de vínculo da consulta anterior. Itens consistentes mostram totais de OS e progresso; itens inconsistentes retornam apenas sua identidade e um indicador de conferência, sem totais, sem seleção de OS e sem inferir ou corrigir vínculos. Manter a função anterior para consumidores legados. A tela usa a nova versão sob o gate já existente.

## Limites

A leitura não reconcilia dados, não prova integralidade, não substitui regras de encerramento e não habilita 1:N. Conferir definição instalada, políticas, permissões, concorrência, consistência entre páginas e volume; executar testes e revisão adversarial antes de ativar. Nenhuma escrita ou integração externa é executada.
