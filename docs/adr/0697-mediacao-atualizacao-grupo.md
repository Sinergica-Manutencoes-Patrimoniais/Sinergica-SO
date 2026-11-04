# ADR-0697 — Mediação da atualização de Grupo por levantamento

As variantes existente e motivada de atualização de Grupo recebem mediadores autenticados sujeitos ao gate da ADR-0687 e à permissão `cadastro.aprovar` no Cliente do lote. Os núcleos permanecem privados e conservam travas, validação do Grupo, revisão, auditoria, idempotência e a guarda de motivo de quantidade da ADR-0273. A variante motivada continua responsável pela autorização transacional de quantidade da ADR-0276.

O gate segue fechado; testes, revisão de segurança e comprovação de comportamento concorrente e de sincronização são exigidos antes de ativar.
