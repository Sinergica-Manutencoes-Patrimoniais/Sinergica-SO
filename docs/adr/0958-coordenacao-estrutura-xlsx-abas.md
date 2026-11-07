---
name: "docs-adr-0958-coordenacao-estrutura-xlsx-abas-md"
description: "Documento Sinérgica SO: ADR-0958 — Coordenação entre abas no envio de estrutura XLSX"
alwaysApply: false
---

# ADR-0958 — Coordenação entre abas no envio de estrutura XLSX

Status: preparação desconectada, sem validação.

Usar Web Locks por usuário/Cliente e armazenamento compartilhado por origem do navegador para a tentativa mínima. A trava envolve recuperação, envio, invalidação e limpeza; sem Web Locks ou armazenamento utilizável o envio falha fechado. Uma tentativa incerta só pode ser repetida com a mesma origem, aba e digest. O armazenamento não contém bytes nem credenciais, mas retém identificadores e hash até confirmação ou procedimento auditado de suporte.

Web Locks não coordena dispositivos, navegadores, versões antigas ou scripts que não participem do protocolo. Tampouco protege contra limpeza de armazenamento, alterações privilegiadas ou escritores legados. O servidor continua responsável pela exclusão mútua, autorização e recuperação; comprovar a interação entre dispositivos, tratamento de erros e retenção/LGPD antes de qualquer habilitação. ADR-0936 e gates permanecem fechados.
