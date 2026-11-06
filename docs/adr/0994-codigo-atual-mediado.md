---
name: "docs-adr-0994-codigo-atual-mediado-md"
description: "Documento Sinérgica SO: ADR-0994 — Código atual para correção administrativa"
alwaysApply: false
---

# ADR-0994 — Código atual para correção administrativa

Status: preparação privada, não homologada.

Preparar consulta específica do código atual de Sistema ou Componente pelo ator e Cliente esperados, com autorização atual de leitura e substituição. O mediador opera em READ COMMITTED, obtém a trava compartilhada de autorização e mantém o gate até o fim da transação. A consulta retorna apenas o código corrente do ativo não excluído, sem alterar identidade, aliases ou vínculos. Falha de autorização ou ativo ausente usa a mesma resposta, sem distinguir existência.

A função nasce privada, gate fechado e interface sob flag desligada. A leitura não reserva o código nem impede alteração posterior: a substituição continua responsável por conferir o código anterior na transação. Não remove consultas legadas nem comprova que todos os escritores usam as mesmas travas. Antes de ativar, validar escopos, proprietário/FORCE RLS, revogação, concorrência, compatibilidade e revisão adversarial.
