---
name: "docs-adr-1543-fontes-oficiais-continuidade-revisao-md"
description: "Documento Sinérgica SO: ADR-1543 — Fontes oficiais na continuidade da revisão"
alwaysApply: false
---

# ADR-1543 — Fontes oficiais na continuidade da revisão

O SSO mantém a estrutura oficial e o Auvo executa OS. Uma Visita criada no SSO pode não ter antecessor legado; exigir uma ponte para toda Visita impede revisar Planos nativos. Por outro lado, ignorar Planos preventivos legados do Cliente sem relação ou classificação vigente deixa uma fonte local sem tratamento.

Na validação transacional de continuidade existente, substituir a exigência de ponte legada para toda Visita pela exigência de que todos os Planos legados do Cliente tenham relação declarada ou classificação negativa atual e auditada. Ocorrências de relações declaradas continuam exigindo reconciliação e pontes onde aplicável; as demais validações de Visita, decisões, fotos, OS, PMOC e Grupo permanecem. As tabelas e pontes legadas são travadas pela avaliação existente. Não é criada flag e a guarda 1045 continua intacta.

As decisões do Fabrício e S165 AC-5 exigem nova versão, vigência, histórico e prévia em alteração de data-base; não determinam mapeamento automático entre vencimentos distintos. Uma decisão PCM por ocorrência pode preservar o trabalho histórico, mas não se presume cancelamento nem equivalência de datas diferentes. Comparar fontes SSO não comprova execução externa e não libera envio Auvo.

Antes de substituir 1045, integrar e comprovar todas as fontes oficiais e consumidores, revisão adversarial e ensaios de concorrência, OS, múltiplos Clientes, autorizações e replay. Esta migration não constitui aprovação integral nem homologação. A reversão restaura a função anterior sem alterar dados.
