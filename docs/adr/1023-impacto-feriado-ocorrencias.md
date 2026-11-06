---
name: "docs-adr-1023-impacto-feriado-ocorrencias-md"
description: "Documento Sinérgica SO: ADR-1023 — Ocorrências potencialmente afetadas por feriado"
alwaysApply: false
---

# ADR-1023 — Ocorrências potencialmente afetadas por feriado

Status: preparação privada, não homologada.

Preparar leitura paginada das ocorrências preparadas por Visita com vencimento igual à data de uma declaração ativa aplicável ao Cliente e contrato. Mostrar vínculo e data para conferência do PCM, sem cancelar, reprogramar ou concluir qualquer ocorrência. A coincidência é um alerta, não prova de execução, irregularidade ou cobertura de todos os fluxos.

Consulta exige identidade, `plano.gerir` e `visita.confirmar`, gate e trava por Cliente. Nasce privada; histórico de declarações retiradas, fontes oficiais, Visitas legadas e eventos já enviados continuam fora deste recorte. Validar privacidade, RLS/FORCE, concorrência, paginação, status e revisão adversarial antes de ativar.
