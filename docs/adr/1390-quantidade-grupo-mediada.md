# ADR-1390 — Declaração de quantidade de Grupo mediada

Histórico, atestados e declaração usam entradas autenticadas com permissão `execucao.validar`, gates de leitura e escrita independentes e conferência de autorização na transação. Os núcleos existentes permanecem privados; gates novos iniciam fechados. A tela conserva o mesmo pedido até confirmação e verifica sessão, dados selecionados e paginação.

A quantidade é declaração revisionada, não comprova execução nem encerra OS. Não cria tarefas Auvo. Aplicação coordenada, ACL/RLS/FORCE, isolamento, revogação, paginação concorrente, supressão de Visita, repetição, acessibilidade e revisão adversarial são obrigatórias antes de habilitar.
