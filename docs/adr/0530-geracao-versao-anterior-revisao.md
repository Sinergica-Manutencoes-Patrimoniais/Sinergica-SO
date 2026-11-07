---
name: "docs-adr-0530-geracao-versao-anterior-revisao-md"
description: "Documento Sinérgica SO: ADR-0530 — Geração da versão anterior durante revisão"
alwaysApply: false
---

# ADR-0530 — Geração da versão anterior durante revisão

Status: preparado, gate desligado, não aplicado nem homologado. A revisão 0274 cria rascunho e muda o Plano para rascunho; isso bloqueava os geradores preparados mesmo para a versão aprovada anterior. Esta adaptação permite gerar somente para a versão anterior comprovada pelo comando e auditoria de início da revisão, desde que a versão permaneça aprovada e os demais gates, vigências, origem, permissões e regras de ciclo sejam atendidos. Plano suspenso/encerrado continua bloqueado.

Recria os corpos de 0337, 0455, 0734 e guarda 0662 preservando demais regras. Não aprova a revisão nem gera tarefas externas. Requer comparação com versões realmente instaladas, teste de concorrência/suspensão, fuso de referência, retroativos, política operacional e revisão adversarial antes de habilitação.
