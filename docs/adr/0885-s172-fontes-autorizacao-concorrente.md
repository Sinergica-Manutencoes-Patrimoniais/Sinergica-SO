# ADR-0885 — Entradas serializadas das fontes de capacidade

Data: 2026-10-30 · Status: proposta para implementação, gates fechados.

## Contexto e decisão

A ADR-0884 protege o snapshot, mas suas três fontes paginadas permanecem diretamente executáveis por authenticated e usam funções estáveis sem trava da autorização. Preparar entradas voláteis mediadas para demanda de Visita, esforço e ocorrências sem OS, usando READ COMMITTED, a mesma trava compartilhada de autorização e travas dos gates pertinentes. Remover EXECUTE público das entradas antigas; os núcleos estáveis continuam privados e reutilizados pelo snapshot. Manter os formatos e cursores existentes.

Travas dependem da cooperação dos escritores de autorização. Consultas continuam parciais e não comprovam saldo ou execução. Implantação exige consumidores e banco coordenados, teste das duas ordens de disputa para autorização e gates, revisão adversarial e verificação oficial de permissões. Não abrir gates ou enviar tarefas Auvo.
