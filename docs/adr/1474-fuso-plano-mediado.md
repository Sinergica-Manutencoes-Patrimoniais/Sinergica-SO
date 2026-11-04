# ADR-1474 — Declaração de fuso mediada

Status: preparação local, gate fechado e sem homologação.

Preparar acesso autenticado por Cliente e Plano às consultas e declaração auditada de fuso já existentes. A mediação exige sessão, capacidade `plano.gerir`, trava compartilhada de autorização e gates fechados por padrão; preserva requestId, revisão e núcleo privado. Declaração é informada pelo PCM, não comprova fonte contratual nem altera geração ou vigência. A UI preserva tentativa e exige conferência dos campos efetivamente exibidos.

Revisar concorrência, replay, isolamento entre Clientes, compatibilidade das fontes, RLS/FORCE e cobertura de fuso antes de habilitar. Não autoriza deploy ou atividade no Auvo.
