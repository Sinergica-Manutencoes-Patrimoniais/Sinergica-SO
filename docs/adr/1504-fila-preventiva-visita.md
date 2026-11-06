# ADR-1504 — Fila preventiva por ciclo de Visita

## Contexto
A fila existente possui chave estrangeira para ciclo de calendário e não aceita a ocorrência canônica por Visita. Uma Visita repetida entre versões deve continuar representando uma única obrigação.

## Decisão
Criar fila e comandos próprios, identificados pelo ciclo canônico de Visita; manter a fila anterior intacta. Disponibilizar consulta e comandos por Cliente com as mesmas ações e recibos da interface existente, capacidade atual de gerir Plano e confirmar Visita, replay auditado e verificação de continuidade. Entrada só é marcada aguardando quando vínculo legado único e seu estado permitem comprovar a candidata no recorte conhecido; sem vínculo recebe verificação. Grupo, conflito, Visita cancelada/suprimida, chamado, OS, estado ou vínculo divergente impedem declarar aguardando. Confirmação exige reavaliação da fonte. Cancelamento da fila não cancela Visita, ocorrência ou OS; ciclo cancelado não reaparece automaticamente. Gate novo inicia desligado e não é habilitado pela migration.

## Limites
A confirmação é parcial: não comprova ausência de execução fora das fontes consultadas. A fila específica ainda precisa ser consolidada nas listagens e indicadores operacionais existentes, revisão adversarial, concorrência com todos os escritores, validação integrada e decisão de ativação coordenada. Mantém guarda 1045; não cria OS ou tarefa Auvo e não autoriza deploy.
