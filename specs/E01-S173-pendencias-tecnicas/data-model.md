# Data Model — E01-S173

## Aggregates and Constraints

pcm.pendencias_tecnicas referencia origem (avaliação/item/ocorrência), alvo, Local, Sistema, evidência, técnico/data, norma opcional, criticidade e estado. Unique por origem/item/ativo impede duplicar falha em reentrega; recorrência distinta não é mesclada sem ação PCM. Resultados por pergunta: OK, Não OK, Não aplicável, Corrigido; Não inspecionado é ausência, não opção de resposta. Histórico de resolução/reabertura preservado.

## State and history

### US1 — Transformar constatação em pendência rastreável

- AC-1: Dado Não OK explícito não resolvido, quando receber avaliação, então cria/atualiza pendência por origem/pergunta/ativo com Ocorrência, Local, Sistema, checklist, fotos recebidas, executor e data; reentrega não duplica.
- AC-2: Dado Corrigido, quando registrar, então guarda evidência sem pendência aberta; Não aplicável preserva justificativa exigida e Não inspecionado é ausência que impede validação quando obrigatório.
- AC-3: Dada preventiva integral executada com Não OK, quando PCM validar, então pode concluir preventiva mantendo necessidade corretiva aberta; sem resposta completa não classifica OK por inferência.

### US2 — Consultar e decidir parcialmente por ativo

- AC-4: Dado ativo com falhas, quando consultar Pendências, então cartão consolida contagem/criticidade e detalhe lista unidades atômicas com evidências, norma, data, estado e histórico; filtros não misturam Clientes.
- AC-5: Dadas sete pendências, quando selecionar duas, então somente as duas vão à composição de Backlog e as demais permanecem no banco de Pendências; nenhuma seleção cria Chamado/OS automaticamente.
- AC-6: Dada dispensa, duplicidade, risco aceito, resolução ou reabertura, quando PCM autorizado decidir, então exige justificativa, preserva origem/histórico e só resolve condição técnica efetivamente atendida.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
