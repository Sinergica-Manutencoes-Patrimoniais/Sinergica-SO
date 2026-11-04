# ADR-0640 — Prévia de origem de serviço extra

Status: preparado, gate fechado, sem aplicação nem homologação.

A prévia reúne os fatos estruturados disponíveis por identidade declarada e expõe os conflitos conhecidos do diagnóstico 0849. Resultado é somente leitura e não reserva origem, não cria item faturável, lançamento ou cobrança. Execução física, classificação da linha e exclusividade transversal permanecem não comprovadas: a prévia nunca autoriza emissão.

Para uma futura emissão, requerem-se fonte canônica verificável de execução e quantidade, identidade estável compartilhada entre origens, classificação de serviço da linha, aceite comercial aplicável, revisão PCM vigente e conciliada, controle transacional de quantidade e duplicidade entre faturamento integral e por linhas, competência aberta, idempotência, autorização e auditoria. Revisar regras de evidência e todos os escritores/locks, testar concorrência e isolamento de Clientes. Ausência de conflito detectado não é prova de exclusividade.
