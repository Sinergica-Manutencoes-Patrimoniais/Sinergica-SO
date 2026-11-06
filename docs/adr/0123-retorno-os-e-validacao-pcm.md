# ADR-0123 — Retorno de campo e validação humana da OS

**Estado:** proposta não aplicada e não homologada. Complementa ADR-0026 e ADR-0100.

## Contexto e decisão

O legado `avaliacoes_preventivas` recebe respostas por ocorrência e `achados_preventivos` por avaliação (0224/0226); 0307 restringe alteração conforme origem. Não é seguro copiar respostas atuais como retorno da nova versão de Rotina sem vínculo, proveniência e ordenação comprovados.

Preparar registros privados de recepção e respostas estruturadas associados a OS, Cliente e versão/Rotina aprovada, preservando chave do evento de origem. Registrar decisões humanas separadas, com ator, data, decisão e motivo; versão/revisão e proteção append-only efetiva ainda precisam ser implementadas. Resposta Não OK pode fundamentar futura Pendência S173; Corrigido não é Não OK automático. Valores obrigatórios não inspecionados bloqueiam aprovação; ausência de cobertura comprovada também bloqueia. Não inferir a cobertura de um booleano vindo do cliente: somente integração interna futura, com contrato verificado, pode marcá-la. Gate fechado e nenhuma concessão de EXECUTE/acesso direto nesta fase.

## Limites e rollout

0330/0348 são fundações fechadas, não substituem eventos legados, webhook, snapshots PMOC/laudos nem encerram OS ou Chamado. Faltam ingestão Auvo verificável, vínculo transacional entre OS e versão, prova de cada pergunta obrigatória contra snapshot histórico, prevenção de duplicidade e eventos antigos, evidências e retenção, permissão concorrente, reabertura, transição real de OS e integração S173. Uma aprovação registrada isoladamente não encerra OS nem comprova integralidade. Tabelas privadas não devem virar novo caminho concorrente sem migração coordenada. Não aplicar, liberar gate ou implantar antes de testes e revisão adversarial.
