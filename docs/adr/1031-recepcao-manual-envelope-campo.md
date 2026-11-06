---
name: "docs-adr-1031-recepcao-manual-envelope-campo-md"
description: "Documento Sinérgica SO: ADR-1031 — Recepção manual de linhas associadas a envelope de campo"
alwaysApply: false
---

# ADR-1031 — Recepção manual de linhas associadas a envelope de campo

Status: preparação local, gate fechado; requer testes e revisão adversarial.

O PCM pode preparar um lote a partir de dados estruturados declarados de um envelope existente. A entrada privada valida sessão, capacidade, Cliente e vínculo atual entre tarefa e OS, serializa o envelope e reutiliza a recepção manual do staging. Não exige nem comprova resolução anterior de triagem; a compatibilidade entre as duas operações deve ser examinada antes da liberação. O recibo imutável conserva referências externas de fotos separadamente, sem obter arquivos nem tratá-las como evidências autenticadas. A operação não incorpora cadastros, não comprova que os dados foram fornecidos pelo Auvo e não substitui autenticação da origem ou interpretação configurada do fornecedor.

A indicação manual na triagem é obrigatória. O identificador externo de Cliente pode ser ausente ou divergente: não é tratado como confirmação, pois o fluxo existe também para identificação manual. A OS deve pertencer ao Cliente indicado e ter a mesma tarefa do envelope. A divergência continua exigindo conferência humana e não comprova a procedência; validar permissões de triagem e recepção, inclusive em concorrência, antes de habilitar.

Uma única associação é admitida por envelope; repetição idêntica retorna o recibo, divergência falha. A resolução é conferida contra registros atuais, inclusive em retry. Identidades e linhas são declaradas pelo operador; não expor a RPC até provar RLS/FORCE, integridade do envelope, todas as fontes de autorização, locks, concorrência, reprocessamento, privacidade, retenção e compatibilidade de rollout. Revogação de execução e fechamento do gate preservam histórico.
