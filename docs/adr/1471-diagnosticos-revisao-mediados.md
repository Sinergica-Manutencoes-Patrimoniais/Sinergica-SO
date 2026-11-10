---
name: "docs-adr-1471-diagnosticos-revisao-mediados-md"
description: "Documento Sinérgica SO: ADR-1471 — Consultas mediadas para revisão de Plano"
alwaysApply: false
---

# ADR-1471 — Consultas mediadas para revisão de Plano

Status: preparação local, gates fechados e não homologada.

A revisão da S165 possui diagnósticos de vigência, decisões de impacto e OS que permanecem privados, enquanto a interface tenta chamá-los diretamente. Preparar entradas autenticadas específicas por Cliente/Plano que verifiquem a sessão, a capacidade `plano.gerir`, a revisão e os gates originais, mantendo os núcleos privados. As leituras adquirem a trava compartilhada de autorização e mantêm os gates relevantes durante a consulta; não concedem acesso às tabelas nem alteram Plano, ocorrência ou OS.

Os resultados continuam parciais e não autorizam aprovação de uma nova versão. Paginação não constitui fotografia transacional entre requisições. A mediação inicia com gate próprio desligado e requer rollout coordenado, testes com dois Clientes, RLS/FORCE, revisão de todos os escritores de permissão, concorrência, volume e revisão adversarial. Nenhum deploy ou efeito externo é autorizado.
