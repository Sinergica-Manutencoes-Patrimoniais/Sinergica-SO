# ADR-0034 — Consulta do histórico técnico

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

O histórico permanece em `audit.events` append-only; clientes não recebem acesso direto à tabela. Uma RPC paginada consulta eventos de Componente ou Grupo, exige capacidade atual de leitura ou gestão para o Cliente atual e projeta somente dados estruturais necessários. Eventos de Componente que envolvam outro Cliente só aparecem quando o usuário também tem acesso aos dois escopos. A inexistência e falta de acesso retornam a mesma falha. A paginação usa data e ID para desempate, sem inferir história anterior. A RPC não altera dados nem faz integração externa.

Movimentações cujo Cliente anterior ou posterior seja desconhecido ficam ocultas nessa consulta, pois não é possível comprovar o acesso aos dois lados. Revisão adversarial é obrigatória antes de publicar. A visualização do histórico e demais fluxos da story permanecem pendentes.
