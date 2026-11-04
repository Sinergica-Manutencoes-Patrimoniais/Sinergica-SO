# ADR-1186 — Ordem de criação da fotografia de despacho T−24

Status: preparação local; não homologada.

A reserva e os produtores dependem da coluna `despacho`. Criá-la somente depois dessas funções torna a sequência sujeita a falha antes da última migration. Enquanto 1316 e 1344 permanecem locais e não aplicadas, declarar a coluna e sua constraint na 1316, antes dos consumidores; manter a 1344 compatível para instalações sequenciais. Gates continuam fechados.

Antes do rollout, conferir histórico real em cada ambiente. Se qualquer uma dessas migrations já tiver sido aplicada, não reescrever seu histórico: elaborar transição aditiva específica. Validar sequência integral, constraint, privilégios, compatibilidade de dados e revisão adversarial; a coluna isolada não autoriza envio.
