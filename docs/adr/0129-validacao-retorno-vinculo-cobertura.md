---
name: "docs-adr-0129-validacao-retorno-vinculo-cobertura-md"
description: "Documento Sinérgica SO: ADR-0129 — Vínculo e cobertura para validação de retorno"
alwaysApply: false
---

# ADR-0129 — Vínculo e cobertura para validação de retorno

**Estado:** proposta não aplicada nem homologada. Complementa ADR-0123.

## Decisão

Na fundação de validação de retorno, a aprovação deverá comprovar a cadeia OS → ocorrência legada → vínculo explícito → ocorrência preparada → Rotina e versão do retorno, além do Cliente. A associação não será inferida apenas por coincidência de Cliente. A cobertura será conferida a partir das perguntas no snapshot aprovado da versão e respostas efetivamente armazenadas para o retorno, sem confiar no booleano declarado `cobertura_comprovada`.

Como ainda não há contrato comprovado para formato e obrigatoriedade das perguntas Auvo, a guarda provisória só admite snapshot não vazio, cada pergunta com `id` inequívoco, e uma resposta por ID, sem respostas extras ou `nao_inspecionado`. É conservadora: também pode recusar perguntas opcionais e retornos sem questionário. Nunca interpreta ausência ou estrutura desconhecida como sucesso.

## Limites

Não resolve a ingestão e autenticação do evento externo, identidade de respostas, evidências, ordenação, regras corretivas/PMOC, nem a transição da OS ou conclusão da ocorrência. A ponte S166 ainda não prova identidade entre versões e somente alcança ocorrências legadas explicitamente vinculadas. A função de decisão permanece revogada e gate fechado; não ativar antes da reconciliação, autorização, testes de transação e revisão adversarial. A guarda é aditiva e não altera histórico; reversão requer conferir dependências antes de remover trigger e função.
