# ADR-0387 — Atendimento de parcela mediante revisão humana

Prepara-se comando privado que usa a revisão humana mais recente de parcela, com condição declarada atendida e evidência vinculada, além de OS atribuída e finalizada no mesmo Chamado/Cliente. A ação requer confirmação PCM, motivo e revisões de Chamado/escopo; delega a marcação ao comando canônico de escopo existente e registra proveniência e retry idempotente.

O status finalizado não é sozinho prova da condição. Não cria OS, não resolve automaticamente Pendência e não autoriza devolução. Gates e execução fechados; provas, concorrência, consumidores e testes devem ser revisados antes de ativação.
