# ADR-1130 — Observação persistente de processamento demorado

Status: proposta local, não aplicada nem homologada.

A varredura local pode registrar, por item da fila e sem dados de payload, início desconhecido, duração acima do limite configurado, novo processamento ou encerramento observado na fonte. O limite é configurável e inicialmente ausente; gate fechado. A leitura não comprova lease vencido, falha, resultado remoto nem autoriza retentativa. A observação é separada da ocorrência de integração e mantém eventos imutáveis.

A varredura só atribui observação quando o Cliente da origem é identificado. Divergência de Cliente exige reconciliação e não transfere histórico. Antes de habilitar, validar limites, propriedades, locks, paginação, alteração de origem, concorrência com worker, RLS/FORCE, retenção e revisão adversarial. Nenhum agendamento ou efeito externo é criado.
