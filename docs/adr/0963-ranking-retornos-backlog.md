# ADR-0963 — Ranking privado de retornos

Status: preparação isolada, não homologada. Depende de ADR-0962.

Preparar consulta de retornos aguardando com score recalculado a partir dos fatores da composição de origem e dos pesos atuais, usando a mesma função do ranking consistente. Páginas seguem score descendente e UUID; assinatura identifica alterações observáveis de retornos, fatores, revisão e pesos. Falta de fatores ou pesos mantém score indeterminado, sem inventar prioridade. É uma lista privada, não uma união com o Backlog oficial.

Fatores herdados precisam de revisão PCM após devolução; não são nova avaliação nem provam que o escopo retornado permaneça equivalente. Assinatura não é snapshot transacional e pode perder alterações revertidas. A integração com ranking único, autorizações, migração de consumidores, tratamento de retornos parciais, concorrência e revisão adversarial seguem obrigatórias. Sem concessão ou gate aberto.
