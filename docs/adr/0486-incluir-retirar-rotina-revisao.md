# ADR-0486 — Inclusão e retirada em revisão

Status: preparado, gate desligado, não aplicado nem homologado. Recria os comandos canônicos de inclusão 0265 e retirada 0303 preservando autorização, revisão, idempotência e auditoria; em revisão exige gate 0708 ativo e versão rascunho existente. A retirada afeta apenas linha de rascunho, nunca snapshot aprovado ou OS. Restrições referenciais e histórico existente podem impedir retirada, sem exclusão em cascata.

Não aprova revisão, resolve impactos nem altera ocorrências. Antes de habilitar é necessário comparar com funções realmente instaladas, revisar dependências, concorrência e referência histórica, executar testes e revisão adversarial.
