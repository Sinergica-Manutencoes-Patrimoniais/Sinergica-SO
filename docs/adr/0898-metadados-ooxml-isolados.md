---
name: "docs-adr-0898-metadados-ooxml-isolados-md"
description: "Documento Sinérgica SO: ADR-0898 — Metadados e strings OOXML isolados"
alwaysApply: false
---

# ADR-0898 — Metadados e strings OOXML isolados

Data: 2026-10-30 · Status: preparação; XLSX bloqueado.

Interpretar XML já extraído de `workbook.xml`, relacionamentos e strings compartilhadas, com limites e sem DTD. Preservar nome, ordem, visibilidade e identidade das abas e sistema de datas 1900/1904; não escolher automaticamente a aba nem converter datas. Resolver apenas relacionamentos internos para caminhos canônicos de planilhas em `xl/worksheets/`; referências externas, duplicadas ou ambíguas são rejeitadas. Textos compartilhados preservam ordem dos trechos e espaços; índices ausentes não são inventados.

O componente não extrai ZIP, abre arquivos ou grava staging. O parser de metadados não comprova segurança do pacote nem substitui inspeção de CRC, ZIP64, conteúdo e limites de descompressão. Manter desligado até integração, testes com arquivos originais e revisão adversarial.
