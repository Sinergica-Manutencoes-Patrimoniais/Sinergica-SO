---
name: "docs-adr-0335-vinculo-temporario-documento-ativo-md"
description: "Documento Sinérgica SO: ADR-0335 — Vínculo temporário de documento do levantamento"
alwaysApply: false
---

# ADR-0335 — Vínculo temporário de documento do levantamento

Prepara-se associação privada de documento humano aceito a Grupo, Componente ou Sistema incorporado pela mesma linha e Cliente, com revisão de decisão, autorização e idempotência. O arquivo permanece no bucket privado de levantamento e nenhum campo legado é alterado. Rejeição posterior impede novas resoluções do vínculo sem apagar histórico.

Este modelo é temporário e não substitui fonte canônica de anexos dos ativos. Exige reconciliação, endpoint mediado autenticado, revisão de conteúdo/retensão, testes e revisão adversarial antes de ativar. Aceite humano não comprova segurança do PDF.
