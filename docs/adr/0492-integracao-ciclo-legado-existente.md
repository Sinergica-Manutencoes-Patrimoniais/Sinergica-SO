# ADR-0492 — Integração controlada de ciclo existente

Status: preparado, gate fechado, não aplicado nem homologado. Um comando autorizado vincula uma ocorrência preparada por calendário a uma ocorrência preventiva legada já existente, usando a ponte canônica 0340, após verificar a relação humana atual entre Planos, mesmo Cliente/alvo/data e ocorrência legada pendente sem OS ou tarefa. É idempotente, auditado e não cria Plano/ocorrência legada, OS ou tarefa Auvo.

Esta integração não prova equivalência geral de Planos ou recorrências; mantém a origem legada e não preenche automaticamente a fila oficial. Grupos Quantitativos e ocorrências por Visita não têm ponte compatível. Concorrência com criação de OS/geradores legados, permissão, revisão adversarial e testes permanecem bloqueadores da ativação.
