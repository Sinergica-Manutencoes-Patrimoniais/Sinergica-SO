---
name: "docs-adr-0620-aplicar-campos-localizacao-md"
description: "Documento Sinérgica SO: ADR-0620 — Integração de campos conferidos de localização"
alwaysApply: false
---

# ADR-0620 — Integração de campos conferidos de localização

Status: proposta; gate fechado, não homologada.

A aprovação só admite campos 0831 quando o retrato mais recente foi conferido no ciclo atual e a integração está habilitada. Para linhas com campos declarados, guardas impedem os caminhos comuns de registrar incorporação sem a autorização transacional interna. O comando aplica criação ou atualização via operações existentes, compara snapshot completo no caso de atualização, aplica somente descrição/tipo/ordem declarados e verifica que os demais campos, inclusive hierarquia e sigla, não mudaram após a operação canônica. Auditoria preserva antes/depois e motivo; requestIds são idempotentes. GUC de supressão Auvo é mantido em toda operação.

Não converte observações ou códigos da planilha nem descarta quantidade. RPC, gate e UI permanecem fechados. Revisar cuidadosamente ordem de triggers, compatibilidade de grants, replay, concorrência e todos os gatilhos externos; testes integrados e aplicação pendentes. A suppressão de sync é evidência estática, não comprovação de ambiente.
