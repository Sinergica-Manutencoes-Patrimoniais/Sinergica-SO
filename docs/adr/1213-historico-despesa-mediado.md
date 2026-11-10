---
name: "docs-adr-1213-historico-despesa-mediado-md"
description: "Documento Sinérgica SO: ADR-1213 — Histórico mediado de comprovantes de despesa"
alwaysApply: false
---

# ADR-1213 — Histórico mediado de comprovantes de despesa

## Decisão

Preparar leitura autenticada do histórico de realizações e correções por Cliente, Visita e despesa, mantendo a função anterior privada. A consulta exige capacidade `despesa_visita.gerir`, gate de resumo e vínculo atual da despesa; retorna apenas valor, autor, data, tipo e revisão, sem caminho do arquivo.

O histórico não comprova integridade dos bytes nem autoriza publicação ou cobrança. O download continua em sua rota própria, que deve revalidar acesso e proteger o objeto. Páginas são independentes.

## Gates

Não habilitar antes de testes de RLS/FORCE, troca de Cliente/sessão, paginação, privacidade, concorrência, transporte de download e revisão adversarial. Nenhuma policy de Storage é alterada.
