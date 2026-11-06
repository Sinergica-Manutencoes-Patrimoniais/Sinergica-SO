# ADR-1416 — Alocação mediada a documento existente

## Decisão

Adicionar entrada autenticada com gate fechado para alocar item a lançamento de entrada do mesmo Cliente, mantendo núcleo transacional privado. Fatos de serviço extra e itens com reserva documental histórica exigem caminho de conciliação próprio; não são alocados por esta entrada. Ação não cria lançamento ou cobrança.

## Limites

Migration e tela não aplicadas nem testadas. Validar todas as reservas e escritores, locks e contenção, replay após reserva, saldos, competência, autorização/revogação, RLS/FORCE, política para fatos de serviço e revisão adversarial antes de habilitar.
A repetição de um pedido já registrado é encaminhada ao núcleo proprietário antes da restrição de novas reservas, para que a presença posterior de reserva não oculte o recibo. A autorização atual e a identidade integral do pedido continuam obrigatórias. Validar ordens de concorrência e replay antes de ativar.
