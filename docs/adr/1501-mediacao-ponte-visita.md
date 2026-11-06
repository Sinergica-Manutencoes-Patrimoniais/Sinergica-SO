# ADR-1501 — Mediação da ponte legada de Visita

A ponte de Visita e a conferência informativa compartilham o escopo da revisão e precisam das mesmas garantias de sessão. Expor mediadores sob o gate da ADR-1500; Visita exige também `visita.confirmar`, antes e depois da operação. As escritas preservam protocolo de concorrência, replay e guardas de origem e vigência. Não criar OS ou tarefa.

As permissões diretas históricas das RPCs de Visita permanecem por compatibilidade e precisam de inventário e corte controlado antes da ativação. A mediação não prova equivalência ou fonte externa. Testar chamadas diretas, revogação, lotes e concorrência; gates, homologação e deploy continuam fechados.
