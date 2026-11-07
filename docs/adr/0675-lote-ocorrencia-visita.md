---
name: "docs-adr-0675-lote-ocorrencia-visita-md"
description: "Documento Sinérgica SO: ADR-0675 — Preparação em lote de ocorrências por Visita"
alwaysApply: false
---

# ADR-0675 — Preparação em lote de ocorrências por Visita

Comando atômico recebe até 25 Visitas explicitamente selecionadas para uma Rotina e usa o gerador canônico 0744, preservando identidade por série e semana. Cada item informa ID proposto e fonte declarada de dia útil; revisão do Plano, autorizações e regras de Visita são revalidadas pelo comando canônico. Repetir a mesma requisição devolve o mesmo resultado; falha em qualquer item reverte o lote.

O comando prepara ocorrências SSO: não cria OS, ocorrência legada ou tarefa Auvo. A fonte declarada não comprova cobertura oficial de feriados. Gate e permissões permanecem fechados; protocolo global de locks, execução, testes e homologação continuam pendentes.
