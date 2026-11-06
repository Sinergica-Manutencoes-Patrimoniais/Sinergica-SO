---
name: "docs-adr-0330-upload-evidencia-resposta-md"
description: "Documento Sinérgica SO: ADR-0330 — Upload privado de evidência por resposta"
alwaysApply: false
---

# ADR-0330 — Upload privado de evidência por resposta

Status: proposta, não homologada.

Upload preparado em bucket privado JPEG/PNG limitado a 10 MiB, com caminho gerado por Cliente/retorno/UUID e autorização atual de `execucao.validar`. O comando associa explicitamente objeto existente, pertencente ao usuário, à resposta do mesmo retorno, com revisão monotônica e auditoria. Não presume autoria de campo, autenticidade do conteúdo, pertinência ou execução; não altera cobertura nem aprova OS. Upload e associação são transações distintas: objeto órfão pode existir e requer política própria de retenção; não apagar automaticamente.

Leitura direta, alteração e exclusão ficam bloqueadas; rota mediada preparada verifica autorização antes e depois de baixar, sem URL pública, e limita o resolver ao serviço. Gate próprio e EXECUTE nascem fechados e devem permanecer fechados até revisão de isolamento, autenticação, conteúdo, retenção, testes e revisão adversarial. Sem Auvo.
