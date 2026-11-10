---
name: "docs-adr-0625-leitura-foto-grupo-md"
description: "Documento Sinérgica SO: ADR-0625 — Download mediado de foto do Grupo"
alwaysApply: false
---

# ADR-0625 — Download mediado de foto do Grupo

Consulta autorizada retorna metadados sem caminho. Resolvedor de caminho é exclusivo de serviço e revalida identidade, permissão, OS, vínculo, nota, objeto e bucket privado. A fronteira HTTP verifica autorização antes e depois do download, limita tamanho e usa resposta privada sem cache; não autentica conteúdo. Gate permanece desligado.

Serviço, políticas de Storage, segurança, testes e concessões precisam de revisão antes de implantação; objeto removido ou vínculo inválido bloqueia leitura. Não há URL pública nem aprovação ou encerramento.
