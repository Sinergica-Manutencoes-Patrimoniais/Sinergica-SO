# ADR-1158 — Candidata preventiva T−24 a partir de fontes oficiais

Status: proposta local, não aplicada nem homologada.

Preparar comando que reutiliza a intenção local conferida e, na mesma transação, deriva responsável da Visita, identidade da OS e alvo/questionário da fotografia preventiva vinculada. Somente Sistemas e Componentes com vínculo Auvo explícito e ativo são aceitos nesta entrada; Grupo e demais categorias exigem sua própria implementação. Outbox e livro são criados juntos com requestId recuperável, sem envio. O registro anterior da intenção não basta para autorizar efeito: executor deverá revalidar todas as fontes imediatamente antes da rede.

Gate do produtor nasce fechado e a função não recebe EXECUTE. A marcação legada de contrato validado é condição necessária, não prova suficiente para liberar o novo protocolo. Faltam contrato comprovado, produtores das demais categorias, correlação com todos os caminhos legados, execução, cancelamento/reprogramação, revogação transacional e revisão adversarial. Validar ordem de locks, composição, idempotência, concorrência, parâmetros, RLS/FORCE e rollback antes de qualquer ativação.
