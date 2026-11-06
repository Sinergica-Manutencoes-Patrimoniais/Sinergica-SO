# ADR-0297 — Vínculo preliminar de declaração a orçamento aceito

Status: proposta; gates fechados, validação pendente.

O snapshot publicado atual do orçamento operacional contém preço global e descrição, mas não preserva quantidade nem preço unitário público por item. Assim, não é seguro afirmar cobertura de item nem gerar candidato faturável de material, pois pode duplicar o candidato da proposta inteira (ADR-0286). Esta fatia permite somente vincular declaração aceita à proposta operacional aceita da mesma lista e OS, na versão da decisão, com decisão humana e auditoria. Não afirma quantidade, preço, consumo ou elegibilidade; não cria lançamento ou cobrança. O vínculo é imutável e a integração financeira permanece bloqueada até existir contrato versionado de itens aprovados e regra de não duplicidade.
