# ADR-1284 — Consulta de recibos das ações de Chamado de campo

Status: proposta local; não aplicada nem homologada.

Preparar consulta autenticada para a tentativa exata de confirmação/correção, união/duplicidade ou cancelamento de Chamado de campo. A consulta exige ator original, Cliente, OS, request, autorização atual e conteúdo equivalente ao comando persistido. Datas são normalizadas no banco. Consultar recibo não repete a escrita; ausência, recusa ou timeout não comprovam falha do pedido anterior.

Cada operação continua sob seu gate próprio fechado. Validar privacidade, permissões/revogação, transferências posteriores de OS, serialização de datas e JSON, commit em andamento, concorrência, RLS/FORCE e revisão adversarial antes de habilitar.
