# ADR-1122 — Retificação de fonte já utilizada

Status: proposta local, não aplicada nem homologada.

Uma fonte de aquisição já vinculada a proposta pode ser substituída por nova declaração, com motivo e recibo, sem alterar qualquer versão anterior do orçamento. O vínculo de uso da fonte substituta é criado na mesma transação para a mesma proposta que já usou a fonte antiga; a fonte anterior permanece imutável e fora das seleções futuras. Assim a correção não libera automaticamente o gasto para outra proposta. A revisão ou liberação comercial continua sendo procedimento próprio.

O comando exige lista/OS no Cliente, revisão da lista, autorização de material, orçamento e custo e locks compartilhados com composição. Deve preservar correlações ancestrais. Antes de ativar, comprovar todos os escritores, cadeias de retificação, replay, reuso em propostas, colisões de ID, concorrência, acesso a custos, RLS/FORCE e revisão adversarial. Não modifica proposta, não envia documento, não cria cobrança e não identifica duplicidade física declarada sob outro ID.
