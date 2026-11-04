# ADR-1305 — Mediação das referências declaradas de fotos

## Decisão

A consulta de referências do levantamento permanece privada; criar entrada
autenticada que confere ator e delega ao núcleo existente, preservando gate,
Cliente, capacidade e paginação. A interface acessa a nova entrada apenas sob
flag desligada por padrão. Referências são texto opaco: não são links
autenticados, imagens importadas ou prova de origem.

## Antes de habilitar

Validar permissões e revogação, concorrência, paginação, confidencialidade,
campos legados, RLS/FORCE e revisão adversarial. O cliente e a migration
exigem implantação coordenada; nenhum arquivo é baixado ou criado.
