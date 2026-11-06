# ADR-1231 — Diagnóstico interno do executor de varredura

## Decisão

Preparar consulta interna de saúde do executor periódico da fila, restrita ao papel de serviço. Ela retorna habilitação, intervalo, instante da última conclusão e estado/agregados da execução corrente, sem expor Clientes, objetos, cursores, segredos ou payloads. A consulta não avança execução, não cria ocorrência e não abre gates.

## Limites

O horário da última atualização é apenas progresso registrado; não é heartbeat, lease ou prova de falha. Falhas transacionais revertidas e erros da borda não ficam registrados por esta consulta. Validar privilégios, RLS/FORCE, concorrência, tempo e revisão adversarial antes de uso operacional; não confundir diagnóstico com autorização de implantar ou agendar.
