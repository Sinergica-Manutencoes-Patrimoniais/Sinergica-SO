# ADR 1455 — Aprovação PCM mediada

A aprovação PCM passa por entrada autenticada que confere Cliente, retorno, permissão atual e gates, preservando o núcleo privado e suas verificações de respostas, evidências e pendências. A aprovação isolada não finaliza a OS; a composição atômica também usa a entrada mediada antes de finalizá-la.

Validar ACL, concorrência, replays, cobertura, segregação de acesso e revisão adversarial antes de habilitar.
