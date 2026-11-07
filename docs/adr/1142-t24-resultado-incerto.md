---
name: "docs-adr-1142-t24-resultado-incerto-md"
description: "Documento Sinérgica SO: ADR-1142 — Resultado conservador de tentativa T−24"
alwaysApply: false
---

# ADR-1142 — Resultado conservador de tentativa T−24

Status: proposta local, gate fechado; não aplicada nem homologada.

O executor futuro poderá registrar bloqueio antes do efeito, ou marcar resultado incerto/reconciliação. Cada decisão recebe requestId, fence da reserva e recibo imutável; uma tentativa de geração antiga não sobrescreve a atual. Registro de ID remoto é somente observação não comprovada, não vínculo oficial de OS. `incerto` e `reconciliacao` não são novamente reservados automaticamente.

Este passo não registra sucesso, não autoriza POST/PATCH, não executa rede e não resolve efeitos já produzidos. A função permanece privada e depende de gates fechados. Faltam revalidação antes do efeito, comprovação de leitura remota, precedência de cancelamento, integração do proprietário e testes/revisão adversarial. Observações e dados de retorno devem continuar minimizados.
