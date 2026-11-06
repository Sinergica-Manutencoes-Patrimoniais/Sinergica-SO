# ADR-1144 — Diagnóstico de candidata T−24

Status: proposta local, gate fechado; não aplicada nem homologada.

Preparar consulta de causas para uma candidata já registrada, restrita ao Cliente e à capacidade de confirmação de Visita. A consulta verifica referências, revisão, janela, estado da OS, confirmação PCM e conteúdo básico; registra explicitamente que contrato e executor externo continuam não comprovados. A leitura nunca autoriza rede, não registra início e não altera tentativa.

O diagnóstico não cobre por completo ciência obrigatória, vínculos preventivos, qualificação, payload, contratos ou corridas após a leitura. Ausência de outro alerta não comprova elegibilidade. Validar todas as fontes, proteção por Cliente, locks, revogação, revisão e FORCE RLS, além de revisão adversarial, antes de habilitar.
