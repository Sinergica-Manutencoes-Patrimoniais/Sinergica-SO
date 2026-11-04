# ADR-0501 — Identidade unificada de origem de execução

Status: preparado, gate fechado, não aplicado nem homologado. Um resolvedor privado verifica Cliente, ocorrência legada, exatamente uma ponte de calendário ou Visita, alvo/data, origem contratual da Visita e snapshot aprovado da Rotina. Não altera fila, não aprova retorno ou OS e não concede execução.

Os consumidores 0354/0582, 0371/0584, 0402, 0530, 0552 e 0562 ainda dependem da ponte de calendário. Adaptá-los parcialmente permitiria inconsistência; a integração operacional e a fila ficam bloqueadas até adaptação transacional completa, testes de concorrência/segurança e revisão adversarial. A ponte de Visita não comprova automaticamente feriados ou conformidade.
