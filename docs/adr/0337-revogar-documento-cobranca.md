# ADR-0337 — Retirada de documento da cobrança

Status: proposta; gates fechados, sem testes.

O Financeiro retira o vínculo da publicação mediante motivo auditado, sem apagar documento, vínculo anterior ou lançamento. A lista da cobrança passa a excluir o vínculo retirado; retry da vinculação anterior não o restaura. Como o documento já era publicado independentemente na OS, retirar sua associação com a cobrança não retira seu acesso geral pela OS: isso exige revogação própria no PCM. A ADR-0338 permite nova publicação sem restaurar a anterior. Revisar concorrência e migrações antes da ativação.
