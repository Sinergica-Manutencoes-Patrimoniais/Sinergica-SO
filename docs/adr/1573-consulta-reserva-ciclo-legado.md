---
name: "docs-adr-1573-consulta-reserva-ciclo-legado-md"
description: "Documento Sinérgica SO: ADR-1573 — Consulta mediada da reserva de ciclo"
alwaysApply: false
---

# ADR-1573 — Consulta mediada da reserva de ciclo

A tela precisa recuperar a escolha corrente e sua revisão antes de registrar outra decisão. A consulta resolve aliases pelo ciclo canônico, confere ator e Cliente, apresenta apenas registros do mesmo Plano e marca fotografia estrutural obsoleta. Conflitos de outro Cliente não são revelados. O resultado é consultivo e não garante ausência de alterações posteriores: o comando deve revalidar tudo. O acesso de escrita permanece separado e sujeito à validação da 1714.
