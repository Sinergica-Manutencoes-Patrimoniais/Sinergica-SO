---
name: "docs-adr-0203-protecao-lancamentos-vinculados-md"
description: "Documento Sinérgica SO: ADR-0203 — Proteção de lançamento com origem faturável"
alwaysApply: false
---

# ADR-0203 — Proteção de lançamento com origem faturável

**Estado:** preparação bloqueada, não homologada nem implantada.

Com gate de faturamento fechado, o trigger não modifica o comportamento legado. As chaves estrangeiras das tabelas novas também impedem exclusão de lançamento já vinculado, independentemente do gate; fechar o gate depois de criar vínculos não remove essa proteção nem reverte dados. Quando o gate for aberto após homologação coordenada, lançamento com qualquer alocação de item faturável terá exclusão, mudança de identidade/Conta/OS/competência/valor e reversão de baixa bloqueadas, mesmo se a alocação tiver estorno lógico ou conferência declarada. Baixa normal de previsto para realizado permanece possível; correções e estornos financeiros exigem fluxo coordenado ainda não implementado. É uma proteção conservadora, não um estorno automático.

Consulta autorizada apresenta documento, alocação, lançamento e estado do estorno lógico/conferência humana sem inferir quitação ou correção contábil. Antes de abrir o gate, validar operações Financeiro legadas e fechamento, segurança, concorrência e ordem de locks, conciliação, reversibilidade, dados históricos, testes integrados e revisão adversarial. Bloqueio pode exigir nova operação administrativa específica; não remover fatos nem abrir exceção sem auditoria.
