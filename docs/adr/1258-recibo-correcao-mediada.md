# ADR-1258 — Recibo de correção mediada de despesa

**Status:** proposta local, não homologada.

Preparar consulta do resultado registrado da mesma tentativa de correção, com ator, Cliente, Visita, despesa, revisão, valor, objeto e justificativas conferidos. Trava compartilhada da tentativa impede tratar comando em andamento como ausente. A leitura não repete escrita e não verifica bytes do comprovante; ausência do recibo não garante que não haja operação ainda a caminho.

Gate fechado. Validar revogação, concorrência, replay, múltiplas abas, privacidade, RLS/FORCE e revisão adversarial antes de disponibilizar.
