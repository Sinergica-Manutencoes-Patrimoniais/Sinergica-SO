---
name: "docs-adr-0796-e01-s172-disponibilidade-snapshot-md"
description: "Documento Sinérgica SO: ADR-0796: disponibilidade declarada no snapshot de demanda"
alwaysApply: false
---

# ADR-0796: disponibilidade declarada no snapshot de demanda

Status: proposta, sob gates fechados, sem homologação.

O snapshot v4 reutiliza 0993 e lê, na mesma instrução STABLE, até 100 declarações de disponibilidade por Cliente e semana da tabela existente, protegida por `capacidade.gerir`. A projeção inclui técnico, revisão e minutos destinados, reservados e ausentes; o limite atingido é informado. Não altera policies, tabelas, Visitas ou registros.

A interface calcula subtotal líquido declarado como destinados menos reservas e ausências, com validação de inteiros, Cliente/semana e duplicidade por técnico. O usuário informa que descontos não se sobrepõem, mas o sistema ainda não prova essa condição; o número não é disponibilidade efetiva. O subtotal de HH interno declarado da demanda é exibido em paralelo com o subtotal de disponibilidade declarada do mesmo snapshot, não como saldo final ou autorização de planejamento. Terceiros seguem separados.

Mesmo com menos de 100 linhas, não se prova cobertura integral de pessoas, reservas, ausências, especialidades, deslocamento, estados ou ocorrências. Falha, falta de fontes, duração zero ou duplicidade jamais provam demanda ou capacidade completa. A disponibilidade é restrita ao Cliente, não somada indiscriminadamente entre Clientes. Gate e revisão adversarial permanecem obrigatórios; nenhum saldo é homologado nesta etapa.
