---
name: "docs-adr-0378-revisao-conteudo-os-md"
description: "Documento Sinérgica SO: ADR-0378 — Revisão explícita do conteúdo básico da OS"
alwaysApply: false
---

# ADR-0378 — Revisão explícita do conteúdo básico da OS

Status: proposta; gate fechado, incompleta para despacho, sem testes.

Antes da confirmação PCM, o responsável revisa snapshot explícito dos campos básicos da OS e da Visita planejada. O banco bloqueia Visita e OS, compara o snapshot apresentado e grava revisão imutável; alterações posteriores dos campos básicos incrementam contador monotônico sob gate. A confirmação PCM deve ocorrer depois da revisão e corresponde à revisão planejada seguinte. Na intenção local bloqueada, o servidor revalida contador, snapshot e confirmação; nenhuma rede é liberada.

Esta fatia não comprova alvo funcional, questionário, escopo de Chamado, equipe ou demais vínculos externos, nem captura mudanças indiretas nessas entidades: portanto **não constitui revisão completa do conteúdo da OS** e o bloqueio de despacho permanece. Ativação exige mapear dependências, reconciliação de dados anteriores e testes de concorrência, RLS e migrations.
