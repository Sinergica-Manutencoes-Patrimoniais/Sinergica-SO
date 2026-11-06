---
name: "docs-adr-0104-preflight-transicao-chamado-os-md"
description: "Documento Sinérgica SO: ADR-0104 — Diagnóstico agregado para transição Chamado 1:N OS"
alwaysApply: false
---

# ADR-0104 — Diagnóstico agregado para transição Chamado 1:N OS

**Estado:** proposta local, não homologada. Complementa ADR-0026 e ADR-0090.

## Contexto

Índice de unicidade 0171, trigger de numeração 0209 e leitores/escritores singulares impedem liberar uma segunda OS com segurança. Há referências legadas nas duas direções e inconsistências possíveis entre Clientes. A transição não pode presumir que essas referências concordam.

## Decisão

Disponibilizar função administrativa de diagnóstico somente leitura com contagens agregadas de incompatibilidades, sem expor números, nomes ou IDs. A execução é reservada a `service_role`, não a usuários autenticados. Nenhuma alteração, reparação ou escolha de vínculo é automática. O diagnóstico não é validação completa nem autoriza remover restrições ou iniciar escrita 1:N.

Antes de liberar a transição, inventariar todos os consumidores e fluxos de escrita, estabelecer identidade única de OS, migrar leitura gerencial e implementar comando transacional com autorização, revisão, auditoria, idempotência e prova de concorrência. Executar diagnóstico apenas em ambiente autorizado, e complementar com revisão manual de anomalias sem divulgação indevida de dados.

## Consequências

Mantém números e vínculos legados e não muda comportamento operacional. Testes pgTAP, análise de desempenho, privilégios e revisão adversarial são obrigatórios antes de aplicação. Contagens são fotografias sujeitas a alterações concorrentes e não substituem bloqueio transacional na migração definitiva. Rollback: remover somente a função criada, após confirmar que nenhum consumidor a utiliza; não apagar dados.
