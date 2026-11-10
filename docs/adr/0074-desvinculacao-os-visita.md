---
name: "docs-adr-0074-desvinculacao-os-visita-md"
description: "Documento Sinérgica SO: ADR-0074 — Desvinculação auditada de OS da Visita"
alwaysApply: false
---

# ADR-0074 — Desvinculação auditada de OS da Visita

## Decisão

Para Visita em rascunho ou planejada, um comando autorizado encerra o vínculo vigente com motivo obrigatório, responsável e data. A OS e o vínculo histórico permanecem; não há alteração da OS, agenda ou envio ao Auvo. A revisão da Visita é incrementada na mesma transação. O identificador de solicitação é idempotente e sujeito à autorização atual; conteúdo diferente com o mesmo identificador é recusado.

Visita confirmada continua protegida: alteração após confirmação depende de fluxo próprio de invalidação e nova confirmação, ainda não implementado. O comando usa bloqueio da Visita e a mesma ordem de aquisição das demais operações de composição. Vínculo de outra Visita ou já encerrado é recusado.

## Compatibilidade e reversão

Mudança apenas aditiva: leitores e comandos anteriores continuam funcionando. A reversão do código consiste em retirar a permissão de execução e reverter a implantação da função, após interromper uso do comando; dados e auditoria de vínculos encerrados devem ser preservados. Não reativar automaticamente vínculos, pois outra Visita pode ter associado a mesma OS ou ocupado a sequência. Rollout requer validação de concorrência e revisão adversarial.
