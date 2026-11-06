---
name: "docs-adr-0169-preflight-migracao-cliente-md"
description: "Documento Sinérgica SO: ADR-0169 — Diagnóstico agregado de migração por Cliente"
alwaysApply: false
---

# ADR-0169 — Diagnóstico agregado de migração por Cliente

Status: proposta, não homologada.

Prévia de leitura por Cliente, restrita a superadmin ativo e capacidade `plano.gerir` vigente, com gate fechado e RPC revogada. Conta divergências de Chamado/OS, códigos vazios e possíveis duplicidades dentro do Cliente e referências de planos preventivos aos alvos. Não altera, corrige ou migra dados. Não infere Visita por data nem expõe conteúdo ou identificadores de outro Cliente.

O recorte local não prova unicidade global de códigos, nem compreende referências sem Cliente, agenda, achados, mapeamentos, equivalência de lotes ou todos os critérios da migração. São necessárias análise global autorizada, prévia detalhada, execução controlada com rollback lógico, evidência e testes antes de qualquer ativação.
