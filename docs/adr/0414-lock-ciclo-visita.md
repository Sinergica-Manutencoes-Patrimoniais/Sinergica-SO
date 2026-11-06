# ADR-0414 — locks do ciclo da Visita

Status: proposto; não aplicado nem homologado.

Edição, planejamento e confirmação usam o mesmo lock de pedido e escopo de composição, antes da função existente, quando o gate de composição está ligado. A ordem de confirmação é pedido, escopo de composição, escopos de ciência e Visita. Com gate desligado não há novos locks nessas operações e seus grants são mantidos.

O protocolo ainda não cobre todos os escritores de status de OS e funcionário nem acesso direto às tabelas. Portanto, a guarda 0632 permanece fechada. Alterar status compartilhado em várias Visitas requer descobrir e ordenar todos os escopos antes de bloquear a fonte, ou um protocolo equivalente; gatilhos AFTER não demonstram essa propriedade. Testes concorrentes, revisão adversarial e drenagem na ativação são obrigatórios.
