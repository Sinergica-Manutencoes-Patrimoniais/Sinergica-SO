# ADR-1498 — Conferência PMOC nos consumidores de ocorrências

A ocorrência preparada pode anteceder um novo agendamento PMOC da mesma data. Conferir apenas no momento da preparação não protege a criação posterior de vínculo legado, entrada em fila ou Chamado.

Sob o gate de origem e o protocolo existente, conferir os agendamentos PMOC atuais e as classificações para a versão única vigente no vencimento, antes das operações novas que já passam pela guarda de vigência da ocorrência. Um vínculo PMOC da mesma identidade ou classificação ausente/obsoleta exige reconciliação. O replay e consultas de registros anteriores não são alterados; nenhum Chamado, OS ou agendamento existente é modificado.

A avaliação é conservadora e baseada em classificações humanas, não comprova fontes externas. Gates ficam desligados. Testar fluxo legado individual e em lote, fila, Chamado, replay, histórico, permissões e concorrência antes de qualquer ativação. Homologação e deploy seguem bloqueados.
