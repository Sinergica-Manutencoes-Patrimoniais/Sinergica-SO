# ADR-1564 — Visita substituta e OS legada tardia

A geração da Visita substituta reconfere, sob trava, toda OS vinculada por ponte legada a qualquer versão do ciclo da ocorrência anterior. Mesmo uma OS de Cliente inconsistente exige reconciliação; ela não é alterada. Sem essa verificação, uma OS criada após retirada da fila podia escapar da fotografia de efeitos diretos. Requisições já concluídas continuam usando seu recibo idempotente; geração nova falha antes de persistir a substituição. A conferência não afirma ausência em fontes externas.
