# ADR-1006 — Fluxo reservado de Equipment no worker

Status: preparação fechada, não homologada. Complementa ADR-1002 e ADR-1005.

Sob flag própria desligada, o worker prepara reserva durável para create/update de Componente após consultar política, relê o cadastro após a reserva e confirma a outbox por comando transacional após receber ID numérico válido. Falha depois da reserva deixa-a intacta e registra erro para reconciliação; não repetir automaticamente. Exclusão fica bloqueada no fluxo novo até contrato e reconciliação específicos. Outros tipos permanecem no caminho anterior.

A integração não comprova que a resposta do Auvo representa efeito remoto definitivo, nem cobre todos os escritores, drenos ou ações administrativas. A concessão das RPCs, ambos os gates e a flag permanecem fechados. Validar integridade do payload e IDs, concorrência, compatibilidade da resposta, falhas antes/depois do HTTP, rollback, reprocessamento, auditoria e revisão adversarial antes de qualquer ativação. Nenhum efeito remoto é autorizado por este ADR.
