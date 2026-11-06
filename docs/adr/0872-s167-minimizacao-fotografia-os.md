---
name: "docs-adr-0872-s167-minimizacao-fotografia-os-md"
description: "Documento Sinérgica SO: ADR 0872 — Minimização da fotografia privada de OS"
alwaysApply: false
---

# ADR 0872 — Minimização da fotografia privada de OS

## Contexto

A ADR 0870 previu comparar a fotografia da OS criada para recusar uma reconciliação de revisão após alteração. Guardar a linha integral no registro de comando duplica observações, descrições e demais campos potencialmente sensíveis sem necessidade para essa comparação.

## Decisão

Na migration 1057 ainda não aplicada, guardar somente o SHA-256 da representação JSON da linha de OS em UTF-8 e o identificador físico `xmin`. Calcular novamente o resumo sob a trava de OS e no fuso UTC da ADR 0871. O conteúdo integral não é copiado para a nova coluna e o resumo não integra a resposta pública. Fotografia ausente ou em formato antigo deve causar conflito, sem fallback permissivo.

## Limites

SHA-256 não é criptografia e não elimina todos os riscos de inferência. O uso de `xmin` pode causar conflitos após restauração, congelamento ou manutenção e exige validação de ciclo de vida; a comparação não cobre fontes de escopo nem escritores externos à ordem de trava. A SPEC_DEVIATION e os gates continuam fechados até reconciliação do contrato, revisão de segurança, testes integrados e revisão adversarial. Esta decisão substitui a retenção integral prevista na ADR 0870, não suas demais condições.
